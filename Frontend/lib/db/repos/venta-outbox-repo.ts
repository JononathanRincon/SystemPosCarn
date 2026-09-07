import { getDB } from '@/lib/db/pos-database';
import type { POSDatabase, VentaOutbox, VentaOutboxStatus } from '@/lib/db/pos-database';

/**
 * Repositorio de la cola outbox de ventas offline.
 * Las ventas se generan localmente en el POS y se encolan como 'pending'
 * hasta que el motor de sincronización las envíe al endpoint /sales/sync.
 */

let lastTimestamp = 0;

function getMonotonicIsoString(): string {
  let now = Date.now();
  if (now <= lastTimestamp) {
    now = lastTimestamp + 1;
  }
  lastTimestamp = now;
  return new Date(now).toISOString();
}

/**
 * Encola una venta generada en mostrador con estado 'pending'.
 *
 * @param ventaPayload - Objeto de venta completo a serializar y encolar.
 * @param dbOverride - Instancia de BD opcional (para testing).
 * @returns El ID de la venta encolada.
 */
export async function encolarVentaOutbox(
  ventaPayload: Record<string, unknown>,
  dbOverride?: POSDatabase
): Promise<string> {
  const db = dbOverride ?? getDB();

  const id = crypto.randomUUID();
  const entry: VentaOutbox = {
    id,
    payload: JSON.stringify(ventaPayload),
    status: 'pending',
    createdAt: getMonotonicIsoString(),
  };

  await db.ventas_outbox.add(entry);
  return id;
}

/**
 * Obtiene todas las ventas pendientes de sincronización (status = 'pending').
 * Ordenadas por fecha de creación ASC (FIFO).
 *
 * @param dbOverride - Instancia de BD opcional (para testing).
 */
export async function obtenerVentasPendientesSync(
  dbOverride?: POSDatabase
): Promise<VentaOutbox[]> {
  const db = dbOverride ?? getDB();
  return db.ventas_outbox
    .where('status')
    .equals('pending' satisfies VentaOutboxStatus)
    .sortBy('createdAt');
}

/**
 * Marca una venta como sincronizada exitosamente.
 *
 * @param ventaId - UUID de la venta a marcar.
 * @param dbOverride - Instancia de BD opcional (para testing).
 */
export async function marcarVentaSincronizada(
  ventaId: string,
  dbOverride?: POSDatabase
): Promise<void> {
  const db = dbOverride ?? getDB();
  await db.ventas_outbox.update(ventaId, {
    status: 'synced' satisfies VentaOutboxStatus,
  });
}

/**
 * Marca una venta como con error de sincronización.
 *
 * @param ventaId - UUID de la venta con error.
 * @param dbOverride - Instancia de BD opcional (para testing).
 */
export async function marcarVentaConError(
  ventaId: string,
  dbOverride?: POSDatabase
): Promise<void> {
  const db = dbOverride ?? getDB();
  await db.ventas_outbox.update(ventaId, {
    status: 'error' satisfies VentaOutboxStatus,
  });
}

/**
 * Obtiene el conteo de ventas por estado.
 *
 * @param dbOverride - Instancia de BD opcional (para testing).
 */
export async function contarVentasPorEstado(
  dbOverride?: POSDatabase
): Promise<Record<VentaOutboxStatus, number>> {
  const db = dbOverride ?? getDB();
  const all = await db.ventas_outbox.toArray();

  return all.reduce(
    (acc, v) => {
      acc[v.status]++;
      return acc;
    },
    { pending: 0, synced: 0, error: 0 } as Record<VentaOutboxStatus, number>
  );
}
