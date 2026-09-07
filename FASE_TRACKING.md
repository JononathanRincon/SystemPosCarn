# FASE_TRACKING.md — Control de Fases y Funcionalidades
## Sistema POS Multi-Sucursal para Carnicerías

Este documento actúa como el **Quality Gate Oficial** del proyecto. Ninguna fase ni funcionalidad se marcará como realizada sin que el 100% de sus pruebas automatizadas asociadas hayan pasado exitosamente.

---

### Convenciones de Estado:
- `[x] ✅ Realizada y Probada`: Código implementado + pruebas unitarias e integración en verde (100%).
- `[ ] ⏳ En Progreso`: En desarrollo o pruebas pendientes de verificación.
- `[ ] ❌ Bloqueada`: Fallas de pruebas pendientes de resolver. No se permite iniciar la siguiente funcionalidad.

---

## Fase 1 — Diseño, Arquitectura y Calidad

- [x] ✅ **1.1 Documento SDD (Software Design Document)**
  - [x] Contexto y objetivo de negocio a alto nivel (`SDD_POS_Carniceria.md` sec. 1)
  - [x] Soporte dual en Web: Panel Admin + Módulo POS de Mostrador (sec. 2 y 5)
  - [x] Arquitectura de monolito modular y sincronización offline-first (sec. 3, 4 y 5)
  - [x] Modelo de datos detallado con 18 entidades y ERD Mermaid (sec. 6)
  - [x] Diseño preliminar de API (sec. 7)
  - [x] Historias de Usuario para Cajero, Gerente y Dueño (sec. 8)
  - [x] Requisitos Funcionales con Notación EARS completa (Ubicuo, Event-driven, State-driven, Unwanted behavior, Optional) (sec. 9)
  - [x] Requisitos No Funcionales ampliados (sec. 10)
  - [x] Casos Límite (Edge Cases) definidos (sec. 13)
  - [x] Fuera de Alcance (Out of Scope) explícito para el MVP (sec. 14)
  - [x] Criterios de Aceptación y Finalización (Definition of Done - DoD) (sec. 15)
  - [x] Sección de Preguntas Abiertas / Dudas técnicas resueltas (sec. 16)
- [x] ✅ **1.2 Plan de Pruebas y Criterios de Calidad**
  - [x] Principio de avance por fase (Gate de Calidad) documentado (sec. 11.3.1)
  - [x] Definición de niveles de prueba: unitarias, integración, sync offline, hardware (sec. 11.3.2)
  - [x] Matriz de cobertura y escenarios críticos por módulo (sec. 11.3.3)
  - [x] Umbrales de cobertura mínima (≥90% crítico, ≥80% general) (sec. 11.3.4)
- [x] ✅ **1.3 Suite y Estructura de Pruebas Automatizadas**
  - [x] Configuración de Jest, TypeScript y scripts en `Backend/`
  - [x] Tests unitarios estructurados por módulo en `Backend/tests/unit/`
  - [x] Tests de integración y escenarios offline en `Backend/tests/integration/`
  - [x] Helpers y generadores de datos ficticios en `Backend/tests/helpers/`
- [x] ✅ **1.4 Trazabilidad de Desarrollo Asistido por IA**
  - [x] Plantilla esqueleto estandarizada lista en `AI_PROCESS.md` (Input + Output + Git + Tests + Fase)
  - [x] Preparada para registrar las entradas a medida que inicie el desarrollo
- [x] ✅ **1.5 Dashboard Financiero y Operativo**
  - [x] Dashboard del Dueño: 8 widgets con KPIs financieros y operativos (sec. 7.5)
  - [x] Dashboard del Gerente: 5 widgets de resumen operativo de sucursal (sec. 7.5)
  - [x] Vista del Cajero: acceso directo al POS sin dashboard (sec. 7.5)
  - [x] Endpoints de dashboard documentados: `/dashboard/owner`, `/dashboard/manager` (sec. 7)
- [x] ✅ **1.6 Inventario por Lote y Trazabilidad FEFO**
  - [x] Entidad `Lote` con 16 campos (sec. 6.3)
  - [x] Entidad `RecepcionMercancia` con 8 campos (sec. 6.3)
  - [x] Flujo FEFO documentado en prosa (sec. 6.3)
  - [x] Modificaciones a `MovimientoInventario` (+lote_id), `Merma` (+lote_id, +dispositivo_id), `Cliente` (+limite_credito), `CorteDeCaja` (+estado)
  - [x] 5 Requisitos EARS para Lotes: EARS-LOTE-01 a 05 (sec. 9.6)
  - [x] 4 User Stories: US-15 a US-18 (sec. 8.5)
  - [x] 4 Edge Cases nuevos para lotes (sec. 13)
  - [x] Endpoints de lotes documentados: `/lots`, `/lots/:id/movements`, `/lots/expiring`, `/receptions` (sec. 7)
- [x] ✅ **1.7 Directrices UX y Flujo de Usuario**
  - [x] Mapa de navegación por rol con diagrama Mermaid (sec. 7.6.1)
  - [x] Flujo de venta en 3 toques documentado (sec. 7.6.2)
  - [x] Flujo de recepción de mercancía documentado (sec. 7.6.3)
  - [x] 12 directrices UX obligatorias (sec. 7.6.4)
- [x] ✅ **1.8 Corrección de Brechas Técnicas del SDD**
  - [x] API expandida de 7 a 24 endpoints (sec. 7)
  - [x] EARS-CAJA-04 y EARS-CAJA-05 agregados (sec. 9.5)
  - [x] EARS-DASH-01 a 03 para reportes (sec. 9.7)
  - [x] Nota sobre seguridad de descarga de PIN (sec. 7)
  - [x] Nota sobre tratamiento fiscal futuro (sec. 14)
  - [x] Preguntas abiertas PA-06 a PA-08 cerradas (sec. 16)
  - [x] ERD Mermaid actualizado con 18 entidades (sec. 6.6)


---

## Fase 2 — Backend Enterprise Completo (Solución Completa)

> **Criterio de Desbloqueo:** Fase 1 debe estar 100% aprobada.

### 2.1 Módulo Autenticación & Seguridad
- [x] ✅ **Autenticación Básica Web y POS**
  - [x] Implementación de servicio de Auth (JWT + Refresh Tokens)
  - [x] Login offline por PIN de 4 dígitos para cajeros (Móvil y Web POS)
  - [x] Guards de roles y permisos
  - [x] **Pruebas Unitarias:** `Backend/tests/unit/auth/auth.service.spec.ts`
  - [x] **Pruebas de Seguridad/Guard:** `Backend/tests/unit/auth/auth.guard.spec.ts`

### 2.2 Módulo Catálogo & Multi-Tenant
- [x] ✅ **Aislamiento de Negocio y Sucursal**
  - [x] Entidades y servicios de Negocio, Sucursal, Usuario
  - [x] Filtro y aislamiento multi-tenant por fila (`tenant_id`)
  - [x] **Pruebas de Catálogo:** `Backend/tests/unit/catalog/*.spec.ts`
  - [x] **Pruebas de Aislamiento:** `Backend/tests/integration/multi-tenant.integration.spec.ts`

- [ ] ⏳ **Catálogo de Productos y Categorías**
  - [ ] Categorías con orden de visualización para POS
  - [ ] Productos por peso (precisión 3 decimales en kg) y por unidad
  - [ ] **Pruebas de Producto:** `Backend/tests/unit/catalog/producto.service.spec.ts`

### 2.3 Módulo Ventas & Pagos (Core POS Móvil y Web)
- [ ] ⏳ **Registro de Venta y Detalle**
  - [ ] Creación de venta con UUID generado en terminal (Tablet, Celular o Web POS)
  - [ ] Snapshot inmutable de precios en `DetalleVenta`
  - [ ] Cálculo de subtotal, descuentos y total
  - [ ] **Pruebas Unitarias de Venta:** `Backend/tests/unit/ventas/venta.service.spec.ts`
  - [ ] **Pruebas de Detalle:** `Backend/tests/unit/ventas/detalle-venta.service.spec.ts`

- [ ] ⏳ **Procesamiento de Pagos**
  - [ ] Pago en efectivo con cálculo de cambio
  - [ ] Pagos mixtos (efectivo + tarjeta sumando total exacto)
  - [ ] **Pruebas de Pago:** `Backend/tests/unit/ventas/pago-venta.service.spec.ts`

### 2.4 Módulo Inventario & Mermas
- [ ] ⏳ **Control de Stock por Deltas**
  - [ ] Tabla de `MovimientoInventario` con deltas (`+` / `-`)
  - [ ] Descuento automático de stock tras venta
  - [ ] Registro de mermas (corte, vencimiento, merma operativa)
  - [ ] Alertas de stock mínimo por sucursal
  - [ ] **Pruebas de Inventario:** `Backend/tests/unit/inventario/inventario.service.spec.ts`
  - [ ] **Pruebas de Movimientos:** `Backend/tests/unit/inventario/movimiento.service.spec.ts`
  - [ ] **Pruebas de Merma:** `Backend/tests/unit/inventario/merma.service.spec.ts`

### 2.5 Módulo Sincronización Offline-First
- [ ] ⏳ **Motor de Sincronización Idempotente (Móvil y Web PWA)**
  - [ ] Endpoint `/sales/sync` idempotente por UUID
  - [ ] Endpoint `/catalog/sync` con tokens temporales
  - [ ] Manejo de concurrencia y stock negativo sin bloquear caja
  - [ ] **Pruebas de Sync Unitarias:** `Backend/tests/unit/sync/sync.service.spec.ts`
  - [ ] **Pruebas de Resolución de Conflictos:** `Backend/tests/unit/sync/conflicto.service.spec.ts`
  - [ ] **Prueba de Integración Offline:** `Backend/tests/integration/sync-offline.integration.spec.ts`
  - [ ] **Prueba de Integración Concurrente:** `Backend/tests/integration/sync-conflicto.integration.spec.ts`

### 2.6 Módulo Corte de Caja
- [ ] ⏳ **Apertura y Cierre de Turno**
  - [ ] Apertura con base inicial en efectivo
  - [ ] Cuadre de caja por método de pago (`contado - esperado`)
  - [ ] **Pruebas de Corte de Caja:** `Backend/tests/unit/corte-caja/corte-caja.service.spec.ts`
  - [ ] **Prueba de Integración de Flujo de Caja:** `Backend/tests/integration/corte-caja.integration.spec.ts`

### 2.7 Módulo Lotes & Recepciones de Mercancía
- [ ] ⏳ **Inventario por Lote (FEFO)**
  - [ ] Entidad `Lote` implementada con campos completos
  - [ ] Entidad `RecepcionMercancia` implementada
  - [ ] Lógica FEFO (First Expired, First Out) para descuento automático de lotes en ventas
  - [ ] Distribución multi-lote cuando un lote no cubre la cantidad vendida
  - [ ] Cambio automático de estado a `agotado` cuando `cantidad_disponible = 0`
  - [ ] Proceso de vencimiento automático (marcar lotes expirados)
  - [ ] Endpoints: `/lots`, `/lots/:id/movements`, `/lots/expiring`, `/receptions`
  - [ ] **Pruebas Unitarias:** `Backend/tests/unit/inventario/lote.service.spec.ts`
  - [ ] **Pruebas Unitarias:** `Backend/tests/unit/inventario/recepcion.service.spec.ts`
  - [ ] **Pruebas de Integración:** `Backend/tests/integration/lote-fefo.integration.spec.ts`

### 2.8 Módulo Dashboard (API de Reportes)
- [ ] ⏳ **Dashboard del Dueño y Gerente**
  - [ ] Endpoint `/dashboard/owner`: ventas consolidadas, márgenes, alertas, comparativo
  - [ ] Endpoint `/dashboard/manager`: resumen operativo por sucursal
  - [ ] Queries de agregación optimizadas (índices, materialización parcial)
  - [ ] **Pruebas Unitarias:** `Backend/tests/unit/dashboard/dashboard.service.spec.ts`
  - [ ] **Pruebas de Integración:** `Backend/tests/integration/dashboard.integration.spec.ts`

### 2.9 Módulo Eventos de Dominio (DDD) y Caché Redis
- [ ] ⏳ **Desacoplamiento y Rendimiento**
  - [ ] Bus de eventos `EventEmitter2` implementado
  - [ ] Patrón Cache-Aside en Redis para catálogo por sucursal
  - [ ] Invalidación proactiva de caché ante cambios
  - [ ] **Pruebas Unitarias:** `Backend/tests/unit/common/events.spec.ts`

### 2.10 Módulo Ciberseguridad Avanzada y Observabilidad
- [ ] ⏳ **Hardening y Monitoreo**
  - [ ] Throttling con `@nestjs/throttler` en endpoints sensibles
  - [ ] Logs canónicos estructurados JSON con `pino-http`
  - [ ] Middleware `X-Correlation-ID` propagado
  - [ ] **Pruebas de Seguridad:** `Backend/tests/unit/common/security.spec.ts`

---

## Fase 3 — Aplicación Web Dual: Panel de Administración y Módulo POS de Mostrador

> **Criterio de Desbloqueo:** Fase 2 debe tener el 100% de tests en verde.

- [ ] ⏳ **Módulo POS Web en el navegador (Mostrador PC/Laptop):**
  - [ ] Interfaz táctil y de teclado optimizada para computadoras de mostrador
  - [ ] Persistencia offline local en navegador mediante IndexedDB / RxDB y Service Workers
  - [ ] Integración de pesaje vía Web Serial / Web Bluetooth API
  - [ ] Impresión directa de tickets de venta
- [ ] ⏳ **Panel de Administración Web:**
  - [ ] Dashboard centralizado multi-sucursal por negocio
  - [ ] Gestión y auditoría de múltiples terminales (Tablets, Celulares y Web POS)
  - [ ] Reportes analíticos de ventas y márgenes por producto y corte
  - [ ] Distribución de catálogos y listas de precios

---

## Fase 4 — App Móvil y Tablet POS (React Native)

> **Criterio de Desbloqueo:** Fase 3 validada en Web.

- [ ] ⏳ **Base de Datos Local y Offline:**
  - [ ] Esquema SQLite con WatermelonDB
  - [ ] Modelos de datos para productos, lotes y ventas
- [ ] ⏳ **Terminal POS Táctil Móvil:**
  - [ ] Layout ergonómico para tablets de mostrador
  - [ ] Integración con báscula serial/bluetooth
  - [ ] Impresión de tickets térmicos ESC/POS
- [ ] ⏳ **Sincronización:**
  - [ ] Worker de sincronización outbox en segundo plano
  - [ ] App de consulta gerencial para móvil

---

## Fase 5 — Piloto en Tienda Real, Ciberseguridad y Despliegue

> **Criterio de Desbloqueo:** Fases anteriores al 100% con tests en verde.

- [ ] ⏳ Auditoría de ciberseguridad, escaneo de secretos y validación RLS en Supabase
- [ ] ⏳ Despliegue automatizado de Frontend Web en Vercel
- [ ] ⏳ Puesta en producción de Backend NestJS y Redis en contenedores Docker
- [ ] ⏳ Validación en 1 carnicería física durante 4 semanas con hardware real
- [ ] ⏳ Monitoreo de alertas de inventario y logs de sync

