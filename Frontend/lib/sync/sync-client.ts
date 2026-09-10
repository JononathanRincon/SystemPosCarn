import {
  obtenerVentasPendientesSync,
  marcarVentaSincronizada,
  contarVentasPorEstado,
} from '@/lib/db/repos/venta-outbox-repo';
import type { POSDatabase } from '@/lib/db/pos-database';
import { apiClient } from '@/lib/api/api-client';

export interface SyncReport {
  total: number;
  exitosas: number;
  fallidas: number;
  mensaje: string;
  error?: string;
}

/**
 * Servicio de sincronización outbox manual y reactiva para el POS Web.
 * Sube las ventas encoladas localmente hacia el backend NestJS (POST /sales/sync).
 * Cumple con diseño offline-first: si no hay red, las ventas continúan en 'pending'.
 */
export async function sincronizarVentasPendientes(
  dbOverride?: POSDatabase,
  dispositivoId = 'caja-web-01'
): Promise<SyncReport> {
  const pendientes = await obtenerVentasPendientesSync(dbOverride);

  if (pendientes.length === 0) {
    return {
      total: 0,
      exitosas: 0,
      fallidas: 0,
      mensaje: 'No hay ventas pendientes por sincronizar',
    };
  }

  // Parsear y normalizar payloads de ventas encoladas
  const ventas = pendientes.map((item) => {
    try {
      const data = JSON.parse(item.payload);
      return {
        ...data,
        id: item.id || data.id,
      };
    } catch {
      return { id: item.id };
    }
  });

  const idempotencyKey =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `idemp-sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    const response = await apiClient.post(
      '/sales/sync',
      {
        dispositivoId,
        ventas,
      },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
          'X-Dispositivo-ID': dispositivoId,
        },
      }
    );

    // En respuesta exitosa, actualizar el estado de cada venta en IndexedDB a 'synced'
    for (const item of pendientes) {
      await marcarVentaSincronizada(item.id, dbOverride);
    }

    const count = pendientes.length;
    return {
      total: count,
      exitosas: count,
      fallidas: 0,
      mensaje: `${count} ${count === 1 ? 'venta sincronizada' : 'ventas sincronizadas'} con éxito`,
    };
  } catch (err: any) {
    // Tolerancia a fallos: ante error de red, las ventas se mantienen intactas en 'pending'
    return {
      total: pendientes.length,
      exitosas: 0,
      fallidas: pendientes.length,
      error: err?.message || 'Error de comunicación con el servidor',
      mensaje: 'No se pudo conectar al servidor. Las ventas siguen seguras en la caja local.',
    };
  }
}

/**
 * Consulta la cantidad de ventas pendientes de sincronización para visualización de badges.
 */
export async function obtenerConteoPendientesSync(
  dbOverride?: POSDatabase
): Promise<number> {
  const estados = await contarVentasPorEstado(dbOverride);
  return estados.pending;
}
