# Design Document — Sistema POS Multi-Sucursal para Carnicerías
**Arquitectura Técnica, Esquema de Datos Supabase, Docker, API y Ciberseguridad**

> **Propósito:** Este documento actúa como el puente técnico estricto entre los requerimientos y el código. Define la infraestructura, esquemas SQL, Docker, límites de modificación y lineamientos de seguridad para evitar que la IA improvise o altere archivos no autorizados.

---

## 1. Arquitectura Técnica y Stack

- **Frontend Web (Admin & Web POS):** Next.js 14+ (App Router), TypeScript, Tailwind CSS, IndexedDB (Dexie/RxDB) para soporte offline en mostrador. **Despliegue en Vercel** + contenedor Docker multi-stage para desarrollo/staging.
- **App Móvil / Tablet POS:** React Native + WatermelonDB (SQLite local).
- **Backend API:** NestJS (TypeScript), arquitectura de monolito modular con TypeORM / Prisma. Contenedor Docker multi-stage.
- **Base de Datos:** PostgreSQL 15+ administrado en **Supabase** con Row Level Security (RLS) habilitado, pooling Supavisor (puerto 6543, `sslmode=require`).
- **Colas / Cache:** Redis + BullMQ para procesamiento asíncrono de lotes de sincronización offline.
- **Hardware Integration:** Web Serial API / Web Bluetooth API en Web POS; `react-native-serialport` en móvil.

### 1.1 Arquitectura de Backend Unificado (Web + Móvil)
El sistema opera bajo una **única instancia central de API Backend (NestJS)**:
- Tanto el Frontend Web (Next.js en Vercel) como la aplicación Móvil/Tablet (React Native) consumen exactamente los mismos endpoints HTTP (`/auth/login`, `/catalog/sync`, `/sales/sync`, `/inventory/adjust`).
- No existen backends separados ni duplicación de lógica.
- La persistencia offline es agnóstica al backend: la App Móvil usa SQLite local (WatermelonDB) y la App Web usa IndexedDB en el navegador. Ambas sincronizan contra el mismo endpoint `/sales/sync`.

### 1.2 Conexión a Supabase: DATABASE_URL vs DIRECT_URL
La arquitectura utiliza dos cadenas de conexión hacia la misma base de datos PostgreSQL en Supabase:
1. **`DATABASE_URL` (Puerto 6543 - Transaction Pooler con Supavisor):**
   - Utilizada por NestJS en tiempo de ejecución para atender peticiones concurrentes de ventas, consultas y sincronización.
   - Reutiliza conexiones y evita el agotamiento de sockets de PostgreSQL ante picos de tráfico.
2. **`DIRECT_URL` (Puerto 5432 - Session Mode Directo):**
   - Utilizada exclusivamente por Prisma CLI para ejecutar migraciones (`prisma migrate dev`).
   - El pooler rechaza comandos de bloqueo DDL (`ALTER TABLE`, `CREATE INDEX`), por lo que Prisma requiere esta conexión directa para estructurar las tablas.

### 1.3 Patrones de Acceso (Access Patterns: Fan-out vs Fan-in)
El backend distingue y optimiza de forma aislada los dos patrones de tráfico fundamentales:
1. **Sistemas de Alta Lectura (Fan-out - Consulta de Catálogo y Precios):**
   - **CDN en el Edge (Vercel / CloudFront):** Distribución de assets estáticos, fotos de cortes cárnicos e interfaces Web POS en servidores perimetrales para latencia < 50ms.
   - **Caché en Memoria (Redis Cache-Aside):** El catálogo de productos, categorías y precios por sucursal se cachea en Redis con TTL de 3600s (1 hora).
   - **Invalidación Proactiva:** Cualquier mutación en catálogo (`POST/PATCH /products`) invalida inmediatamente la clave de Redis asociada a esa sucursal (`del sucursal:{id}:catalog`), impidiendo que las cajas lean precios obsoletos.
2. **Sistemas de Alta Escritura (Fan-in - Sincronización Masiva Offline):**
   - **Amortiguación con Colas (BullMQ sobre Redis):** Cuando 5 o más cajas recuperan internet simultáneamente y envían ráfagas masivas de ventas acumuladas, el endpoint `/sales/sync` encola las transacciones en `sales-sync-queue` y responde de inmediato un acuse HTTP 202 (Accepted).
   - **Trabajadores Concurrenciales Controlados (Workers):** Workers en segundo plano procesan las transacciones a un ritmo constante de impacto sobre la base de datos Supabase, evitando la saturación de conexiones o bloqueos de tabla.

### 1.4 Diseño de APIs Robustas, Idempotencia y Controles HTTP
1. **Garantía Estricta de Idempotencia:**
   - Todo endpoint de mutación crítica (`POST /sales/sync`, `POST /cash-shifts/open`) exige una clave de idempotencia en la cabecera `Idempotency-Key` o en el UUID primario generado por el cliente.
   - Si el backend detecta un UUID ya procesado, retorna la respuesta previa almacenada con HTTP 200 sin volver a aplicar deltas de inventario ni generar cobros duplicados.
2. **Semántica de Verbos HTTP y Paginación:**
   - Métodos `GET` estrictamente libres de efectos secundarios y cacheables.
   - Listados de ventas y auditoría implementan **Paginación Basada en Cursores (`cursor-based pagination`)** usando `fecha_hora_servidor` y `UUID` para navegación de alta velocidad sin saltos de rendimiento de `OFFSET/LIMIT`.
3. **Separación de Autenticación vs. Autorización:**
   - **Autenticación:** Validación de identidad del cliente mediante JWT (firma y vigencia) o PIN local offline.
   - **Autorización (RBAC):** Guardias de NestJS (`RolesGuard`, `PermissionsGuard`) que verifican permisos granulares (ej. `ventas.anular`, `inventario.ajustar`) independientes de la autenticación.

### 1.5 Transaccionalidad ACID y Posicionamiento en el Teorema CAP
1. **Atomicidad Transaccional ACID en PostgreSQL:**
   - La confirmación de una venta se ejecuta dentro de un bloque transaccional atómico (`prisma.$transaction([ ... ])`):
     - `INSERT` en `ventas`.
     - `INSERT` múltiple en `detalles_venta`.
     - `INSERT` en `pagos_venta`.
     - `INSERT` en `movimientos_inventario` (deltas negativos).
     - `UPDATE` de deducción en `lotes` bajo algoritmo FEFO.
     - `UPDATE` de stock consolidado en `inventarios`.
   - Si cualquiera de estos pasos falla (ej. error de bloqueo de lote), se ejecuta rollback total instantáneo.
2. **Compromiso ante el Teorema CAP:**
   - **En las Cajas POS (Modo Desconectado):** El sistema prioriza **AP (Alta Disponibilidad y Tolerancia a Particiones)**. Las terminales continúan operando sin red aunque no puedan verificar inventario central.
   - **En el Servidor Central (Sincronización):** Consistencia eventual convergente mediante la aplicación determinista de deltas cronológicos y emisión de alertas de stock negativo si dos cajas vendieron existencias compartidas.

### 1.6 Resiliencia ante Fallos en Sistemas Distribuidos
1. **Timeouts Mandatorios:** Todas las llamadas hacia servicios externos, básculas seriales o pasarelas tienen un límite estricto de timeout de 5000 ms. Ningún hilo del servidor puede quedar bloqueado en espera indefinida.
2. **Circuit Breakers:** Implementación del patrón rompedor de circuitos en la comunicación con APIs externas. Tras 3 fallos consecutivos en 10 segundos, el circuito entra en estado *Open* y rechaza peticiones inmediatas con fallback controlado para permitir la recuperación del servicio degradado.
3. **Bulkheads (Compartimentos Estancos):** Separación estricta de pools de conexión en Supavisor:
   - *Pool Operativo (Transaccional):* Reservado para ventas en mostrador y registro de turnos de caja.
   - *Pool Analítico (Reportes):* Conexiones aisladas para consultas pesadas de dashboard y balances del dueño, impidiendo que una consulta estadística degrade el cobro en mostrador.

### 1.7 Observabilidad Avanzada (Los Tres Pilares)
1. **Logs Canónicos Estructurados (JSON):** Se utiliza `pino-http` en NestJS para emitir una única línea JSON enriquecida por petición:
   `{"level":"info","time":1725678000,"correlation_id":"c1b2-uuid","method":"POST","url":"/sales/sync","status":200,"duration_ms":42,"tenant_id":"neg-1","user_id":"usr-9"}`. Prohibido `console.log` informal en código productivo.
2. **Correlation IDs (`X-Correlation-ID`):** Middleware de entrada genera o propaga un identificador único que se inyecta en cada log, petición interna y mensaje de la cola BullMQ, permitiendo rastrear el ciclo de vida completo de una transacción de venta.
3. **Métricas e Instrumentación:** Exposición de métricas clave (latencia p95/p99, tasa de errores 5xx, profundidad de colas de sincronización) compatibles con Prometheus y Grafana.

### 1.8 Desacoplamiento de Negocio: Monolito Modular con DDD
- El backend se estructura mediante **Bounded Contexts (Contextos Delimitados)** de Domain-Driven Design:
  - `AuthContext`: Gestión de identidad, tokens y roles.
  - `SalesContext`: Venta, comanda, cobro y tickets.
  - `InventoryContext`: Deltas de stock, mermas, lotes y FEFO.
  - `CashContext`: Aperturas, cierres y conciliación de turnos.
- **Comunicación Desacoplada en Memoria:** Los módulos no realizan llamadas directas cruzadas acopladas; utilizan un bus de eventos en memoria (`EventEmitter2`). Cuando `SalesContext` emite el evento `VentaCompletadaEvent`, el módulo `InventoryContext` lo escucha y aplica la deducción FEFO de forma desacoplada. Esto permitirá extraer cualquier módulo a un microservicio independiente en el futuro sin reescribir la lógica de negocio.

---

## 2. Esquema Físico de Base de Datos (Supabase PostgreSQL)

### Convenciones
- Claves primarias: `UUID DEFAULT gen_random_uuid()`.
- Moneda: `NUMERIC(12,2)`. Pesos/Cantidades: `NUMERIC(10,3)`.
- Timestamps: `TIMESTAMPTZ DEFAULT NOW()`.

```sql
-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants y Sucursales
CREATE TABLE negocios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_comercial VARCHAR(150) NOT NULL,
    razon_social VARCHAR(150) NOT NULL,
    nit_rut VARCHAR(50) NOT NULL,
    plan VARCHAR(20) DEFAULT 'basico',
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sucursales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE RESTRICT,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(200),
    ciudad VARCHAR(100),
    zona_horaria VARCHAR(50) DEFAULT 'America/Bogota',
    activo BOOLEAN DEFAULT TRUE
);

-- Usuarios y Seguridad
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pin_pos_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

-- Catálogo
CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    orden_visualizacion INT DEFAULT 0
);

CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre VARCHAR(150) NOT NULL,
    codigo_barras VARCHAR(100),
    tipo_venta VARCHAR(20) NOT NULL CHECK (tipo_venta IN ('peso', 'unidad')),
    unidad_medida VARCHAR(20) NOT NULL CHECK (unidad_medida IN ('kg', 'g', 'unidad')),
    precio NUMERIC(12,2) NOT NULL,
    costo_promedio NUMERIC(12,2) DEFAULT 0.00,
    foto_url TEXT,
    activo BOOLEAN DEFAULT TRUE
);

-- Clientes y Crédito
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(50),
    saldo_fiado NUMERIC(12,2) DEFAULT 0.00,
    limite_credito NUMERIC(12,2) DEFAULT 0.00
);

-- Inventario y Lotes
CREATE TABLE inventarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cantidad_actual NUMERIC(10,3) DEFAULT 0.000,
    cantidad_minima_alerta NUMERIC(10,3) DEFAULT 5.000,
    version INT DEFAULT 1,
    ultima_actualizacion TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(producto_id, sucursal_id)
);

CREATE TABLE recepciones_mercancia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    proveedor VARCHAR(150) NOT NULL,
    fecha_recepcion TIMESTAMPTZ DEFAULT NOW(),
    observaciones TEXT,
    sincronizado BOOLEAN DEFAULT TRUE
);

CREATE TABLE lotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    recepcion_id UUID REFERENCES recepciones_mercancia(id) ON DELETE SET NULL,
    codigo_lote VARCHAR(100) NOT NULL,
    proveedor VARCHAR(150) NOT NULL,
    cantidad_recibida NUMERIC(10,3) NOT NULL,
    cantidad_disponible NUMERIC(10,3) NOT NULL,
    costo_unitario NUMERIC(12,2) NOT NULL,
    fecha_recepcion TIMESTAMPTZ DEFAULT NOW(),
    fecha_vencimiento DATE,
    temperatura_recepcion NUMERIC(4,1),
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'agotado', 'vencido', 'retirado')),
    notas TEXT,
    sincronizado BOOLEAN DEFAULT TRUE
);

CREATE TABLE movimientos_inventario (
    id UUID PRIMARY KEY, -- Generado offline en dispositivo
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    dispositivo_id UUID NOT NULL,
    lote_id UUID REFERENCES lotes(id) ON DELETE SET NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('venta', 'merma', 'recepcion', 'ajuste_manual', 'devolucion')),
    cantidad_delta NUMERIC(10,3) NOT NULL,
    referencia_id UUID,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_hora_dispositivo TIMESTAMPTZ NOT NULL,
    fecha_hora_servidor TIMESTAMPTZ DEFAULT NOW(),
    sincronizado BOOLEAN DEFAULT TRUE
);

CREATE TABLE mermas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    lote_id UUID REFERENCES lotes(id) ON DELETE SET NULL,
    dispositivo_id UUID NOT NULL,
    cantidad NUMERIC(10,3) NOT NULL,
    motivo VARCHAR(30) NOT NULL CHECK (motivo IN ('corte_proceso', 'vencimiento', 'dano', 'robo', 'otro')),
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    foto_evidencia_url TEXT,
    fecha_hora_dispositivo TIMESTAMPTZ NOT NULL
);

-- Ventas y Transacciones
CREATE TABLE ventas (
    id UUID PRIMARY KEY, -- Generado offline (idempotencia)
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    dispositivo_id UUID NOT NULL,
    cajero_id UUID NOT NULL REFERENCES usuarios(id),
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    descuento NUMERIC(12,2) DEFAULT 0.00,
    total NUMERIC(12,2) NOT NULL,
    metodo_pago VARCHAR(30) NOT NULL,
    estado VARCHAR(20) DEFAULT 'completada' CHECK (estado IN ('completada', 'anulada')),
    fecha_hora_dispositivo TIMESTAMPTZ NOT NULL,
    fecha_hora_servidor TIMESTAMPTZ DEFAULT NOW(),
    sincronizada BOOLEAN DEFAULT TRUE
);

CREATE TABLE detalles_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
    cantidad NUMERIC(10,3) NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL, -- Snapshot inmutable
    subtotal_linea NUMERIC(12,2) NOT NULL,
    peso_bruto NUMERIC(10,3),
    peso_neto NUMERIC(10,3)
);

CREATE TABLE pagos_venta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    metodo VARCHAR(30) NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    referencia_transaccion VARCHAR(100)
);

CREATE TABLE cortes_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    dispositivo_id UUID,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    estado VARCHAR(20) DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada')),
    fecha_apertura TIMESTAMPTZ NOT NULL,
    fecha_cierre TIMESTAMPTZ,
    monto_apertura NUMERIC(12,2) NOT NULL,
    total_efectivo_esperado NUMERIC(12,2) DEFAULT 0.00,
    total_efectivo_contado NUMERIC(12,2) DEFAULT 0.00,
    diferencia NUMERIC(12,2) DEFAULT 0.00,
    totales_por_metodo_pago JSONB DEFAULT '{}'::jsonb,
    observaciones TEXT
);

CREATE TABLE dispositivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE RESTRICT,
    nombre_alias VARCHAR(100) NOT NULL,
    modelo VARCHAR(100),
    sistema_operativo VARCHAR(100),
    token_dispositivo VARCHAR(255) UNIQUE NOT NULL,
    ultima_sincronizacion TIMESTAMPTZ,
    activo BOOLEAN DEFAULT TRUE
);
```

---

## 3. Row Level Security (RLS) en Supabase (Multi-Tenant)

Para garantizar aislamiento matemático entre empresas:

```sql
-- Activar RLS en todas las tablas sensibles
ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

-- Política de ejemplo para ventas: solo accesible por miembros del mismo tenant
CREATE POLICY tenant_isolation_ventas ON ventas
    FOR ALL
    USING (
        sucursal_id IN (
            SELECT s.id FROM sucursales s
            WHERE s.negocio_id = (current_setting('app.current_tenant_id', true))::UUID
        )
    );
```

---

## 4. Dockerización del Ecosistema

### 4.1 Backend (`Backend/Dockerfile`)
```dockerfile
# Multi-stage Dockerfile para NestJS
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

### 4.2 Frontend Web (`Frontend/Dockerfile`)
```dockerfile
# Multi-stage Dockerfile para Next.js 14+
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

### 4.3 Orquestación Local (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./Backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - redis

  frontend:
    build:
      context: ./Frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

---

## 5. Conexión y Despliegue en Vercel

1. **Variables de Entorno en Panel Vercel:**
   - `NEXT_PUBLIC_API_URL`: URL pública del Backend en producción.
   - `NEXT_PUBLIC_SUPABASE_URL`: Endpoint HTTPS del proyecto Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave pública anon para clientes web autorizados.
2. **Prohibición Estricta:**
   - Cero tokens en archivos de configuración (`vercel.json` o `.env` versionados).
   - En pipelines CI/CD, el comando `vercel --prod` se autentica exclusivamente usando `VERCEL_TOKEN` configurado como secret en GitHub Actions.

---

## 6. Blast Radius: Límites de Modificación de Archivos

Para evitar que el agente rompa partes funcionales o desconfigure el repositorio:

| Directorio / Archivo | Estado | Regla para la IA |
|---|---|---|
| `requirements.md` / `design.md` | **Solo Lectura** | Especificaciones maestras. No modificar sin aprobación del usuario. |
| `Backend/package.json` | **Restringido** | No instalar paquetes sin justificación. |
| `Backend/tests/` | **Extensible** | Se permite agregar nuevos specs, no borrar tests existentes. |
| `Backend/src/modules/` | **Área de Trabajo** | Creación ordenada de controladores, servicios y entidades. |
| `Frontend/` | **Área de Trabajo** | Implementación de vistas Next.js, IndexedDB y Web APIs. |
| `.env*`, `*.pem`, `*.key` | **Prohibido** | Ningún agente puede leer ni escribir credenciales reales. |

---

## 7. Contratos de API REST (24 Endpoints Exhaustivos)

Todos los endpoints exigen la cabecera `Authorization: Bearer <JWT>` salvo `/auth/login` y `/auth/pin-login`. Los endpoints de mutación aceptan la cabecera opcional `Idempotency-Key: <UUID>`.

### 7.1 Autenticación y Dispositivos
1. `POST /auth/login`: `{ email, password }` $\rightarrow$ `{ accessToken, refreshToken, user: { id, nombre, rol, negocioId, sucursalId } }` (HTTP 200/401).
2. `POST /auth/refresh`: `{ refreshToken }` o Cookie $\rightarrow$ `{ accessToken, refreshToken }` (HTTP 200/401).
3. `POST /auth/pin-login`: `{ sucursalId, pin, dispositivoId }` $\rightarrow$ `{ valid: true, user: { id, nombre, rol }, sessionToken }` (HTTP 200/401/429 por throttling).
4. `POST /devices/register`: `{ sucursalId, nombreAlias, modelo, sistemaOperativo }` $\rightarrow$ `{ id, tokenDispositivo, activo }` (HTTP 201/403).
5. `POST /devices/:id/heartbeat`: `{}` $\rightarrow$ `{ status: "ok", serverTime: ISOString }` (HTTP 200).

### 7.2 Catálogo y Clientes
6. `GET /catalog/sync`: Query `?sucursalId=<uuid>&syncToken=<timestamp>` $\rightarrow$ `{ productos: [], categorias: [], syncToken: ISOString, fullSync: boolean }`. Cacheado en Redis.
7. `GET/POST/PATCH /products`: CRUD de productos con validación DTO: `{ nombre, categoriaId, tipoVenta ('peso'|'unidad'), unidadMedida, precio, costoPromedio, codigoBarras, fotoUrl }`.
8. `GET/POST/PATCH /categories`: CRUD con `{ nombre, ordenVisualizacion }`.
9. `GET/POST/PATCH /customers`: `{ nombre, telefono, limiteCredito }`.
10. `GET /customers/:id/credit`: $\rightarrow$ `{ clienteId, limiteCredito, saldoFiado, cupoDisponible: (limiteCredito - saldoFiado), permiteVenta: boolean }`.
11. `GET/POST/PATCH /branches`: Gestión multi-sucursal por `negocio_id`.

### 7.3 Ventas, Cobro e Idempotencia
12. `POST /sales/sync`: Ingesta por lotes offline: `{ dispositivoId, ventas: [ { id (UUID client), sucursalId, cajeroId, clienteId, subtotal, descuento, total, metodoPago, fechaHoraDispositivo, detalles: [ { productoId, cantidad, precioUnitario, subtotalLinea, pesoBruto, pesoNeto } ], pagos: [ { metodo, monto, referenciaTransaccion } ] } ] }` $\rightarrow$ Retorna HTTP 200/202 con `{ procesadas: N, duplicadasIgnoradas: M, errores: [] }`. Idempotente por `venta.id`.
13. `POST /sales/:id/void`: `{ motivo, usuarioId }` $\rightarrow$ Cambia `estado = 'anulada'`, genera deltas inversos en `movimientos_inventario` (tipo: `'devolucion'`) y restaura existencias en `inventarios` y `lotes`.

### 7.4 Inventario, Lotes y Mermas (FEFO)
14. `POST /inventory/adjust`: `{ productoId, sucursalId, cantidadDelta, motivo, usuarioId, notas }` $\rightarrow$ Crea `MovimientoInventario`.
15. `GET /lots`: Query `?sucursalId=<uuid>&productoId=<uuid>&estado=activo` $\rightarrow$ Lista de lotes con stock disponible ordenados por `fechaVencimiento ASC`.
16. `GET /lots/:id/movements`: Historial cronológico de deducciones y adiciones del lote.
17. `GET /lots/expiring`: Query `?sucursalId=<uuid>&days=3` $\rightarrow$ Lotes con `fechaVencimiento <= NOW() + interval '3 days'`.
18. `POST /receptions`: `{ sucursalId, usuarioId, proveedor, fechaRecepcion, observaciones, lotes: [ { productoId, codigoLote, cantidadRecibida, costoUnitario, fechaVencimiento, temperaturaRecepcion, notas } ] }` $\rightarrow$ Crea `RecepcionMercancia` + N `Lotes` + N `MovimientosInventario` (tipo `'recepcion'`).

### 7.5 Turnos de Caja
19. `POST /cash-shifts/open`: `{ sucursalId, dispositivoId, usuarioId, montoApertura }` $\rightarrow$ `{ id, estado: 'abierta', fechaApertura, montoApertura }`.
20. `GET /cash-shifts/current`: Query `?dispositivoId=<uuid>` $\rightarrow$ `{ corteId, estado, montoApertura, ventasAcumuladas, efectivoEsperado }`.
21. `POST /cash-cuts`: `{ corteId, totalEfectivoContado, totalesPorMetodoPago, observaciones }` $\rightarrow$ Calcula `diferencia = contado - esperado`, sella `estado = 'cerrada'` e inmutable.

### 7.6 Analítica y Dashboards
22. `GET /reports/sales`: Query `?sucursalId=<uuid>&fechaInicio=<ISO>&fechaFin=<ISO>&agruparPor=categoria|producto|metodo` $\rightarrow$ Totales agregados, volumen en kg/unidades y margen bruto.
23. `GET /dashboard/owner`: $\rightarrow$ `{ ventasHoy, ventasAyer, margenBrutoPromedio, topProductos, alertasStockBajo, lotesPorVencer, desglosePagos, comparativoSucursales, ultimaSincronizacion }`.
24. `GET /dashboard/manager`: Query `?sucursalId=<uuid>` $\rightarrow$ `{ ventasTurnoActual, estadoCaja, inventarioCritico, lotesPorVencer, mermasHoy }`.

---

## 8. Arquitectura de Eventos de Dominio (DDD en Memoria)

Para mantener el backend modular y desacoplado, los módulos interactúan mediante `EventEmitter2` de NestJS sin referencias cruzadas directas:

| Evento de Dominio | Emisor | Escucha y Acción Realizada |
|---|---|---|
| `VentaCompletadaEvent` | `SalesModule` | `InventoryModule`: deduce stock por FEFO y genera deltas.<br>`DashboardModule`: invalida caché de métricas del día. |
| `VentaAnuladaEvent` | `SalesModule` | `InventoryModule`: genera deltas positivos de reversión y reabre lotes agotados. |
| `RecepcionCreadaEvent` | `InventoryModule` | `CatalogModule`: recalcula `costo_promedio` ponderado del producto.<br>`NotificationModule`: alerta si temperatura > 4°C. |
| `StockMinimoAlcanzadoEvent` | `InventoryModule` | `AlertModule`: genera alerta push/badge para gerente y dueño. |
| `LoteVencidoEvent` | Cron Diario | `AlertModule`: marca lote como `vencido` e inhabilita su selección en ventas. |
| `CorteCajaCerradoEvent` | `CashModule` | `AuditModule`: genera log inmutable y alerta si `diferencia != 0`. |

---

## 9. Estrategia de Caché en Memoria (Redis) y Colas de Tareas (BullMQ)

### 9.1 Namespaces de Claves en Redis
- `catalog:sucursal:{sucursalId}`: Hash del catálogo serializado en JSON (TTL: 3600s). Invalidación por evento de catálogo.
- `idempotency:{idempotencyKey}`: Hash con `{ status, responseBody, timestamp }` (TTL: 86400s / 24 horas).
- `rate_limit:{ip}:{endpoint}`: Contador entero para throttling (TTL: 60s).
- `user_session:{userId}:{dispositivoId}`: Metadatos de sesión activa y token hash (TTL: 7 días).
- `lock:inventory:{sucursalId}:{productoId}`: Redlock distribuido para evitar condiciones de carrera en deducción de lotes simultáneos (TTL: 5000ms).

### 9.2 Colas BullMQ y Workers Asíncronos
1. **`sales-sync-queue`:**
   - *Job:* Procesamiento de lotes de sincronización offline masivos.
   - *Configuración:* Concurrencia: 5 workers; Backoff exponencial: 2000ms base, 3 reintentos.
2. **`inventory-recalculation-queue`:**
   - *Job:* Recálculo en segundo plano de snapshots de inventario consolidado y costo promedio.
3. **`reports-export-queue`:**
   - *Job:* Generación de reportes PDF/Excel pesados de ventas históricas exportados a S3.

---

## 10. Índices de Rendimiento y Triggers en Supabase (PostgreSQL)

### 10.1 Índices Compuestos B-Tree
```sql
-- Búsqueda ultra-rápida de productos por código de barras o categoría en mostrador
CREATE INDEX idx_productos_negocio_codigo ON productos (negocio_id, codigo_barras);
CREATE INDEX idx_productos_categoria ON productos (categoria_id) WHERE activo = TRUE;

-- Optimización de deducción FEFO en lotes
CREATE INDEX idx_lotes_fefo ON lotes (producto_id, sucursal_id, fecha_vencimiento ASC) 
    WHERE estado = 'activo' AND cantidad_disponible > 0;

-- Consultas cronológicas de ventas y auditoría
CREATE INDEX idx_ventas_sucursal_fecha ON ventas (sucursal_id, fecha_hora_servidor DESC);
CREATE INDEX idx_movimientos_producto_fecha ON movimientos_inventario (producto_id, fecha_hora_dispositivo DESC);

-- Consultas de clientes y crédito fiado
CREATE INDEX idx_clientes_negocio ON clientes (negocio_id, saldo_fiado DESC);
```

### 10.2 Triggers Automatizados
- **Trigger `trg_actualizar_timestamp_inventario`:** Actualiza automáticamente `ultima_actualizacion = NOW()` y aumenta el contador optimista `version = version + 1` en la tabla `inventarios` ante cualquier mutación.

---

## 11. Políticas Completas de Row Level Security (RLS) en Supabase

Aislamiento formal por empresa (`tenant_id`):

```sql
-- Variable de sesión inyectada por el middleware de backend o Supabase Auth
-- SET LOCAL app.current_tenant_id = '<uuid-negocio>';

-- Políticas RLS para todas las tablas:
CREATE POLICY rls_sucursales ON sucursales FOR ALL USING (negocio_id = (current_setting('app.current_tenant_id', true))::UUID);
CREATE POLICY rls_usuarios ON usuarios FOR ALL USING (negocio_id = (current_setting('app.current_tenant_id', true))::UUID);
CREATE POLICY rls_categorias ON categorias FOR ALL USING (negocio_id = (current_setting('app.current_tenant_id', true))::UUID);
CREATE POLICY rls_productos ON productos FOR ALL USING (negocio_id = (current_setting('app.current_tenant_id', true))::UUID);
CREATE POLICY rls_clientes ON clientes FOR ALL USING (negocio_id = (current_setting('app.current_tenant_id', true))::UUID);

-- Políticas RLS basadas en pertenencia de sucursal:
CREATE POLICY rls_inventarios ON inventarios FOR ALL USING (
    sucursal_id IN (SELECT id FROM sucursales WHERE negocio_id = (current_setting('app.current_tenant_id', true))::UUID)
);
CREATE POLICY rls_lotes ON lotes FOR ALL USING (
    sucursal_id IN (SELECT id FROM sucursales WHERE negocio_id = (current_setting('app.current_tenant_id', true))::UUID)
);
CREATE POLICY rls_movimientos ON movimientos_inventario FOR ALL USING (
    sucursal_id IN (SELECT id FROM sucursales WHERE negocio_id = (current_setting('app.current_tenant_id', true))::UUID)
);
CREATE POLICY rls_ventas ON ventas FOR ALL USING (
    sucursal_id IN (SELECT id FROM sucursales WHERE negocio_id = (current_setting('app.current_tenant_id', true))::UUID)
);
CREATE POLICY rls_cortes ON cortes_caja FOR ALL USING (
    sucursal_id IN (SELECT id FROM sucursales WHERE negocio_id = (current_setting('app.current_tenant_id', true))::UUID)
);
```

---

## 12. Arquitectura del Frontend Web POS y Offline-First (Next.js + IndexedDB)

### 12.1 Estructura Next.js App Router (Dual Mode)
```
Frontend/
├── app/
│   ├── (admin)/               # Panel de Administración Web (Escritorio)
│   │   ├── dashboard/         # Dashboard del Dueño / Gerente
│   │   ├── catalogo/          # CRUD Productos, Categorías y Precios
│   │   ├── inventario/        # Stock por Lote, Mermas y Recepciones
│   │   ├── sucursales/        # Sedes y Dispositivos autorizados
│   │   └── reportes/          # Analítica consolidada de ventas
│   ├── (pos)/                 # Terminal POS de Mostrador (PWA Offline)
│   │   ├── login-pin/         # Login táctil rápido de 4 dígitos
│   │   ├── venta/             # Grid táctil, báscula en vivo y comanda
│   │   ├── cobro/             # Pantalla grande de pagos simples/mixtos
│   │   └── corte/             # Arqueo y cierre de turno
│   └── api/                   # Proxies locales y webhooks
├── lib/
│   ├── db/                    # Esquema Dexie.js (IndexedDB local)
│   ├── hardware/              # Drivers Web Serial y Web Bluetooth
│   └── sync/                  # Motor de sincronización local outbox
```

### 12.2 Esquema Local IndexedDB (Dexie.js) para Web POS
- `productos`: `id, negocioId, categoriaId, nombre, tipoVenta, precio, unidadMedida, codigoBarras, activo`.
- `categorias`: `id, nombre, ordenVisualizacion`.
- `lotes`: `id, productoId, codigoLote, fechaVencimiento, cantidadDisponible`.
- `ventas_outbox`: `id (UUID), payload, status ('pending'|'synced'|'error'), createdAt`.
- `turno_local`: `id, estado ('abierta'|'cerrada'), montoApertura, usuarioId`.

### 12.3 Interfaz de Abstracción de Hardware de Báscula (Web Serial / Bluetooth)
```typescript
export interface WeightReading {
  weightKg: number;
  isStable: boolean;
  rawString: string;
  timestamp: number;
}

export interface ScaleDriver {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  onWeightChange(callback: (reading: WeightReading) => void): void;
  zero(): Promise<void>;
  tare(): Promise<void>;
}
```

---

## 13. Arquitectura de la App Móvil / Tablet POS (React Native + WatermelonDB)

- **Base de Datos Local:** SQLite integrado mediante WatermelonDB con tablas sincronizadas `Product`, `Category`, `Lot`, `Sale`, `SaleDetail`, `InventoryMovement`.
- **Sincronización:** WatermelonDB Sync Protocol implementando endpoints `pullChanges` y `pushChanges` contra el Backend NestJS.
- **Hardware Bridge:** Módulo nativo Android para comunicación USB-Serial OTG (protocolo CH340 / FTDI) para básculas Torrey, CAS y Magellan.

---

## 14. Matriz de Ciberseguridad, Hardening y RBAC

### 14.1 Matriz de Control de Acceso Basado en Roles (RBAC)
| Permiso / Acción | Cajero | Gerente de Sucursal | Dueño / Administrador |
|---|:---:|:---:|:---:|
| Iniciar sesión con PIN en POS | ✅ | ✅ | ✅ |
| Registrar Venta y Cobro | ✅ | ✅ | ✅ |
| Apertura y Corte de su Caja | ✅ | ✅ | ✅ |
| Anular Venta del Turno | ❌ (Requiere PIN Supervisor) | ✅ | ✅ |
| Ingreso Manual de Peso (sin báscula) | ❌ | ✅ | ✅ |
| Registrar Merma | ❌ | ✅ | ✅ |
| Registrar Recepción de Lotes | ❌ | ✅ | ✅ |
| Modificar Precios de Catálogo | ❌ | ❌ | ✅ |
| Ver Métricas Consolidadas Multi-Sucursal | ❌ | ❌ (Solo su sede) | ✅ |
| Administrar Sucursales y Usuarios | ❌ | ❌ | ✅ |

### 14.2 Hardening de Servidor y Cabeceras HTTP
- `Helmet` configurado con CSP estricto: `default-src 'self'`.
- `HSTS`: `max-age=31536000; includeSubDomains; preload`.
- `CORS`: Restringido a orígenes verificados del tenant y dominios Vercel autorizados.
- `Rate Limiting`: 100 req/min general; 5 req/min en rutas de login.

---

## 15. Mapeo Exhaustivo de Skills en `.agent/` a la Solución

| Componente del Proyecto | Skills Primarias de `.agent/` | Skills Complementarias |
|---|---|---|
| **Arquitectura de Base de Datos y Supabase** | `supabase-postgres-best-practices`, `supabase` | `talleros-backend-engineer` |
| **Lógica Backend, ACID y Rendimiento** | `talleros-backend-engineer` | `Anthropic-Cybersecurity-Skills-main` |
| **Ciberseguridad, RLS y Manejo de Tokens** | `Anthropic-Cybersecurity-Skills-main` | `vercel-cli-with-tokens` |
| **Diseño UI/UX del POS y Ergonomía (3 Toques)** | `ui-ux-pro-max`, `ui-ux-pro-max-skill-main` | `design-system`, `web-design-guidelines` |
| **Estilos, Componentes Tailwind y Layouts** | `ui-styling`, `design-system`, `brand` | `frontend-design` |
| **Transiciones Rápidas en Mostrador Web** | `vercel-react-view-transitions` | `vercel-composition-patterns` |
| **Optimización y Despliegue en Vercel** | `deploy-to-vercel`, `vercel-optimize` | `vercel-react-best-practices` |
| **App Móvil / Tablet POS (React Native)** | `vercel-react-native-skills` | `ui-ux-pro-max` |
| **Documentación Técnica y Estándares** | `writing-guidelines` | `10k-websites` |

