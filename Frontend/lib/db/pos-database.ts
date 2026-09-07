import Dexie, { type Table } from 'dexie';

/**
 * Esquema IndexedDB local para el módulo POS Web de mostrador.
 * Diseñado según design.md Sec. 12.2 para operación offline-first.
 *
 * Tablas:
 * - productos: Catálogo local sincronizado desde el backend.
 * - categorias: Categorías con orden de visualización para el grid táctil.
 * - lotes: Lotes activos con fechas de vencimiento (FEFO local).
 * - ventas_outbox: Cola de ventas pendientes de sincronización.
 * - turno_local: Estado del turno de caja abierto en esta terminal.
 */

// ────────────────────────────────────────────
// Interfaces de las tablas locales
// ────────────────────────────────────────────

export interface ProductoLocal {
  id: string;
  negocioId: string;
  categoriaId: string;
  nombre: string;
  tipoVenta: 'peso' | 'unidad';
  precio: number;
  unidadMedida: string;
  codigoBarras?: string;
  activo: boolean;
}

export interface CategoriaLocal {
  id: string;
  nombre: string;
  ordenVisualizacion: number;
}

export interface LoteLocal {
  id: string;
  productoId: string;
  codigoLote: string;
  fechaVencimiento: string; // ISO 8601
  cantidadDisponible: number;
}

export type VentaOutboxStatus = 'pending' | 'synced' | 'error';

export interface VentaOutbox {
  id: string; // UUID generado en el cliente
  payload: string; // JSON stringificado de la venta completa
  status: VentaOutboxStatus;
  createdAt: string; // ISO 8601
}

export type TurnoEstado = 'abierta' | 'cerrada';

export interface TurnoLocal {
  id: string;
  estado: TurnoEstado;
  montoApertura: number;
  usuarioId: string;
}

// ────────────────────────────────────────────
// Clase de Base de Datos Dexie
// ────────────────────────────────────────────

export class POSDatabase extends Dexie {
  productos!: Table<ProductoLocal, string>;
  categorias!: Table<CategoriaLocal, string>;
  lotes!: Table<LoteLocal, string>;
  ventas_outbox!: Table<VentaOutbox, string>;
  turno_local!: Table<TurnoLocal, string>;

  constructor(dbName = 'POSCarniceriaDB') {
    super(dbName);

    this.version(1).stores({
      productos:
        'id, negocioId, categoriaId, nombre, tipoVenta, precio, unidadMedida, codigoBarras, activo',
      categorias: 'id, nombre, ordenVisualizacion',
      lotes: 'id, productoId, codigoLote, fechaVencimiento, cantidadDisponible',
      ventas_outbox: 'id, status, createdAt, payload',
      turno_local: 'id, estado, montoApertura, usuarioId',
    });
  }
}

// ────────────────────────────────────────────
// Singleton de la base de datos
// ────────────────────────────────────────────

let dbInstance: POSDatabase | null = null;

/**
 * Obtiene la instancia singleton de la base de datos local.
 * En un entorno de pruebas, crear instancias directamente con `new POSDatabase(name)`.
 */
export function getDB(): POSDatabase {
  if (!dbInstance) {
    dbInstance = new POSDatabase();
  }
  return dbInstance;
}

/**
 * Resetea la instancia singleton (solo para tests).
 */
export function resetDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
