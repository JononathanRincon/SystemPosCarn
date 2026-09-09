import { Database } from '@nozbe/watermelondb';
import { createTestDatabase } from './helpers/test-db';
import { SyncWorker, generateUUID } from '../src/services/SyncWorker';
import { VentaOutbox } from '../src/database/models/VentaOutbox';
import NetInfo from '@react-native-community/netinfo';

describe('SyncWorker Outbox & Network Synchronization Suite', () => {
  let database: Database;

  beforeEach(async () => {
    database = createTestDatabase();
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
    // @ts-ignore - Helper on NetInfo mock
    NetInfo.__reset();
  });

  describe('1. Outbox Enqueueing & UUIDv4 Idempotency', () => {
    it('should enqueue a sale with client-generated UUIDv4 and pending status', async () => {
      const worker = new SyncWorker({
        database,
        autoStart: false,
      });

      const saleData = {
        sucursalId: 'suc-01',
        cajeroId: 'caj-01',
        total: 48500,
        metodoPago: 'efectivo',
        detalles: [{ productoId: 'prod-01', cantidad: 1.5, precioUnitario: 24500 }],
      };

      const outboxRecord = await worker.enqueueSale(saleData);

      expect(outboxRecord).toBeDefined();
      expect(outboxRecord.status).toBe('pending');
      expect(outboxRecord.retryCount).toBe(0);
      expect(outboxRecord.createdAt).toBeInstanceOf(Date);
      expect(outboxRecord.syncedAt).toBeNull();

      // Validate UUIDv4 format
      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(outboxRecord.id).toMatch(uuidv4Regex);

      // Verify payload serialization contains identical id
      const parsed = JSON.parse(outboxRecord.payload);
      expect(parsed.id).toBe(outboxRecord.id);
      expect(parsed.total).toBe(48500);

      worker.destroy();
    });

    it('should preserve existing id if client already provided a UUIDv4', async () => {
      const worker = new SyncWorker({ database, autoStart: false });
      const customId = generateUUID();

      const outboxRecord = await worker.enqueueSale({
        id: customId,
        sucursalId: 'suc-02',
        total: 20000,
      });

      expect(outboxRecord.id).toBe(customId);
      const parsed = JSON.parse(outboxRecord.payload);
      expect(parsed.id).toBe(customId);

      worker.destroy();
    });

    it('should accurately report pending count for EARS-SYNC-03 badge', async () => {
      const worker = new SyncWorker({ database, autoStart: false });
      expect(await worker.getPendingCount()).toBe(0);

      await worker.enqueueSale({ total: 10000 });
      expect(await worker.getPendingCount()).toBe(1);

      await worker.enqueueSale({ total: 20000 });
      expect(await worker.getPendingCount()).toBe(2);

      worker.destroy();
    });
  });

  describe('2. NetInfo Offline -> Online Transition Auto-Trigger', () => {
    it('should automatically trigger sync when network transitions from offline to online', async () => {
      // Simulate initial offline state
      // @ts-ignore
      NetInfo.__simulateChange(false, false);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ procesadas: 1, duplicadasIgnoradas: 0, errores: [] }),
      });

      const worker = new SyncWorker({
        database,
        autoStart: true,
        fetchFn: mockFetch as any,
      });

      // Enqueue sale while offline
      await worker.enqueueSale({ total: 35000 });

      // In offline state, no sync should have run
      expect(mockFetch).not.toHaveBeenCalled();
      expect(await worker.getPendingCount()).toBe(1);

      // Transition to online
      // @ts-ignore
      NetInfo.__simulateChange(true, true);

      // Allow event loop to process background trigger
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(await worker.getPendingCount()).toBe(0);

      worker.destroy();
    });
  });

  describe('3. HTTP Request Payload & Idempotency-Key Header', () => {
    it('should dispatch POST to /sales/sync with correct headers and payload structure', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ procesadas: 1 }),
      });

      const worker = new SyncWorker({
        database,
        apiUrl: 'http://pos-backend.test/sales/sync',
        dispositivoId: 'tablet-pos-sur',
        autoStart: false,
        fetchFn: mockFetch as any,
      });

      const sale = await worker.enqueueSale({
        sucursalId: 'suc-sur-01',
        total: 55000,
      });

      const result = await worker.syncPendingSales();
      expect(result.syncedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];

      expect(calledUrl).toBe('http://pos-backend.test/sales/sync');
      expect(calledOptions.method).toBe('POST');
      expect(calledOptions.headers).toEqual({
        'Content-Type': 'application/json',
        'Idempotency-Key': sale.id,
      });

      const body = JSON.parse(calledOptions.body);
      expect(body.dispositivoId).toBe('tablet-pos-sur');
      expect(body.ventas).toHaveLength(1);
      expect(body.ventas[0].id).toBe(sale.id);
      expect(body.ventas[0].total).toBe(55000);

      worker.destroy();
    });
  });

  describe('4. Status Transition to synced on HTTP 200/202', () => {
    it('should transition outbox records to status = synced and record synced_at date', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ procesadas: 1 }),
      });

      const worker = new SyncWorker({
        database,
        autoStart: false,
        fetchFn: mockFetch as any,
      });

      const sale = await worker.enqueueSale({ total: 72000 });
      expect(sale.status).toBe('pending');
      expect(sale.syncedAt).toBeNull();

      await worker.syncPendingSales();

      // Refetch record from database
      const updated = await database.get<VentaOutbox>('ventas_outbox').find(sale.id);
      expect(updated.status).toBe('synced');
      expect(updated.syncedAt).toBeInstanceOf(Date);
      expect(updated.errorMessage).toBeNull();

      worker.destroy();
    });

    it('should also accept HTTP 202 Accepted as successful sync', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 202,
        json: async () => ({ procesadas: 1 }),
      });

      const worker = new SyncWorker({
        database,
        autoStart: false,
        fetchFn: mockFetch as any,
      });

      const sale = await worker.enqueueSale({ total: 19000 });
      await worker.syncPendingSales();

      const updated = await database.get<VentaOutbox>('ventas_outbox').find(sale.id);
      expect(updated.status).toBe('synced');

      worker.destroy();
    });
  });

  describe('5. Fault Tolerance & Retries (HTTP 500 & Network Errors)', () => {
    it('should leave records as pending and increment retry_count on HTTP 500 without deleting', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const worker = new SyncWorker({
        database,
        autoStart: false,
        fetchFn: mockFetch as any,
      });

      const sale = await worker.enqueueSale({ total: 60000 });
      expect(sale.retryCount).toBe(0);

      const result = await worker.syncPendingSales();
      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(1);

      // Assert record still exists, status remains pending, retryCount incremented
      const recordAfter500 = await database.get<VentaOutbox>('ventas_outbox').find(sale.id);
      expect(recordAfter500.status).toBe('pending');
      expect(recordAfter500.retryCount).toBe(1);
      expect(recordAfter500.errorMessage).toContain('500');

      worker.destroy();
    });

    it('should leave records as pending and increment retry_count on network connection drop', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network request failed: timeout'));

      const worker = new SyncWorker({
        database,
        autoStart: false,
        fetchFn: mockFetch as any,
      });

      const sale = await worker.enqueueSale({ total: 80000 });

      const result = await worker.syncPendingSales();
      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(1);

      const recordAfterDrop = await database.get<VentaOutbox>('ventas_outbox').find(sale.id);
      expect(recordAfterDrop.status).toBe('pending');
      expect(recordAfterDrop.retryCount).toBe(1);
      expect(recordAfterDrop.errorMessage).toContain('timeout');

      worker.destroy();
    });
  });

  describe('6. Idempotency on Retry with Identical UUID', () => {
    it('should transmit identical UUID and Idempotency-Key when retrying previously failed sales', async () => {
      let callCount = 0;
      const capturedKeys: string[] = [];
      const capturedSaleIds: string[] = [];

      const mockFetch = jest.fn().mockImplementation(async (_url, options) => {
        callCount++;
        capturedKeys.push(options.headers['Idempotency-Key']);
        const body = JSON.parse(options.body);
        capturedSaleIds.push(body.ventas[0].id);

        if (callCount === 1) {
          return { ok: false, status: 503, statusText: 'Service Unavailable' };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ procesadas: 1, duplicadasIgnoradas: 0 }),
        };
      });

      const worker = new SyncWorker({
        database,
        autoStart: false,
        fetchFn: mockFetch as any,
      });

      const sale = await worker.enqueueSale({ total: 95000 });
      const originalUUID = sale.id;

      // Attempt 1: fails with 503
      const firstResult = await worker.syncPendingSales();
      expect(firstResult.failedCount).toBe(1);

      // Attempt 2: succeeds with 200
      const secondResult = await worker.syncPendingSales();
      expect(secondResult.syncedCount).toBe(1);

      // Both attempts must use identical client UUID
      expect(capturedKeys).toHaveLength(2);
      expect(capturedKeys[0]).toBe(originalUUID);
      expect(capturedKeys[1]).toBe(originalUUID);
      expect(capturedSaleIds[0]).toBe(originalUUID);
      expect(capturedSaleIds[1]).toBe(originalUUID);

      // Final status is synced
      const finalRecord = await database.get<VentaOutbox>('ventas_outbox').find(originalUUID);
      expect(finalRecord.status).toBe('synced');
      expect(finalRecord.retryCount).toBe(1);

      worker.destroy();
    });
  });

  describe('7. Empty Outbox Guard (No Redundant Network Calls)', () => {
    it('should not make HTTP calls when outbox has zero pending sales', async () => {
      const mockFetch = jest.fn();
      const worker = new SyncWorker({
        database,
        autoStart: false,
        fetchFn: mockFetch as any,
      });

      const result = await worker.syncPendingSales();
      expect(result).toEqual({ syncedCount: 0, failedCount: 0 });
      expect(mockFetch).not.toHaveBeenCalled();

      worker.destroy();
    });

    it('should not make HTTP calls when network restores and outbox is empty', async () => {
      // @ts-ignore
      NetInfo.__simulateChange(false, false);

      const mockFetch = jest.fn();
      const worker = new SyncWorker({
        database,
        autoStart: true,
        fetchFn: mockFetch as any,
      });

      // Network comes back online with empty outbox
      // @ts-ignore
      NetInfo.__simulateChange(true, true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockFetch).not.toHaveBeenCalled();

      worker.destroy();
    });
  });

  describe('8. Batching of Multiple Sales', () => {
    it('should process sales in batches according to batchSize', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ procesadas: 2 }),
      });

      const worker = new SyncWorker({
        database,
        batchSize: 2,
        autoStart: false,
        fetchFn: mockFetch as any,
      });

      // Enqueue 5 sales
      for (let i = 1; i <= 5; i++) {
        await worker.enqueueSale({ total: i * 10000 });
      }

      const result = await worker.syncPendingSales();
      expect(result.syncedCount).toBe(5);
      expect(result.failedCount).toBe(0);

      // 5 items in batches of 2 -> 3 HTTP requests (2, 2, 1)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const batch1 = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(batch1.ventas).toHaveLength(2);

      const batch2 = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(batch2.ventas).toHaveLength(2);

      const batch3 = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(batch3.ventas).toHaveLength(1);

      expect(await worker.getPendingCount()).toBe(0);

      worker.destroy();
    });
  });
});
