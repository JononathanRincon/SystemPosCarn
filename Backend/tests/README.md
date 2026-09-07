# Suite de Pruebas Automatizadas — Backend POS Carnicería

Este directorio contiene las pruebas automatizadas del Backend del sistema POS para carnicerías. Sigue la política de **Quality Gate** establecida en el [SDD](../SDD_POS_Carniceria.md) y en [FASE_TRACKING.md](../../FASE_TRACKING.md): **no se permite continuar con fases o funcionalidades subsiguientes sin que el 100% de las pruebas estén en verde.**

---

## 📁 Estructura de Directorios

```
tests/
├── unit/                       # Pruebas unitarias por módulo
│   ├── auth/                   # Login web, PIN offline, JWT, guards
│   ├── catalog/                # Negocio, Sucursal, Categoria, Producto, Usuario
│   ├── ventas/                 # Venta, DetalleVenta, Pagos simples y mixtos
│   ├── inventario/             # Stock, MovimientoInventario (deltas), Mermas
│   ├── sync/                   # Sincronización idempotente, resolución de conflictos
│   ├── corte-caja/             # Apertura, cierre y diferencias de caja
│   └── common/                 # Excepciones, validaciones comunes
├── integration/                # Pruebas de integración y flujos completos
│   ├── venta-completa.integration.spec.ts
│   ├── sync-offline.integration.spec.ts
│   ├── sync-conflicto.integration.spec.ts
│   ├── multi-tenant.integration.spec.ts
│   ├── corte-caja.integration.spec.ts
│   └── catalogo-sync.integration.spec.ts
├── helpers/                    # Mock data factories y utilidades de test
│   ├── mock-data.helper.ts
│   ├── test-database.helper.ts
│   └── test-app.helper.ts
└── README.md                   # Esta guía
```

---

## 🚀 Comandos de Ejecución

Una vez instaladas las dependencias con `npm install`:

```bash
# Ejecutar todas las pruebas (unitarias + integración)
npm test

# Ejecutar únicamente pruebas unitarias
npm run test:unit

# Ejecutar únicamente pruebas de integración
npm run test:integration

# Ejecutar con reporte de cobertura de código
npm run test:cov

# Modo interactivo en desarrollo
npm run test:watch
```

---

## 🎯 Umbrales de Cobertura (Quality Gates)

| Módulo | Cobertura Mínima Exigida |
|---|---|
| **Ventas (`src/ventas/`)** | $\ge 90\%$ |
| **Inventario (`src/inventario/`)** | $\ge 90\%$ |
| **Sincronización (`src/sync/`)** | $\ge 90\%$ |
| **Cobertura Global del Backend** | $\ge 80\%$ |
