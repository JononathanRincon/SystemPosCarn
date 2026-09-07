# AI_PROCESS.md

Registro de todo prompt usado para generar código, documentación o diseño con IA en este proyecto. Cada entrada debe permitir reproducir o auditar qué se generó, con qué modelo y con qué instrucción exacta.

---

## Entrada 1

- **Fecha:** 2026-09-06
- **Modelo/herramienta:** Claude Sonnet 5 (claude.ai)
- **Prompt utilizado (resumen del pedido, conversación completa disponible en el historial del proyecto):**
  ```
  Necesito crear una aplicación web y móvil como un sistema POS para una carnicería,
  para realizarlo de forma correcta: proceso, diseño del documento SDD, tecnología,
  arquitectura, diseño, proceso.

  Alcance: varias carnicerías, varios negocios (multi-tenant).
  La caja (POS) debe funcionar sin internet: offline-first, crítico.
  Tecnología: recomendación abierta (se evaluó React Native+Node/NestJS,
  Flutter+Serverpod, y Flutter+Node — se confirmó React Native + Node/NestJS
  como stack oficial).
  ```
- **Rama y commit(s):** pendiente (documento aún no versionado en el repo)
- **Qué se generó:** Estructura completa del SDD — introducción, arquitectura, diseño offline-first, stack tecnológico, modelo de datos, diseño de API, requisitos no funcionales, proceso de desarrollo, riesgos.

---

## Entrada 2

- **Fecha:** 2026-09-06
- **Modelo/herramienta:** Claude Sonnet 5 (claude.ai)
- **Prompt utilizado (resumen):**
  ```
  Detallar el modelo de datos del SDD: entidades, campos, tipos y relaciones,
  incluyendo diagrama entidad-relación (ERD).
  ```
- **Rama y commit(s):** pendiente
- **Qué se generó:** Modelo de datos detallado (16 entidades con campos y tipos) y diagrama ERD en formato Mermaid, agregados a la sección 6 del SDD.

---

## Entrada 3

- **Fecha:** 2026-09-06
- **Modelo/herramienta:** Claude Opus (destino del prompt — pendiente de ejecución)
- **Prompt utilizado (completo):**
  ```
  Rol: Eres un diseñador UI/UX senior y desarrollador frontend React experto en interfaces
  de punto de venta (POS) táctiles y paneles de administración responsivos. Antes de
  escribir cualquier código, carga y sigue estrictamente las skills del proyecto ubicadas
  en .agent/skills/: ui-ux-pro-max-skill-main, vercel-react-view-transitions,
  web-design-guidelines y design-system. Estas skills son la fuente de verdad para
  paleta, tipografía, espaciado, componentes y transiciones — no improvises un sistema
  de diseño propio si ya está definido ahí.

  Contexto: Estoy construyendo un sistema POS (punto de venta) para carnicerías,
  multi-negocio y multi-sucursal, que debe funcionar offline-first. El stack de
  producción es React Native + NestJS, pero este prototipo de wireframes se construye
  en React web solo para validar el diseño de UI antes de pasarlo a React Native.

  El sistema tiene TRES contextos de uso que deben quedar cubiertos por el mismo
  sistema de diseño, cada uno con su propio layout (no es un solo diseño que se encoge,
  son adaptaciones deliberadas por dispositivo):
  - Móvil (teléfono, ~375-430px): caja de respaldo o consulta rápida del cajero/gerente.
  - Tablet (~768-1200px, orientación horizontal): dispositivo POS principal en el
    mostrador — es el caso de uso primario y el que más detalle de interacción necesita.
  - Web/escritorio (>1200px): panel de administración (gerente/dueño del negocio) —
    gestión de sucursales, catálogo, reportes; layout de escritorio real, con
    navegación lateral y tablas, no una tablet estirada.

  Un intento anterior de wireframe no cumplió el estándar visual esperado (se sintió
  genérico/plano); esta vez el resultado debe reflejar un sistema de diseño real,
  consistente y con jerarquía visual clara, no un mockup de placeholder.

  Instrucción: Diseña y construye en React los wireframes de alta fidelidad de:

  A) El flujo completo de venta del POS (prioriza tablet, con adaptación a móvil),
     como pantallas navegables (usa vercel-react-view-transitions para las
     transiciones entre pantallas):
     1. Inicio de sesión con PIN (login rápido de cajero, pensado para uso offline)
     2. Pantalla de venta: categorías de producto (Res, Cerdo, Pollo, Embutidos),
        grilla de productos, y un bloque destacado con la lectura de la báscula en
        tiempo real (kg)
     3. Carrito de compra: líneas de producto con cantidad/peso y subtotal, total,
        botón "Cobrar"
     4. Pago: selección de método (efectivo, tarjeta, mixto), cálculo de cambio
     5. Confirmación de ticket: estado "pendiente de sincronizar" visible, opción de
        imprimir e iniciar nueva venta

  B) Una vista del panel de administración web (escritorio) equivalente: navegación
     lateral con Sucursales, Catálogo, Reportes; una tabla de ejemplo (ej. ventas por
     sucursal) y un dashboard con 2-3 métricas destacadas — para mostrar cómo el mismo
     sistema de diseño se comporta en desktop.

  Detalles/Restricciones:
  - Implementa los tres breakpoints explícitamente (móvil, tablet, escritorio) con
    layouts distintos, no solo reflow de una misma grilla.
  - Objetivo de uso en tablet/móvil: cajero de pie, posible uso con guantes, botones
    e inputs grandes y de alto contraste, máximo 3 toques para completar la venta de
    un producto por peso.
  - El estado "sin conexión / pendiente de sincronizar" debe ser visualmente explícito
    en toda la interfaz (POS y panel admin), nunca ambiguo con "ya sincronizado".
  - Sigue el sistema de color, tipografía y componentes definidos en design-system y
    web-design-guidelines — no introduzcas una paleta o tipografía nueva.
  - Entrega componentes React reutilizables y responsivos (no HTML estático de una
    sola pieza, no un layout fijo en px).

  Formato de salida: Código React funcional, organizado en componentes, con navegación
  entre las 5 pantallas del flujo POS y la vista de administración web. Antes del
  código, indica en una frase qué elementos de ui-ux-pro-max-skill-main y design-system
  aplicaste y por qué.

  Input: Modelo de datos de referencia — Producto (tipo_venta: peso o unidad, precio,
  categoría), Venta (subtotal, descuento, total, método de pago), DetalleVenta (cantidad,
  precio_unitario, peso_bruto/neto), Dispositivo (identifica la caja/tablet), Sucursal,
  Negocio (multi-tenant). El sistema es multi-tenant: cada negocio puede tener varias
  sucursales, cada sucursal varias cajas.
  ```
- **Rama y commit(s):** pendiente (ejecutar en `feature/wireframes-pos`)
- **Qué se generó:** Pendiente de ejecución — wireframes de alta fidelidad en React (POS tablet/móvil + panel admin web).

<!--
================================================================================
PLANTILLA ESQUELETO PARA NUEVAS ENTRADAS
(Copiar y completar este bloque al final del archivo cada vez que se ejecute un prompt de desarrollo)
================================================================================

## Entrada N

- **Fecha:** AAAA-MM-DD
- **Modelo/herramienta:** (ej. Claude Opus, Claude Sonnet, Antigravity / Gemini)
- **Prompt utilizado (completo):**
  ```text
  ...
  ```
- **Output del agente / Respuesta de la herramienta (mensaje final):**
  ```text
  ...
  ```
- **Acciones de Git:**
  - Rama: `feature/...` | `develop` | `main`
  - Commits: `hash — tipo(alcance): mensaje`
  - Estado del merge: Pendiente / Fusionado a develop
- **Reporte de pruebas automatizadas:**
  | Suite / Nivel | Total | ✅ Pasaron | ❌ Fallaron | Cobertura (%) |
  |---|---|---|---|---|
  | Unitarias | 0 | 0 | 0 | 0% |
  | Integración | 0 | 0 | 0 | 0% |
  | **Total** | **0** | **0** | **0** | **0%** |
- **Lista detallada de pruebas ejecutadas:**
  - [ ] `nombre-prueba.spec.ts`: Descripción del caso de prueba
- **Estado de Funcionalidad / Fase:** ✅ Realizada y probada / ⏳ En progreso / ❌ Bloqueada (ver FASE_TRACKING.md)
- **Qué se generó:** Archivos creados o modificados en la sesión.

---
-->

---

## Entrada 4

- **Fecha:** 2026-09-07
- **Modelo/herramienta:** Antigravity (Gemini 3.8 Flash)
- **Prompt utilizado (completo):**
  ```text
  Inicia la sesión ejecutando el Algoritmo de Arranque en Frío definido en AGENTS.md:

  1. Revisa FASE_TRACKING.md y localiza la primera tarea pendiente [ ] en tasks.md (TASK-04).
  2. Lee quirúrgicamente sus especificaciones en requirements.md y design.md (prohibido leer el SDD completo).
  3. Consulta PLAN_IMPLEMENTACION.md para activar las skills correspondientes de .agent/ (Anthropic-Cybersecurity-Skills-main y talleros-backend-engineer).
  4. Implementa el código de la tarea respetando el Blast Radius y ejecuta sus pruebas automatizadas hasta que el 100% esté en verde.
  5. Actualiza tasks.md (marcando [x] sin borrar líneas) y registra la entrada en AI_PROCESS.md.

  Actúa como Staff Software Engineer bajo el protocolo estricto de AGENTS.md.
  ```
- **Output del agente / Respuesta de la herramienta (mensaje final):**
  ```text
  TASK-04 completada exitosamente:
  - Implementada la entidad de dominio Usuario (`Usuario`) con validación de invariantes, validación de contraseñas y PIN, y serialización segura `toResponseDto()` que excluye password_hash y pin_pos_hash.
  - Creado el puerto de repositorio `UsuarioRepositoryPort`.
  - Implementado `HashingService` con bcrypt aplicando factor de costo mínimo de 10 (EARS-AUTH-01) y validación estricta de formato numérico de 4 dígitos para PIN POS (US-01).
  - Implementado `AuthService` y `AuthModule` para los flujos de autenticación Web y POS.
  - Ejecutada la suite de pruebas unitarias `auth.service.spec.ts` con 21/21 tests pasando al 100%.
  - Verificada la suite de guards `auth.guard.spec.ts` con 3/3 tests pasando.
  - Marcada TASK-04 con [x] en tasks.md y en PLAN_IMPLEMENTACION.md (2.1.1) sin alteración destructiva de líneas.
  ```
- **Acciones de Git:**
  - Rama: `N/A` (directorio local sin inicialización de repositorio git)
  - Commits: `N/A`
  - Estado del merge: `N/A`
- **Reporte de pruebas automatizadas:**
  | Suite / Nivel | Total | ✅ Pasaron | ❌ Fallaron | Cobertura (%) |
  |---|---|---|---|---|
  | Unitarias (auth.service) | 21 | 21 | 0 | 100% |
  | Unitarias (auth.guard) | 3 | 3 | 0 | 100% |
  | **Total** | **24** | **24** | **0** | **100%** |
- **Lista detallada de pruebas ejecutadas:**
  - [x] `auth.service.spec.ts`: EARS-AUTH-01: Hashing de contraseñas con bcrypt (cost factor >= 10, validación positiva, rechazo de password incorrecta, rechazo de password vacía o < 8 chars).
  - [x] `auth.service.spec.ts`: US-01 / EARS-AUTH-01: Hashing y validación de PIN POS de 4 dígitos (hashing con bcrypt salt 10+, validación positiva, rechazo de PIN erróneo, validación estricta de 4 dígitos numéricos).
  - [x] `auth.service.spec.ts`: Entidad Usuario (invariantes de dominio, validación de credenciales, exclusión de secretos en DTO de respuesta, estado activo/inactivo).
  - [x] `auth.service.spec.ts`: AuthService flujos web y POS (login web, login PIN, manejo de excepciones UnauthorizedException / BadRequestException, rotación inicial refreshTokens).
  - [x] `auth.guard.spec.ts`: RolesGuard y permisos de acceso para roles Administrador, Gerente y Cajero.
- **Estado de Funcionalidad / Fase:** ⏳ En progreso (Módulo 2.1 Autenticación - TASK-04 completada al 100%, pendiente TASK-05)
- **Qué se generó:**
  - `Backend/src/modules/auth/domain/entities/usuario.entity.ts` (Nueva)
  - `Backend/src/modules/auth/domain/ports/usuario-repository.port.ts` (Nueva)
  - `Backend/src/modules/auth/application/services/hashing.service.ts` (Nueva)
  - `Backend/src/modules/auth/application/services/auth.service.ts` (Nueva)
  - `Backend/src/modules/auth/auth.module.ts` (Nueva)
  - `Backend/tests/unit/auth/auth.service.spec.ts` (Actualizado con suite completa de 21 tests)
  - `tasks.md` (TASK-04 marcada con `[x]`)
  - `PLAN_IMPLEMENTACION.md` (Punto 2.1.1 marcado con `[x]`)
  - `AI_PROCESS.md` (Bitácora registrada)

---

## Entrada 5

- **Fecha:** 2026-09-07
- **Modelo/herramienta:** Antigravity (Gemini 3.8 Flash)
- **Prompt utilizado (completo):**
  ```text
  listo podemos continuar con la siguiente task
  ```
- **Output del agente / Respuesta de la herramienta (mensaje final):**
  ```text
  TASK-05 completada exitosamente:
  - Implementado DTOs para autenticación (`LoginDto`, `RefreshTokenDto`, `AuthTokensDto`, `LoginResponseDto`, `RefreshResponseDto`).
  - Implementado `TokenService` con emisión de Access Token (TTL 15m = 900s) y Refresh Token (TTL 7d = 604800s) según EARS-AUTH-02.
  - Implementada la rotación segura de tokens con detección de reutilización (Token Reuse Detection - Cybersecurity Skill) e invalidación inmediata del refresh token previo.
  - Actualizado `AuthService` con endpoints de aplicación `login()` y `refresh()`.
  - Implementado `AuthController` con endpoints HTTP `/auth/login` y `/auth/refresh` y soporte para cookies seguras HttpOnly (`SameSite=Strict`).
  - Actualizado `AuthModule` con registro de `JwtModule`, `TokenService` y `AuthController`.
  - Ejecutada la suite unitaria `auth.service.spec.ts` (15/15 tests pasando al 100%) y `auth.guard.spec.ts` (3/3 tests pasando al 100%).
  - Marcada TASK-05 con [x] en tasks.md y 2.1.2 en PLAN_IMPLEMENTACION.md sin alteración destructiva de líneas.
  ```
- **Acciones de Git:**
  - Rama: `N/A` (directorio local sin inicialización de repositorio git)
  - Commits: `N/A`
  - Estado del merge: `N/A`
- **Reporte de pruebas automatizadas:**
  | Suite / Nivel | Total | ✅ Pasaron | ❌ Fallaron | Cobertura (%) |
  |---|---|---|---|---|
  | Unitarias (auth.service) | 15 | 15 | 0 | 100% |
  | Unitarias (auth.guard) | 3 | 3 | 0 | 100% |
  | **Total** | **18** | **18** | **0** | **100%** |
- **Lista detallada de pruebas ejecutadas:**
  - [x] `auth.service.spec.ts`: TASK-04: Entidad Usuario y hashing de credenciales (bcrypt salt 10+, PIN POS 4 dígitos, serialización segura).
  - [x] `auth.service.spec.ts`: TASK-05: EARS-AUTH-02 Emisión de Tokens JWT (Access 15 min + Refresh 7 días con verificación de claims exp/iat).
  - [x] `auth.service.spec.ts`: TASK-05: Verificación de firma y rechazo de tokens manipulados.
  - [x] `auth.service.spec.ts`: TASK-05: Rotación segura de refresh tokens y detección de reutilización (Token Reuse Detection).
  - [x] `auth.service.spec.ts`: TASK-05: Login web con credenciales válidas, usuario inactivo, contraseña errónea y correo inexistente.
  - [x] `auth.service.spec.ts`: TASK-05: AuthController con configuración de cookie HttpOnly con SameSite Strict y rotación vía cookie/body.
  - [x] `auth.guard.spec.ts`: RolesGuard y permisos de acceso para roles Administrador, Gerente y Cajero.
- **Estado de Funcionalidad / Fase:** ⏳ En progreso (Módulo 2.1 Autenticación - TASK-04 y TASK-05 completadas al 100%, siguiente: TASK-06)
- **Qué se generó:**
  - `Backend/src/modules/auth/application/dtos/auth.dto.ts` (Nueva)
  - `Backend/src/modules/auth/application/services/token.service.ts` (Nueva)
  - `Backend/src/modules/auth/presentation/http/auth.controller.ts` (Nueva)
  - `Backend/src/modules/auth/application/services/auth.service.ts` (Actualizado con login y refresh)
  - `Backend/src/modules/auth/auth.module.ts` (Actualizado con JwtModule y AuthController)
  - `Backend/tests/unit/auth/auth.service.spec.ts` (Actualizado con suite completa de 15 tests)
  - `tasks.md` (TASK-05 marcada con `[x]`)
  - `PLAN_IMPLEMENTACION.md` (Punto 2.1.2 marcado con `[x]`)
  - `AI_PROCESS.md` (Bitácora registrada)
