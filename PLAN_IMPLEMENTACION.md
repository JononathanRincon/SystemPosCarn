# PLAN DE IMPLEMENTACIÓN MAESTRO POR FASES
## Sistema POS Multi-Sucursal para Carnicerías (Solución Enterprise Completa)

> **REGLA DE ORO DE INMUTABILIDAD:** Este documento es un registro histórico protegido. **QUEDA ESTRICTAMENTE PROHIBIDO ELIMINAR O BORRAR LÍNEAS DE ESTE ARCHIVO**. El progreso se registra únicamente cambiando el estado de los checkboxes:
> - `[ ]`: Tarea pendiente de desarrollo y pruebas.
> - `[x]`: Tarea completada, probada al 100% y verificada.
> - `[-] ⚠️ NO REALIZADA: [Motivo]`: Tarea descartada o ajustada justificadamente, preservando el registro.

---

## MAPEO DE SKILLS DISPONIBLES EN `.agent/`

Para asegurar la máxima calidad sin degradar la memoria del agente, cada fase y tarea debe invocar su skill especializada correspondiente:

| Dominio Técnico | Skill en `.agent/` | Cuándo y Dónde se Utiliza |
|---|---|---|
| **Ciberseguridad y Hardening** | `Anthropic-Cybersecurity-Skills-main` | Endpoints de autenticación, saneamiento DTOs, tokens JWT/cookies HttpOnly, políticas RLS y auditoría. |
| **Base de Datos y PostgreSQL** | `supabase`, `supabase-postgres-best-practices` | Diseño de migraciones, índices optimizados, pooling Supavisor, funciones PL/pgSQL y Row Level Security. |
| **Ingeniería Backend Senior** | `talleros-backend-engineer` | Transacciones ACID, arquitectura DDD, BullMQ, Redis Cache-Aside, circuit breakers y observabilidad JSON. |
| **Sistema de Diseño y Ergonomía** | `ui-ux-pro-max`, `design-system`, `ui-styling` | Componentes visuales, paleta de colores WCAG AAA, tokens de diseño y layouts táctiles. |
| **Directrices Web y Accesibilidad** | `web-design-guidelines`, `frontend-design` | Flujo de venta en 3 toques, navegación lateral limpia, atajos de teclado y formularios optimizados. |
| **Transiciones y Fluidez** | `vercel-react-view-transitions` | Microinteracciones y transiciones de alto rendimiento entre catálogo, báscula y pantalla de cobro. |
| **Despliegue y Optimización Vercel** | `deploy-to-vercel`, `vercel-optimize`, `vercel-composition-patterns`, `vercel-cli-with-tokens` | Configuración de Edge Middleware, SSR, variables de entorno seguras y CI/CD en Vercel. |
| **Mobile y React Native** | `vercel-react-native-skills` | Arquitectura mobile para tablets de mostrador, SQLite local con WatermelonDB y serialización de báscula. |

---

## FASE 1: ARQUITECTURA, INFRAESTRUCTURA Y ENTORNOS (COMPLETADA)
*Skills asociadas:* `.agent/supabase`, `.agent/Anthropic-Cybersecurity-Skills-main`

- [x] **1.1 Definición de Modelo Conceptual y Requisitos:** Creación de `requirements.md` con historias de usuario (US-01 a US-18) y notación EARS.
- [x] **1.2 Especificación de Diseño Técnico:** Creación de `design.md` con esquemas físicos, Docker, Vercel, Supabase y Blast Radius.
- [x] **1.3 Backlog Táctico de Tareas:** Creación de `tasks.md` con micro-tareas de 20-30 min.
- [x] **1.4 Blindaje de Seguridad en Control de Versiones:** Creación de `.gitignore` preservando explícitamente `!.agent/` y bloqueando credenciales.
- [x] **1.5 Configuración de Entornos:** Creación de `.env.example` y `.env` en Backend y Frontend con Supabase (`DATABASE_URL` puerto 6543 y `DIRECT_URL` puerto 5432).
- [x] **1.6 Esquema de Base de Datos Maestro:** Creación de `Backend/prisma/schema.prisma` y `Backend/src/database/migrations/001_initial_schema.sql` con 18 tablas y RLS activado.
- [x] **1.7 Contenedores Docker:** Creación de `Backend/Dockerfile`, `Frontend/Dockerfile` y `docker-compose.yml` (Backend + Frontend + Redis).

---

## FASE 2: BACKEND CORE ENTERPRISE (SOLUCIÓN COMPLETA)
*Skills asociadas:* `.agent/talleros-backend-engineer`, `.agent/Anthropic-Cybersecurity-Skills-main`, `.agent/supabase-postgres-best-practices`

### 2.1 Módulo Autenticación, Seguridad y RBAC
- [x] **2.1.1 Modelo de Usuarios y Hashing de Contraseñas:** Servicio con `bcrypt` (salt factor 10+) para web y hash para PIN POS de 4 dígitos.
- [x] **2.1.2 Emisión y Rotación de Tokens JWT:** Endpoints `/auth/login` y `/auth/refresh` con cookies `HttpOnly`, `Secure`, `SameSite=Strict`.
- [x] **2.1.3 Autenticación Offline por PIN y Throttling:** Endpoint `/auth/pin-login` con bloqueo tras 3 intentos fallidos durante 60 segundos.
- [x] **2.1.4 Sistema de Autorización Basado en Roles (RBAC):** Guards granulares (`RolesGuard`, `PermissionsGuard`) para cajero, gerente y administrador.

### 2.2 Módulo Multi-Tenant y Catálogo Avanzado
- [x] **2.2.1 Aislamiento Multi-Tenant Estricto:** Middleware de extracción de `tenant_id` y aplicación forzada de políticas RLS en Supabase.
- [ ] **2.2.2 CRUD de Sucursales y Dispositivos:** Gestión de sedes y registro seguro de terminales POS con generación de `token_dispositivo`.
- [x] **2.2.3 Catálogo de Categorías y Productos Cárnicos:** Soporte para productos por peso (precisión al gramo `decimal(10,3)`) y por unidad.
- [x] **2.2.4 Cache-Aside de Catálogo en Redis:** Inyección de Redis para lectura rápida del catálogo (TTL 1h) con invalidación reactiva al actualizar precios.

### 2.3 Módulo de Ventas, Comandas y Facturación ACID
- [x] **2.3.1 Creación de Venta Atómica:** Transacción `prisma.$transaction` que congela el snapshot inmutable de precios en `DetalleVenta`.
- [x] **2.3.2 Motor de Pagos Múltiples:** Pagos simples y mixtos (efectivo, tarjeta, transferencia, fiado) validando que la suma coincida con el total.
- [ ] **2.3.3 Gestión de Clientes y Validación de Cupo Fiado:** Control estricto de crédito (`limite_credito - saldo_fiado`) impidiendo sobregiro.
- [x] **2.3.4 Anulación de Venta con Reversión de Stock:** Endpoint `/sales/:id/void` con trazabilidad completa sin borrado físico.

### 2.4 Módulo de Inventario por Lote, Mermas y Despacho FEFO
- [x] **2.4.1 Recepción de Mercancía por Lotes:** Registro de camión/proveedor creando `RecepcionMercancia` y múltiples `Lotes` con fecha de vencimiento y temperatura.
- [x] **2.4.2 Algoritmo de Despacho Automático FEFO:** Descuento automático de existencias priorizando el lote con caducidad más cercana en cada venta.
- [x] **2.4.3 Registro de Mermas Operativas:** Clasificación por desposte, vencimiento, daño o evaporación con vínculo opcional a lote y foto URL.
- [x] **2.4.4 Control de Alertas de Stock Crítico y Lotes por Vencer:** Emisión de alertas cuando existencias $\le$ mínimo o caducidad $\le$ 3 días.

### 2.5 Módulo de Cortes de Caja y Auditoría
- [x] **2.5.1 Apertura de Turno con Base Inicial:** Endpoint `/cash-shifts/open` con base de efectivo obligatoria; bloqueo de ventas si la caja está cerrada.
- [x] **2.5.2 Conciliación de Turno y Cuadre de Caja:** Endpoint `/cash-cuts` con cálculo de diferencia inmutable (`contado - esperado`).
- [x] **2.5.3 Ingresos y Egresos de Caja (Gastos Operativos y Materia Prima):** Registro de entradas de efectivo (inyección base, abonos) y egresos de caja (compra de carne/ganado/materia prima, fletes, insumos, hielo, servicios) con 10 categorías operativas, validación de saldo disponible y deducción en cálculo de efectivo esperado en corte.

### 2.6 Motor de Sincronización Offline-First Idempotente
- [x] **2.6.1 Endpoint Idempotente `/sales/sync`:** Ingesta de lotes de transacciones generadas offline con UUIDs de cliente evitando duplicidad.
- [ ] **2.6.2 Cola Asíncrona con BullMQ:** Amortiguación de ráfagas masivas de sincronización respondiendo HTTP 202 a los terminales.
- [ ] **2.6.3 Descarga de Catálogo Incremental (`/catalog/sync`):** Descarga de deltas por sync token temporal.
- [x] **2.6.4 Resolución Concurrente de Inventario y Alertas Negativas:** Aplicación determinista de deltas sin bloquear cajas.

### 2.7 Módulo de Observabilidad y API de Dashboards
- [x] **2.7.1 Logs Canónicos y Correlation IDs:** Middleware de `pino-http` inyectando `X-Correlation-ID` en cada petición y log JSON.
- [x] **2.7.2 Endpoint `/dashboard/owner`:** Métricas consolidadas de ventas, márgenes brutos, ranking de productos y comparativo de sedes.
- [x] **2.7.3 Endpoint `/dashboard/manager`:** Resumen operativo de la sucursal activa (caja, mermas, stock crítico).

---

## FASE 3: APLICACIÓN WEB DUAL (NEXT.JS EN VERCEL)
*Skills asociadas:* `.agent/ui-ux-pro-max`, `.agent/design-system`, `.agent/web-design-guidelines`, `.agent/deploy-to-vercel`, `.agent/vercel-optimize`

### 3.1 Terminal POS Web de Mostrador (PWA Offline)
- [x] **3.1.1 Persistencia Offline con IndexedDB:** Almacenamiento local de catálogo y ventas en navegador mediante Dexie/RxDB.
- [x] **3.1.2 Flujo de Venta Ergonómico en 3 Toques:** Selección de corte cárnico, confirmación al carrito y cobro rápido con fuentes $\ge 48\text{px}$.
- [x] **3.1.3 Conectividad Directa con Básculas (Web Serial / Web Bluetooth API):** Lectura de peso en vivo sin digitación manual.
- [x] **3.1.4 Atajos de Teclado:** Configuración de teclas de función `F1`-`F12`, `Enter` para cobrar y `Esc` para cancelar.
- [x] **3.1.5 Impresión Térmica de Tickets:** Emisión de comprobantes en impresoras ESC/POS (58mm/80mm).

### 3.2 Panel de Administración Web
- [x] **3.2.1 Dashboard Financiero de Dueño y Gerente:** Widgets analíticos, gráficos de dona por método de pago y alertas visuales.
- [ ] **3.2.2 Gestión Integral de Catálogo y Precios:** CRUD con subida de fotos y orden de visualización.
- [x] **3.2.3 Módulo de Recepción de Mercancía y Lotes:** Interfaz para ingreso de camión con verificación de temperatura y vencimientos.
- [ ] **3.2.4 Navegación Ergonómica:** Sidebar colapsable ($\le 7$ opciones), breadcrumbs y barra de búsqueda global `Ctrl+K`.

---

## FASE 4: APP MÓVIL Y TABLET POS (REACT NATIVE)
*Skills asociadas:* `.agent/vercel-react-native-skills`, `.agent/ui-ux-pro-max`

- [ ] **4.1 Configuración Base React Native y WatermelonDB:** Base de datos SQLite local para operación 100% offline.
- [ ] **4.2 Pantalla de Venta Adaptada a Tablets de Mostrador:** Layout horizontal para cajero de pie, botones táctiles $\ge 64\text{px}$.
- [ ] **4.3 Integración de Hardware Móvil:** Driver de báscula serial/bluetooth y escáner de códigos de barras.
- [ ] **4.4 Worker de Sincronización en Segundo Plano:** Envío automático de cola outbox hacia `/sales/sync` al detectar internet.
- [ ] **4.5 App Móvil de Consulta Gerencial:** Consulta rápida de ventas en tiempo real desde el celular del dueño.

---

## FASE 5: PRUEBAS E2E, CIBERSEGURIDAD Y DESPLIEGUE EN PRODUCCIÓN
*Skills asociadas:* `.agent/Anthropic-Cybersecurity-Skills-main`, `.agent/deploy-to-vercel`, `.agent/vercel-cli-with-tokens`

- [ ] **5.1 Quality Gate de Pruebas Automatizadas:** 100% de tests unitarios y de integración en verde (cobertura $\ge 90\%$ en core).
- [ ] **5.2 Auditoría de Ciberseguridad y Escaneo de Secretos:** Verificación contra OWASP Top 10, validación de RLS en Supabase y escaneo de secretos.
- [ ] **5.3 Despliegue de Frontend Web en Vercel:** Integración continua automatizada con variables de entorno inyectadas en panel.
- [ ] **5.4 Despliegue de Backend y Redis en Contenedores:** Puesta en marcha en infraestructura de producción mediante Docker multi-stage.
- [ ] **5.5 Pruebas de Campo con Hardware Real:** Validación en carnicería física durante 4 semanas.
