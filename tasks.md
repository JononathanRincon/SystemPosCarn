# Tasks Backlog — Sistema POS Multi-Sucursal para Carnicerías
**Micro-Tareas Acotadas de Desarrollo (Sprints de 20 a 30 Minutos)**

> **Instrucción para Agentes de IA:**
> 1. Trabajar **estrictamente en una tarea a la vez** en orden secuencial.
> 2. Leer únicamente las secciones pertinentes de `requirements.md` y `design.md` antes de implementar.
> 3. Ejecutar las pruebas asociadas antes de marcar el checkbox `[x]`.
> 4. Registrar la culminación de la tarea en `FASE_TRACKING.md` y en `AI_PROCESS.md`.

---

## Bloque 1: Entorno, Infraestructura y Base de Datos (Supabase + Docker)

- [x] **TASK-01: Configuración de Variables de Entorno Seguras y Conexión Supabase**
  - *Objetivo:* Crear plantilla `.env.example` con variables para Supabase (`DATABASE_URL` con puerto 6543 y SSL), Redis, Vercel y JWT.
  - *Trazabilidad:* NFR-Seguridad, EARS-AUTH-01.
  - *Entregable:* Archivo `.env.example` y `.env` en Backend y Frontend; verificación de `.gitignore` blindado.

- [x] **TASK-02: Scripts de Migración Inicial SQL para Supabase con RLS**
  - *Objetivo:* Crear script de migración con las tablas base de `design.md` (negocios, sucursales, usuarios, productos, inventarios, lotes, ventas) y políticas RLS iniciales.
  - *Trazabilidad:* `design.md` Sec. 2 y 3.
  - *Entregable:* `Backend/src/database/migrations/001_initial_schema.sql` y `Backend/prisma/schema.prisma` completos.

- [x] **TASK-03: Dockerfiles Multi-stage y Docker-Compose**
  - *Objetivo:* Configurar `Dockerfile` de producción para NestJS en `Backend/`, `Dockerfile` para Next.js en `Frontend/` y `docker-compose.yml` en la raíz.
  - *Trazabilidad:* `design.md` Sec. 4.
  - *Entregable:* `Backend/Dockerfile`, `Frontend/Dockerfile` y `docker-compose.yml` listos para compilar en contenedores aislados.

---

## Bloque 2: Backend — Módulo de Autenticación & Seguridad

- [x] **TASK-04: Entidad Usuario y Hashing de Credenciales**
  - *Objetivo:* Crear entidad `Usuario` con bcrypt para contraseñas (salt 10) y hash para PIN POS de 4 dígitos.
  - *Trazabilidad:* EARS-AUTH-01, US-01.
  - *Prueba Verificable:* `npm run test -- auth.service.spec.ts` (pruebas de hasheo).

- [x] **TASK-05: Emisión y Renovación de Tokens JWT (Access + Refresh)**
  - *Objetivo:* Implementar endpoint `/auth/login` y `/auth/refresh` con rotación segura de tokens.
  - *Trazabilidad:* EARS-AUTH-02.
  - *Prueba Verificable:* Pruebas de expiración y refresh en `auth.service.spec.ts`.

- [x] **TASK-06: Validación Local de PIN POS y Bloqueo por Intentos Fallidos**
  - *Objetivo:* Implementar endpoint `/auth/pin-login` y lógica de bloqueo tras 3 intentos erróneos durante 60s.
  - *Trazabilidad:* EARS-AUTH-03, EARS-AUTH-04.
  - *Prueba Verificable:* `npm run test -- auth.guard.spec.ts`.

---

## Bloque 3: Backend — Catálogo y Multi-Tenant

- [x] **TASK-07: Aislamiento Multi-Tenant en Servicios de Catálogo**
  - *Objetivo:* Crear servicios de `Negocio`, `Sucursal` y middleware/interceptor para inyectar `tenant_id` en todas las consultas.
  - *Trazabilidad:* NFR-Aislamiento, US-10.
  - *Prueba Verificable:* `npm run test -- multi-tenant.integration.spec.ts`.

- [x] **TASK-08: CRUD de Categorías y Productos con Soporte de Peso/Unidad**
  - *Objetivo:* Implementar CRUD para `Categoria` y `Producto` validando tipos (`peso` / `unidad`) y precisión de 3 decimales en kg.
  - *Trazabilidad:* EARS-VENTA-01, US-03.
  - *Prueba Verificable:* `npm run test -- producto.service.spec.ts`.

---

## Bloque 4: Backend — Inventario, Recepciones y Lotes (FEFO)

- [x] **TASK-09: Entidades Lote y RecepcionMercancia**
  - *Objetivo:* Implementar entidades TypeORM/Prisma para `Lote` y `RecepcionMercancia` con campos de costo, proveedor, vencimiento y temperatura.
  - *Trazabilidad:* EARS-LOTE-01, US-15.
  - *Prueba Verificable:* `npm run test -- inventario.service.spec.ts`.

- [x] **TASK-10: Algoritmo de Despacho Automático FEFO en Ventas**
  - *Objetivo:* Implementar servicio que descuenta automáticamente del lote con `fecha_vencimiento ASC` al registrar una venta, dividiendo entre lotes si es necesario.
  - *Trazabilidad:* EARS-LOTE-02, EARS-LOTE-04, US-18.
  - *Prueba Verificable:* Crear y ejecutar `Backend/tests/integration/lote-fefo.integration.spec.ts`.

- [ ] **TASK-11: Registro de Mermas Vinculadas a Lote**
  - *Objetivo:* Implementar servicio de mermas con motivos obligatorios y asociación opcional a `lote_id`.
  - *Trazabilidad:* EARS-INV-04, US-07.
  - *Prueba Verificable:* `npm run test -- merma.service.spec.ts`.

---

## Bloque 5: Backend — Ventas, Pagos y Turnos de Caja

- [ ] **TASK-12: Ciclo de Turno de Caja (Apertura con Base y Cierre)**
  - *Objetivo:* Implementar endpoints `/cash-shifts/open`, `/cash-shifts/current` y `/cash-cuts` con cálculo de diferencia.
  - *Trazabilidad:* EARS-CAJA-02, EARS-CAJA-03, EARS-CAJA-04, US-06.
  - *Prueba Verificable:* `npm run test -- corte-caja.integration.spec.ts`.

- [ ] **TASK-13: Creación de Venta con Snapshot Inmutable de Precios y Pagos Mixtos**
  - *Objetivo:* Endpoint de creación de venta, validación de total vs pagos y congelación de precio unitario en `DetalleVenta`.
  - *Trazabilidad:* EARS-VENTA-01, EARS-VENTA-04, US-04.
  - *Prueba Verificable:* `npm run test -- venta-completa.integration.spec.ts`.

---

## Bloque 6: Backend — Sincronización Offline-First

- [ ] **TASK-14: Endpoint Idempotente `/sales/sync`**
  - *Objetivo:* Procesar lote de ventas con UUIDs de cliente, garantizando que transacciones duplicadas respondan HTTP 200 sin doble inserción.
  - *Trazabilidad:* EARS-SYNC-01, EARS-SYNC-04, US-05.
  - *Prueba Verificable:* `npm run test -- sync-offline.integration.spec.ts`.

- [ ] **TASK-15: Manejo de Concurrencia de Inventario y Alertas de Stock Negativo**
  - *Objetivo:* Aplicar deltas concurrentes y emitir alerta si el stock consolidado queda en negativo sin bloquear la venta.
  - *Trazabilidad:* EARS-SYNC-05, PA-02.
  - *Prueba Verificable:* `npm run test -- sync-conflicto.integration.spec.ts`.

---

## Bloque 7: Backend — Dashboard API de Métricas

- [ ] **TASK-16: Endpoints de Dashboard para Dueño y Gerente**
  - *Objetivo:* Crear endpoints `/dashboard/owner` (ventas, márgenes, comparativo) y `/dashboard/manager` (operación sucursal) con timestamp de sync.
  - *Trazabilidad:* EARS-DASH-01, EARS-DASH-02, US-13, US-14.
  - *Prueba Verificable:* Tests de integración de dashboard con datos agregados.

---

## Bloque 8: Backend — Eventos de Dominio (DDD) y Caché Redis
*Skills:* `.agent/talleros-backend-engineer`, `.agent/supabase-postgres-best-practices`

- [ ] **TASK-17: Bus de Eventos en Memoria (`EventEmitter2`)**
  - *Objetivo:* Desacoplar ventas e inventario mediante eventos de dominio (`VentaCompletadaEvent`, `VentaAnuladaEvent`, `RecepcionCreadaEvent`).
  - *Trazabilidad:* `design.md` Sec. 8.
  - *Prueba Verificable:* `npm run test -- event-emitter.spec.ts`.

- [ ] **TASK-18: Cache-Aside de Catálogo en Redis e Invalidación Reactiva**
  - *Objetivo:* Cachear catálogo por sucursal en Redis con TTL 1h e invalidación proactiva al mutar productos o categorías.
  - *Trazabilidad:* `design.md` Sec. 1.3 y 9.1.
  - *Prueba Verificable:* `npm run test -- catalog-cache.spec.ts`.

---

## Bloque 9: Backend — Seguridad Avanzada, Rate Limiting y Observabilidad
*Skills:* `.agent/Anthropic-Cybersecurity-Skills-main`, `.agent/talleros-backend-engineer`

- [ ] **TASK-19: Throttling de PIN y Rate Limiting en Endpoints Sensibles**
  - *Objetivo:* Configurar `@nestjs/throttler` en rutas de login y PIN (5 req/min) y protección global (100 req/min).
  - *Trazabilidad:* EARS-AUTH-04, `design.md` Sec. 14.2.
  - *Prueba Verificable:* `npm run test -- rate-limit.spec.ts`.

- [ ] **TASK-20: Logs Canónicos JSON y Correlation IDs (`X-Correlation-ID`)**
  - *Objetivo:* Middleware de `pino-http` que inyecte `X-Correlation-ID` en cada log y trace de petición.
  - *Trazabilidad:* `design.md` Sec. 1.7.
  - *Prueba Verificable:* Inspección de formato estructurado JSON en logger interceptor.

---

## Bloque 10: Frontend Web — Estructura Next.js 14, PWA e IndexedDB
*Skills:* `.agent/deploy-to-vercel`, `.agent/ui-ux-pro-max`, `.agent/design-system`

- [ ] **TASK-21: Inicialización de Proyecto Next.js 14 y Tailwind CSS**
  - *Objetivo:* Estructurar App Router en `Frontend/` con soporte para rutas duales `app/(admin)` y `app/(pos)`.
  - *Trazabilidad:* `design.md` Sec. 12.1.
  - *Prueba Verificable:* `npm run build` en `Frontend/` generando bundle standalone.

- [ ] **TASK-22: Configuración de Base de Datos Local IndexedDB con Dexie.js**
  - *Objetivo:* Crear cliente Dexie.js con tablas `productos`, `categorias`, `lotes`, `ventas_outbox` y `turno_local`.
  - *Trazabilidad:* `design.md` Sec. 12.2.
  - *Prueba Verificable:* Tests de inserción y consulta local en IndexedDB.

---

## Bloque 11: Frontend Web POS — Terminal de Mostrador y Hardware
*Skills:* `.agent/web-design-guidelines`, `.agent/ui-styling`, `.agent/vercel-react-view-transitions`

- [ ] **TASK-23: Pantalla de Venta Ergonómica en 3 Toques**
  - *Objetivo:* Grid táctil de productos cárnicos con fotos, comanda lateral en tiempo real y fuentes $\ge 48\text{px}$.
  - *Trazabilidad:* US-02, US-03, NFR-Usabilidad, `design.md` Sec. 12.
  - *Prueba Verificable:* Validación de flujo de comanda con componentes React.

- [ ] **TASK-24: Driver de Báscula (Web Serial API & Web Bluetooth)**
  - *Objetivo:* Implementar interfaz `ScaleDriver` para captura automática de peso en kilogramos con 3 decimales.
  - *Trazabilidad:* EARS-VENTA-02, US-02, `design.md` Sec. 12.3.
  - *Prueba Verificable:* Mock de lectura serial y asignación automática al carrito.

- [ ] **TASK-25: Modal de Cobro Multimetodo e Impresión de Tickets**
  - *Objetivo:* Interfaz de pagos simples y mixtos con cálculo de cambio e integración de impresión térmica ESC/POS.
  - *Trazabilidad:* EARS-VENTA-04, US-04, NFR-Rendimiento.
  - *Prueba Verificable:* Simulación de cobro e impresión de voucher.

---

## Bloque 12: Frontend Web Admin — Dashboards y Gestión de Lotes
*Skills:* `.agent/ui-ux-pro-max`, `.agent/vercel-optimize`, `.agent/brand`

- [ ] **TASK-26: Dashboard Ejecutivo de Dueño y Gerente**
  - *Objetivo:* Widgets analíticos de ventas del día, márgenes brutos, gráfico de dona de pagos y alertas de lotes por vencer.
  - *Trazabilidad:* EARS-DASH-01, EARS-DASH-02, US-13, US-14.
  - *Prueba Verificable:* Renderizado de métricas y filtros por sucursal.

- [ ] **TASK-27: Módulo de Recepción de Mercancía y Lotes**
  - *Objetivo:* Formulario de ingreso de camión con verificación de temperatura, proveedor y fechas de caducidad.
  - *Trazabilidad:* EARS-LOTE-01, US-15, US-16.
  - *Prueba Verificable:* Validación de creación de lotes en interfaz web.

---

## Bloque 13: Mobile & Tablet POS (React Native)
*Skills:* `.agent/vercel-react-native-skills`, `.agent/ui-ux-pro-max`

- [ ] **TASK-28: Configuración Base React Native y WatermelonDB**
  - *Objetivo:* Configurar esquema SQLite local y modelos WatermelonDB en `mobile/`.
  - *Trazabilidad:* `design.md` Sec. 13.
  - *Prueba Verificable:* Compilación y test unitario de esquema WatermelonDB.

- [ ] **TASK-29: Pantalla de Venta Táctil Horizontal para Tablets**
  - *Objetivo:* Layout optimizado para cajero de pie con botones $\ge 64\text{px}$ y alto contraste.
  - *Trazabilidad:* NFR-Ergonomía, US-01, US-03.
  - *Prueba Verificable:* Snapshot test de interfaz tablet en React Native.

- [ ] **TASK-30: Sincronización en Segundo Plano y Driver Serial Nativo**
  - *Objetivo:* Integración de `react-native-serialport` para básculas y sincronizador bidireccional outbox.
  - *Trazabilidad:* EARS-SYNC-02, EARS-SYNC-03, US-05.
  - *Prueba Verificable:* Simulación de cola outbox y conexión serial.

---

## Bloque 14: Pruebas E2E, Despliegue en Vercel y Producción
*Skills:* `.agent/deploy-to-vercel`, `.agent/vercel-cli-with-tokens`, `.agent/Anthropic-Cybersecurity-Skills-main`

- [ ] **TASK-31: Validación de Quality Gate Completo (100% Tests en Verde)**
  - *Objetivo:* Ejecución de toda la suite de pruebas unitarias y de integración del backend y frontend.
  - *Trazabilidad:* DoD Sec. 15, `FASE_TRACKING.md`.
  - *Prueba Verificable:* Reporte de Jest con cobertura $\ge 90\%$ en core y 100% de suites pasando.

- [ ] **TASK-32: Despliegue Automatizado en Vercel (Frontend Web)**
  - *Objetivo:* Configurar pipeline CI/CD en Vercel con variables de entorno seguras inyectadas.
  - *Trazabilidad:* `design.md` Sec. 5.
  - *Prueba Verificable:* Build exitoso en Vercel preview/production.

- [ ] **TASK-33: Puesta en Producción de Backend y Redis en Contenedores**
  - *Objetivo:* Despliegue de imágenes Docker en entorno de staging/producción con Supabase en vivo.
  - *Trazabilidad:* `design.md` Sec. 4.
  - *Prueba Verificable:* Healthcheck exitoso en `GET /devices/:id/heartbeat`.

