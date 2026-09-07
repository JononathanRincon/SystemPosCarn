import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POSDatabase } from '@/lib/db/pos-database';
import type {
  ProductoLocal,
  CategoriaLocal,
  LoteLocal,
} from '@/lib/db/pos-database';
import {
  guardarCatalogoLocal,
  obtenerProductosLocales,
  obtenerCategoriasLocales,
} from '@/lib/db/repos/catalogo-repo';
import {
  encolarVentaOutbox,
  obtenerVentasPendientesSync,
  marcarVentaSincronizada,
  contarVentasPorEstado,
} from '@/lib/db/repos/venta-outbox-repo';
import {
  abrirTurnoLocal,
  obtenerTurnoAbierto,
  cerrarTurnoLocal,
} from '@/lib/db/repos/turno-repo';

// ────────────────────────────────────────────
// Helpers — cada test recibe su propia BD aislada
// ────────────────────────────────────────────

let db: POSDatabase;
let testDbCounter = 0;

async function setupTestDB(): Promise<POSDatabase> {
  testDbCounter++;
  db = new POSDatabase(`TestPOSDB_${testDbCounter}_${Date.now()}`);
  return db;
}

async function teardownTestDB(): Promise<void> {
  if (db) {
    db.close();
    await db.delete();
  }
}

// ────────────────────────────────────────────
// Datos de prueba
// ────────────────────────────────────────────

const categoriasTest: CategoriaLocal[] = [
  { id: 'cat-1', nombre: 'Res', ordenVisualizacion: 1 },
  { id: 'cat-2', nombre: 'Cerdo', ordenVisualizacion: 2 },
  { id: 'cat-3', nombre: 'Pollo', ordenVisualizacion: 3 },
];

const productosTest: ProductoLocal[] = [
  {
    id: 'prod-1',
    negocioId: 'neg-1',
    categoriaId: 'cat-1',
    nombre: 'Bistec de Res',
    tipoVenta: 'peso',
    precio: 189.5,
    unidadMedida: 'kg',
    codigoBarras: '7501234567890',
    activo: true,
  },
  {
    id: 'prod-2',
    negocioId: 'neg-1',
    categoriaId: 'cat-1',
    nombre: 'Arrachera',
    tipoVenta: 'peso',
    precio: 259.0,
    unidadMedida: 'kg',
    activo: true,
  },
  {
    id: 'prod-3',
    negocioId: 'neg-1',
    categoriaId: 'cat-2',
    nombre: 'Chuleta de Cerdo',
    tipoVenta: 'peso',
    precio: 119.0,
    unidadMedida: 'kg',
    activo: true,
  },
  {
    id: 'prod-4',
    negocioId: 'neg-1',
    categoriaId: 'cat-3',
    nombre: 'Pechuga de Pollo',
    tipoVenta: 'unidad',
    precio: 89.9,
    unidadMedida: 'pieza',
    activo: false, // Producto inactivo — no debe aparecer en consultas filtradas
  },
];

// ────────────────────────────────────────────
// Suite 1: Productos y Catálogo
// ────────────────────────────────────────────

describe('IndexedDB — Catálogo de Productos', () => {
  beforeEach(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await teardownTestDB();
  });

  it('debe insertar y consultar productos cárnicos por peso y unidad', async () => {
    await guardarCatalogoLocal(productosTest, categoriasTest, db);

    // Verificar que se insertaron todos los productos
    const total = await db.productos.count();
    expect(total).toBe(4);

    // Verificar producto por peso
    const bistec = await db.productos.get('prod-1');
    expect(bistec).toBeDefined();
    expect(bistec!.nombre).toBe('Bistec de Res');
    expect(bistec!.tipoVenta).toBe('peso');
    expect(bistec!.precio).toBe(189.5);
    expect(bistec!.unidadMedida).toBe('kg');

    // Verificar producto por unidad
    const pechuga = await db.productos.get('prod-4');
    expect(pechuga).toBeDefined();
    expect(pechuga!.tipoVenta).toBe('unidad');
    expect(pechuga!.unidadMedida).toBe('pieza');
  });

  it('debe filtrar productos activos por categoría', async () => {
    await guardarCatalogoLocal(productosTest, categoriasTest, db);

    // Solo productos activos de "Res" (cat-1)
    const productosRes = await obtenerProductosLocales('cat-1', db);
    expect(productosRes.length).toBe(2); // Bistec + Arrachera
    expect(productosRes.every((p) => p.categoriaId === 'cat-1')).toBe(true);
    expect(productosRes.every((p) => p.activo)).toBe(true);

    // Productos activos de "Pollo" (cat-3) — pechuga es inactiva
    const productosPollo = await obtenerProductosLocales('cat-3', db);
    expect(productosPollo.length).toBe(0);
  });

  it('debe obtener todos los productos activos sin filtro', async () => {
    await guardarCatalogoLocal(productosTest, categoriasTest, db);

    const todosActivos = await obtenerProductosLocales(undefined, db);
    expect(todosActivos.length).toBe(3); // 4 total - 1 inactivo
    expect(todosActivos.every((p) => p.activo)).toBe(true);
  });

  it('debe obtener categorías ordenadas por visualización', async () => {
    await guardarCatalogoLocal(productosTest, categoriasTest, db);

    const categorias = await obtenerCategoriasLocales(db);
    expect(categorias.length).toBe(3);
    expect(categorias[0].nombre).toBe('Res');
    expect(categorias[1].nombre).toBe('Cerdo');
    expect(categorias[2].nombre).toBe('Pollo');
  });

  it('debe actualizar productos existentes con bulkPut (upsert)', async () => {
    await guardarCatalogoLocal(productosTest, categoriasTest, db);

    // Actualizar precio del bistec
    const productosActualizados: ProductoLocal[] = [
      { ...productosTest[0], precio: 199.0 },
    ];
    await guardarCatalogoLocal(productosActualizados, [], db);

    const bistec = await db.productos.get('prod-1');
    expect(bistec!.precio).toBe(199.0);

    // Verificar que no se duplicó
    const total = await db.productos.count();
    expect(total).toBe(4);
  });
});

// ────────────────────────────────────────────
// Suite 2: Outbox de Ventas Offline
// ────────────────────────────────────────────

describe('IndexedDB — Outbox de Ventas', () => {
  beforeEach(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await teardownTestDB();
  });

  it('debe encolar una venta con status pending y consultarla', async () => {
    const payload = {
      items: [
        { productoId: 'prod-1', cantidad: 1.5, precioUnitario: 189.5 },
      ],
      total: 284.25,
      metodoPago: 'efectivo',
    };

    const ventaId = await encolarVentaOutbox(payload, db);
    expect(ventaId).toBeDefined();
    expect(typeof ventaId).toBe('string');

    // Verificar inserción
    const venta = await db.ventas_outbox.get(ventaId);
    expect(venta).toBeDefined();
    expect(venta!.status).toBe('pending');
    expect(JSON.parse(venta!.payload)).toEqual(payload);
  });

  it('debe listar ventas pendientes de sincronización (FIFO)', async () => {
    // Encolar 3 ventas
    await encolarVentaOutbox({ total: 100 }, db);
    await encolarVentaOutbox({ total: 200 }, db);
    await encolarVentaOutbox({ total: 300 }, db);

    const pendientes = await obtenerVentasPendientesSync(db);
    expect(pendientes.length).toBe(3);
    // FIFO: la primera encolada debe salir primero
    expect(JSON.parse(pendientes[0].payload).total).toBe(100);
    expect(JSON.parse(pendientes[2].payload).total).toBe(300);
  });

  it('debe marcar venta como sincronizada y excluirla de pendientes', async () => {
    const ventaId = await encolarVentaOutbox({ total: 150 }, db);

    // Marcar como sincronizada
    await marcarVentaSincronizada(ventaId, db);

    // Ya no debe aparecer en pendientes
    const pendientes = await obtenerVentasPendientesSync(db);
    expect(pendientes.length).toBe(0);

    // Pero sigue existiendo en la tabla con status 'synced'
    const venta = await db.ventas_outbox.get(ventaId);
    expect(venta!.status).toBe('synced');
  });

  it('debe contar ventas por estado correctamente', async () => {
    const id1 = await encolarVentaOutbox({ total: 100 }, db);
    await encolarVentaOutbox({ total: 200 }, db);
    await encolarVentaOutbox({ total: 300 }, db);

    await marcarVentaSincronizada(id1, db);

    const conteo = await contarVentasPorEstado(db);
    expect(conteo.pending).toBe(2);
    expect(conteo.synced).toBe(1);
    expect(conteo.error).toBe(0);
  });
});

// ────────────────────────────────────────────
// Suite 3: Turno de Caja Local
// ────────────────────────────────────────────

describe('IndexedDB — Turno de Caja Local', () => {
  beforeEach(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await teardownTestDB();
  });

  it('debe abrir un turno local con monto de apertura', async () => {
    const turnoId = await abrirTurnoLocal(500.0, 'user-cajero-1', db);

    const turno = await db.turno_local.get(turnoId);
    expect(turno).toBeDefined();
    expect(turno!.estado).toBe('abierta');
    expect(turno!.montoApertura).toBe(500.0);
    expect(turno!.usuarioId).toBe('user-cajero-1');
  });

  it('debe impedir abrir un segundo turno si ya hay uno abierto', async () => {
    await abrirTurnoLocal(500.0, 'user-cajero-1', db);

    await expect(
      abrirTurnoLocal(300.0, 'user-cajero-2', db)
    ).rejects.toThrow('Ya existe un turno abierto');
  });

  it('debe obtener el turno abierto activo', async () => {
    await abrirTurnoLocal(1000.0, 'user-admin', db);

    const turno = await obtenerTurnoAbierto(db);
    expect(turno).toBeDefined();
    expect(turno!.estado).toBe('abierta');
    expect(turno!.montoApertura).toBe(1000.0);
  });

  it('debe cerrar turno y permitir abrir uno nuevo', async () => {
    const turnoId = await abrirTurnoLocal(500.0, 'user-cajero-1', db);

    // Cerrar turno
    await cerrarTurnoLocal(turnoId, db);

    const turnoCerrado = await db.turno_local.get(turnoId);
    expect(turnoCerrado!.estado).toBe('cerrada');

    // Ya no hay turno abierto
    const turnoAbierto = await obtenerTurnoAbierto(db);
    expect(turnoAbierto).toBeUndefined();

    // Ahora se puede abrir uno nuevo
    const nuevoId = await abrirTurnoLocal(800.0, 'user-cajero-2', db);
    expect(nuevoId).toBeDefined();
  });
});

// ────────────────────────────────────────────
// Suite 4: Esquema y Tablas de la BD
// ────────────────────────────────────────────

describe('IndexedDB — Esquema de Base de Datos', () => {
  beforeEach(async () => {
    await setupTestDB();
  });

  afterEach(async () => {
    await teardownTestDB();
  });

  it('debe tener las 5 tablas definidas en design.md 12.2', () => {
    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'categorias',
      'lotes',
      'productos',
      'turno_local',
      'ventas_outbox',
    ]);
  });

  it('debe insertar y consultar lotes por productoId', async () => {
    const lote: LoteLocal = {
      id: 'lote-1',
      productoId: 'prod-1',
      codigoLote: 'L-2026-001',
      fechaVencimiento: '2026-09-15T00:00:00.000Z',
      cantidadDisponible: 25.5,
    };

    await db.lotes.add(lote);

    const lotes = await db.lotes
      .where('productoId')
      .equals('prod-1')
      .toArray();
    expect(lotes.length).toBe(1);
    expect(lotes[0].codigoLote).toBe('L-2026-001');
    expect(lotes[0].cantidadDisponible).toBe(25.5);
  });
});
