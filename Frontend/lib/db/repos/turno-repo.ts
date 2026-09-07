import { getDB } from '@/lib/db/pos-database';
import type { POSDatabase, TurnoLocal, TurnoEstado } from '@/lib/db/pos-database';

/**
 * Repositorio del turno de caja local.
 * Gestiona el estado de apertura/cierre del turno en esta terminal POS.
 */

/**
 * Abre un nuevo turno de caja local.
 *
 * @param montoApertura - Base de efectivo inicial en caja.
 * @param usuarioId - ID del cajero que abre el turno.
 * @param dbOverride - Instancia de BD opcional (para testing).
 * @returns El ID del turno creado.
 */
export async function abrirTurnoLocal(
  montoApertura: number,
  usuarioId: string,
  dbOverride?: POSDatabase
): Promise<string> {
  const db = dbOverride ?? getDB();

  // Verificar que no haya turno abierto
  const turnoAbierto = await db.turno_local
    .where('estado')
    .equals('abierta' satisfies TurnoEstado)
    .first();

  if (turnoAbierto) {
    throw new Error(
      'Ya existe un turno abierto. Cierre el turno actual antes de abrir uno nuevo.'
    );
  }

  const id = crypto.randomUUID();
  const turno: TurnoLocal = {
    id,
    estado: 'abierta',
    montoApertura,
    usuarioId,
  };

  await db.turno_local.add(turno);
  return id;
}

/**
 * Obtiene el turno actualmente abierto, si existe.
 *
 * @param dbOverride - Instancia de BD opcional (para testing).
 */
export async function obtenerTurnoAbierto(
  dbOverride?: POSDatabase
): Promise<TurnoLocal | undefined> {
  const db = dbOverride ?? getDB();
  return db.turno_local
    .where('estado')
    .equals('abierta' satisfies TurnoEstado)
    .first();
}

/**
 * Cierra el turno de caja local activo.
 *
 * @param turnoId - ID del turno a cerrar.
 * @param dbOverride - Instancia de BD opcional (para testing).
 */
export async function cerrarTurnoLocal(
  turnoId: string,
  dbOverride?: POSDatabase
): Promise<void> {
  const db = dbOverride ?? getDB();
  await db.turno_local.update(turnoId, {
    estado: 'cerrada' satisfies TurnoEstado,
  });
}
