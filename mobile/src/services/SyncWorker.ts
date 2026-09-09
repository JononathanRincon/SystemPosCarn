import NetInfo from '@react-native-community/netinfo';
import { Database, Q } from '@nozbe/watermelondb';
import { VentaOutbox } from '../database/models/VentaOutbox';
import { getDatabase } from '../database';

/**
 * Generador de UUIDv4 compatible con Node.js, React Native y navegadores.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SyncWorkerConfig {
  /** URL del endpoint de sincronización del backend NestJS (default: http://localhost:3000/sales/sync) */
  apiUrl?: string;
  /** Identificador de la terminal tablet POS (default: tablet-mostrador-01) */
  dispositivoId?: string;
  /** Tamaño de lote para envíos sincronizados (default: 25) */
  batchSize?: number;
  /** Instancia de WatermelonDB (default: getDatabase()) */
  database?: Database;
  /** Si debe iniciar el listener de red automáticamente al instanciar (default: true) */
  autoStart?: boolean;
  /** Función fetch personalizada (para testing o interceptores) */
  fetchFn?: typeof fetch;
}

export interface SyncResult {
  syncedCount: number;
  failedCount: number;
}

/**
 * SyncWorker: Motor de sincronización en segundo plano para la cola outbox de ventas offline.
 *
 * Cumple con:
 * - EARS-SYNC-01: Generación de UUIDv4 en terminal para cada venta y garantía de idempotencia.
 * - EARS-SYNC-02: Detección automática de reconexión a internet mediante NetInfo y disparo en segundo plano.
 * - EARS-SYNC-03: Conteo observable de ventas pendientes para el badge offline.
 * - design.md §1.4 & §7.3: Envío por lotes contra POST /sales/sync con Idempotency-Key.
 */
export class SyncWorker {
  private database: Database;
  private config: {
    apiUrl: string;
    dispositivoId: string;
    batchSize: number;
    autoStart: boolean;
    fetchFn?: typeof fetch;
  };
  private isSyncing = false;
  private unsubscribeNetInfo: (() => void) | null = null;
  private isOnline = false;

  constructor(config?: SyncWorkerConfig) {
    this.database = config?.database ?? getDatabase();
    this.config = {
      apiUrl: config?.apiUrl ?? 'http://localhost:3000/sales/sync',
      dispositivoId: config?.dispositivoId ?? 'tablet-mostrador-01',
      batchSize: config?.batchSize ?? 25,
      autoStart: config?.autoStart ?? true,
      fetchFn: config?.fetchFn,
    };

    if (this.config.autoStart) {
      this.startListening();
    }
  }

  /**
   * Inicia la escucha de eventos de red mediante NetInfo.
   * Al transicionar de offline a online, dispara automáticamente la sincronización.
   */
  public startListening(): void {
    if (this.unsubscribeNetInfo) {
      return;
    }

    // Consulta estado inicial
    NetInfo.fetch()
      .then((state) => {
        this.isOnline = Boolean(state.isConnected && state.isInternetReachable);
      })
      .catch(() => {
        this.isOnline = false;
      });

    // Escucha cambios de conectividad
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      const isNowOnline = Boolean(state.isConnected && state.isInternetReachable);
      this.isOnline = isNowOnline;

      // Al detectar restablecimiento de red (offline -> online), dispara sync
      if (!wasOnline && isNowOnline) {
        this.syncPendingSales().catch(() => {
          // El error de background sync se maneja internamente con reintentos
        });
      }
    });
  }

  /**
   * Detiene el listener de NetInfo.
   */
  public stopListening(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
  }

  /**
   * Destruye el worker liberando recursos.
   */
  public destroy(): void {
    this.stopListening();
  }

  /**
   * Encola una venta en la tabla local `ventas_outbox` con status = 'pending'.
   * Asigna un UUIDv4 generado en cliente como ID de venta para idempotencia.
   */
  public async enqueueSale(payload: Record<string, any>): Promise<VentaOutbox> {
    const saleId = payload.id || generateUUID();
    const saleData = {
      ...payload,
      id: saleId,
      fechaHoraDispositivo: payload.fechaHoraDispositivo ?? new Date().toISOString(),
    };

    const record = await this.database.write(async () => {
      return await this.database.get<VentaOutbox>('ventas_outbox').create((outbox) => {
        if (outbox._raw) {
          outbox._raw.id = saleId;
        }
        outbox.payload = JSON.stringify(saleData);
        outbox.status = 'pending';
        outbox.retryCount = 0;
        outbox.errorMessage = null;
      });
    });

    return record;
  }

  /**
   * Sincroniza las ventas pendientes en la cola outbox con el servidor backend.
   * - Agrupa por lotes según `batchSize`.
   * - Despacha POST /sales/sync con Idempotency-Key.
   * - En HTTP 200/202: actualiza status = 'synced', synced_at = Date.now().
   * - En error (HTTP 5xx o de red): mantiene status = 'pending', incrementa retry_count.
   * - Si no hay pendientes, no realiza llamadas HTTP redundantes.
   */
  public async syncPendingSales(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { syncedCount: 0, failedCount: 0 };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
      // 1. Obtener registros pendientes ordenados por created_at ASC (FIFO)
      const pendingRecords = await this.database
        .get<VentaOutbox>('ventas_outbox')
        .query(Q.where('status', 'pending'), Q.sortBy('created_at', Q.asc))
        .fetch();

      // Si la cola está vacía, no hacer llamadas HTTP
      if (pendingRecords.length === 0) {
        return { syncedCount: 0, failedCount: 0 };
      }

      // 2. Procesar en lotes
      const batchSize = this.config.batchSize;
      for (let i = 0; i < pendingRecords.length; i += batchSize) {
        const batch = pendingRecords.slice(i, i + batchSize);

        const salesPayload: any[] = [];
        const saleIds: string[] = [];

        for (const record of batch) {
          try {
            const parsed = JSON.parse(record.payload);
            const id = parsed.id || record.id;
            salesPayload.push({ ...parsed, id });
            saleIds.push(id);
          } catch {
            salesPayload.push({ id: record.id, raw: record.payload });
            saleIds.push(record.id);
          }
        }

        // Idempotency-Key basado en el UUID o lista de UUIDs
        const idempotencyKey = saleIds.length === 1 ? saleIds[0] : saleIds.join(',');

        const requestBody = {
          dispositivoId: this.config.dispositivoId,
          ventas: salesPayload,
        };

        const fetchFn = this.config.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
        if (!fetchFn) {
          throw new Error('No fetch implementation available in current environment');
        }

        try {
          const response = await fetchFn(this.config.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(requestBody),
          });

          if (response.ok || response.status === 200 || response.status === 202) {
            const syncDate = new Date();
            await this.database.write(async () => {
              for (const record of batch) {
                await record.update((r) => {
                  r.status = 'synced';
                  r.syncedAt = syncDate;
                  r.errorMessage = null;
                });
              }
            });
            syncedCount += batch.length;
          } else {
            // Error HTTP (5xx, 4xx): preservar como pending e incrementar reintentos
            const errorMsg = `HTTP error ${response.status}: ${response.statusText || 'Server error'}`;
            await this.database.write(async () => {
              for (const record of batch) {
                await record.update((r) => {
                  r.status = 'pending';
                  r.retryCount = (r.retryCount ?? 0) + 1;
                  r.errorMessage = errorMsg;
                });
              }
            });
            failedCount += batch.length;
          }
        } catch (networkError: any) {
          // Error de red (sin conexión, DNS, timeout): preservar e incrementar reintentos
          const errorMsg = networkError?.message || 'Network request failed';
          await this.database.write(async () => {
            for (const record of batch) {
              await record.update((r) => {
                r.status = 'pending';
                r.retryCount = (r.retryCount ?? 0) + 1;
                r.errorMessage = errorMsg;
              });
            }
          });
          failedCount += batch.length;
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return { syncedCount, failedCount };
  }

  /**
   * Obtiene el conteo actual de ventas pendientes de sincronización.
   * Utilizado para el badge EARS-SYNC-03 ("Modo Sin Conexión (N pendientes)").
   */
  public async getPendingCount(): Promise<number> {
    try {
      return await this.database
        .get<VentaOutbox>('ventas_outbox')
        .query(Q.where('status', 'pending'))
        .fetchCount();
    } catch {
      const records = await this.database
        .get<VentaOutbox>('ventas_outbox')
        .query(Q.where('status', 'pending'))
        .fetch();
      return records.length;
    }
  }

  /**
   * Observable reactivo con el conteo de ventas pendientes.
   */
  public observePendingCount() {
    return this.database
      .get<VentaOutbox>('ventas_outbox')
      .query(Q.where('status', 'pending'))
      .observeCount();
  }
}

let defaultSyncWorkerInstance: SyncWorker | null = null;

/**
 * Obtiene la instancia singleton de SyncWorker o crea una nueva con la configuración dada.
 */
export function getSyncWorker(config?: SyncWorkerConfig): SyncWorker {
  if (!defaultSyncWorkerInstance || config) {
    defaultSyncWorkerInstance = new SyncWorker(config);
  }
  return defaultSyncWorkerInstance;
}

/**
 * Reinicia la instancia por defecto para pruebas unitarias.
 */
export function resetDefaultSyncWorker(): void {
  if (defaultSyncWorkerInstance) {
    defaultSyncWorkerInstance.destroy();
    defaultSyncWorkerInstance = null;
  }
}

export const syncWorker = {
  get instance(): SyncWorker {
    return getSyncWorker();
  },
};

export default SyncWorker;
