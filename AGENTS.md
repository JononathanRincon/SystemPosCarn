# AGENTS.md — PROTOCOLO OPERATIVO PARA AGENTES DE IA (ANTIGRAVITY / GEMINI)
## Sistema POS Multi-Sucursal para Carnicerías

> **DIRECTIVA SUPREMA:** Este repositorio opera bajo un **Modo de Desarrollo Controlado, Seguro, Altamente Auditable y Profesional**. Cualquier instancia de agente de IA que inicie una sesión en este proyecto está **estrictamente obligada** a seguir este protocolo antes de ejecutar cualquier acción o escribir código.

---

## 1. Algoritmo Obligatorio de Arranque en Frío (Cold Start)

Cuando inicies una nueva conversación o sesión, ejecuta secuencialmente este flujo:

```mermaid
graph TD
    START[Inicio de Sesión del Agente] --> STEP1[1. Leer FASE_TRACKING.md]
    STEP1 --> STEP2[2. Buscar primer `[ ]` en tasks.md]
    STEP2 --> STEP3[3. Leer requerimiento en requirements.md]
    STEP3 --> STEP4[4. Leer esquema en design.md]
    STEP4 --> STEP5[5. Consultar skill en PLAN_IMPLEMENTACION.md]
    STEP5 --> STEP6[6. Implementar código según Blast Radius]
    STEP6 --> STEP7[7. Ejecutar tests automatizados - 100% verde]
    STEP7 --> STEP8[8. Mutar checkboxes `[x]` sin borrar líneas]
    STEP8 --> STEP9[9. Registrar entrada en AI_PROCESS.md]
```

1. **Identificar la Fase Activa:** Abre [FASE_TRACKING.md](file:///c:/Users/Galiatech/Documents/SystemPosCarns/FASE_TRACKING.md). La primera fase o módulo que tenga `[ ] ⏳ En Progreso` es el foco actual del proyecto.
2. **Localizar la Tarea Específica:** Abre [tasks.md](file:///c:/Users/Galiatech/Documents/SystemPosCarns/tasks.md) y busca la **primera tarea con checkbox sin marcar: `[ ]`**. Esa es tu ÚNICA tarea a ejecutar. Queda prohibido saltar tareas o ejecutar múltiples a la vez.
3. **Lectura Quirúrgica de Requerimientos (Cuidado de Contexto):**
   - Ve a [requirements.md](file:///c:/Users/Galiatech/Documents/SystemPosCarns/requirements.md) y lee **únicamente** las historias de usuario (US) y requisitos EARS indicados en la trazabilidad de la tarea.
   - **ESTÁ PROHIBIDO** leer el archivo `SDD_POS_Carniceria.md` completo para no saturar la ventana de contexto.
4. **Lectura de Especificación Técnica:**
   - Ve a [design.md](file:///c:/Users/Galiatech/Documents/SystemPosCarns/design.md) y consulta el esquema de base de datos, DTO, endpoint o patrón arquitectónico exacto de la tarea.
5. **Invocación de Skills de `.agent/`:**
   - Consulta la tabla de mapeo de skills en [PLAN_IMPLEMENTACION.md](file:///c:/Users/Galiatech/Documents/SystemPosCarns/PLAN_IMPLEMENTACION.md) y aplica las directrices de la skill correspondiente (ej. `Anthropic-Cybersecurity-Skills-main` para seguridad, `talleros-backend-engineer` para transacciones, `supabase` para base de datos).

---

## 2. Regla Inquebrantable de Inmutabilidad de Líneas

En los archivos de control ([PLAN_IMPLEMENTACION.md](file:///c:/Users/Galiatech/Documents/SystemPosCarns/PLAN_IMPLEMENTACION.md), [FASE_TRACKING.md](file:///c:/Users/Galiatech/Documents/SystemPosCarns/FASE_TRACKING.md) y [tasks.md](file:///c:/Users/Galiatech/Documents/SystemPosCarns/tasks.md)):
- **PROHIBICIÓN:** **Bajo ninguna circunstancia se debe borrar, eliminar o recortar texto existente.**
- **MUTACIÓN PERMITIDA:** Únicamente se modifican los caracteres de estado:
  - De `[ ]` a `[x]` cuando la tarea esté implementada y con pruebas al 100% pasando.
  - De `[ ]` a `[-] ⚠️ NO REALIZADA: [Justificación técnica]` si una tarea fue omitida o replanteada justificadamente.

---

## 3. Límites de Modificación de Código (Blast Radius)

El agente debe respetar estrictamente la tabla de permisos de archivos definida en `design.md`:
- **Archivos de Solo Lectura:** `requirements.md`, `design.md` (no mutar arquitectura sin orden del usuario).
- **Archivos Estrictamente Prohibidos:** `.env*`, `*.pem`, `*.key` (prohibido leer, crear o subir secretos en texto plano).
- **Áreas de Trabajo Autorizadas:** `Backend/src/modules/`, `Backend/tests/`, `Frontend/app/`, `Frontend/lib/`.
- **Modificación de Dependencias:** Prohibido instalar paquetes arbitrarios en `package.json` sin justificación explícita.

---

## 4. Criterio de Calidad Obligatorio (Quality Gate)

Ningún agente puede dar por terminada una tarea ni avanzar a la siguiente sin cumplir con:
1. **Ejecutar la prueba verificable** indicada en `tasks.md` (ej. `npm run test -- auth.service.spec.ts`).
2. **Asegurar que el 100% de las pruebas estén en verde**. Si un test falla, el agente debe corregir el código antes de continuar.
3. **Registrar la bitácora en `AI_PROCESS.md`** con la plantilla estandarizada:
   - Prompt recibido.
   - Output entregado.
   - Rama y commits creados.
   - Reporte cuantitativo de pruebas (pasadas / fallidas / cobertura).
   - Estado de la fase actualizado.

---

## 5. Resumen de la Estructura de Archivos del Harness

| Archivo | Rol en el Sistema | Instrucción para el Agente |
|---|---|---|
| `AGENTS.md` | **Constitución Operativa** | Leer al arrancar cualquier sesión (este archivo). |
| `tasks.md` | **Backlog Táctico de Micro-tareas** | Leer para saber la tarea inmediata de 20-30 min. |
| `requirements.md` | **Especificación Conceptual y EARS** | Leer solo las secciones de negocio requeridas. |
| `design.md` | **Diseño Técnico y Arquitectura** | Leer para seguir esquemas, APIs, Docker y Blast Radius. |
| `PLAN_IMPLEMENTACION.md` | **Hoja de Ruta y Mapeo de Skills** | Consultar para saber qué skill de `.agent/` invocar. |
| `FASE_TRACKING.md` | **Quality Gate por Fases** | Actualizar tras completar módulos completos. |
| `AI_PROCESS.md` | **Auditoría de IA** | Registrar cada interacción y reporte de testing. |
| `SDD_POS_Carniceria.md` | **Maestro Consolidado Histórico** | Referencia global pasiva. |
