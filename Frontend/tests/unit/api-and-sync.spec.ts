import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  apiClient,
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  ApiClientError,
} from '@/lib/api/api-client';
import {
  sincronizarVentasPendientes,
  obtenerConteoPendientesSync,
} from '@/lib/sync/sync-client';
import { POSDatabase } from '@/lib/db/pos-database';
import { encolarVentaOutbox } from '@/lib/db/repos/venta-outbox-repo';

describe('Frontend API Client & Sync Engine Unit Tests (TASK-31)', () => {
  let testDb: POSDatabase;

  beforeEach(async () => {
    clearAuthToken();
    testDb = new POSDatabase(`test-sync-${Date.now()}-${Math.random()}`);
    await testDb.open();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    clearAuthToken();
    if (testDb) {
      await testDb.delete();
    }
  });

  describe('1. ApiClient (HTTP, Auth, Timeouts y Errores)', () => {
    it('debe gestionar tokens de autenticación en memoria correctamente', () => {
      expect(getAuthToken()).toBeNull();
      setAuthToken('test-jwt-token-xyz');
      expect(getAuthToken()).toBe('test-jwt-token-xyz');
      clearAuthToken();
      expect(getAuthToken()).toBeNull();
    });

    it('debe enviar peticiones con cabecera Authorization cuando el token está seteado', async () => {
      setAuthToken('bearer-token-123');

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok', data: [1, 2, 3] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await apiClient.get('/test-endpoint');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('/test-endpoint');

      const headers = calledOptions.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer bearer-token-123');
      expect(res).toEqual({ status: 'ok', data: [1, 2, 3] });
    });

    it('debe arrojar ApiClientError con código de estado ante respuesta HTTP 4xx/5xx', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Token expirado o inválido' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(apiClient.get('/protected-route')).rejects.toThrow('Token expirado o inválido');
    });

    it('debe manejar timeout mediante AbortController', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      const mockFetch = vi.fn().mockRejectedValue(abortError);
      vi.stubGlobal('fetch', mockFetch);

      await expect(apiClient.get('/slow-route', { timeoutMs: 100 })).rejects.toThrow(ApiClientError);
    });
  });

  describe('2. Sincronización Manual de Ventas Outbox (sync-client)', () => {
    it('debe retornar reporte vacío si no hay ventas pendientes en IndexedDB', async () => {
      const count = await obtenerConteoPendientesSync(testDb);
      expect(count).toBe(0);

      const report = await sincronizarVentasPendientes(testDb);
      expect(report.total).toBe(0);
      expect(report.exitosas).toBe(0);
      expect(report.fallidas).toBe(0);
      expect(report.mensaje).toContain('No hay ventas pendientes');
    });

    it('debe enviar ventas a /sales/sync y mutar estado a synced en Dexie al responder 200', async () => {
      // 1. Encolar dos ventas en Dexie
      const venta1Id = await encolarVentaOutbox(
        {
          id: 'v-outbox-01',
          total: 150.0,
          metodoPago: 'efectivo',
        },
        testDb
      );

      const venta2Id = await encolarVentaOutbox(
        {
          id: 'v-outbox-02',
          total: 280.0,
          metodoPago: 'tarjeta',
        },
        testDb
      );

      expect(await obtenerConteoPendientesSync(testDb)).toBe(2);

      // 2. Mock de respuesta exitosa de /sales/sync
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ procesadas: 2, duplicadasIgnoradas: 0, errores: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      // 3. Ejecutar sincronización
      const report = await sincronizarVentasPendientes(testDb, 'caja-test-01');

      expect(report.total).toBe(2);
      expect(report.exitosas).toBe(2);
      expect(report.fallidas).toBe(0);
      expect(report.mensaje).toContain('2 ventas sincronizadas con éxito');

      // 4. Validar mutación a 'synced' en Dexie
      const pendientesRestantes = await obtenerConteoPendientesSync(testDb);
      expect(pendientesRestantes).toBe(0);

      const v1 = await testDb.ventas_outbox.get(venta1Id);
      const v2 = await testDb.ventas_outbox.get(venta2Id);
      expect(v1?.status).toBe('synced');
      expect(v2?.status).toBe('synced');
    });

    it('debe mantener las ventas en pending si el servidor falla o no hay conexión', async () => {
      const ventaId = await encolarVentaOutbox(
        {
          id: 'v-offline-resiliente',
          total: 95.0,
        },
        testDb
      );

      // Simular fallo de red (servidor inalcanzable)
      const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
      vi.stubGlobal('fetch', mockFetch);

      const report = await sincronizarVentasPendientes(testDb);

      expect(report.total).toBe(1);
      expect(report.exitosas).toBe(0);
      expect(report.fallidas).toBe(1);
      expect(report.mensaje).toContain('No se pudo conectar al servidor');

      // Las ventas permanecen seguras en estado 'pending'
      const v = await testDb.ventas_outbox.get(ventaId);
      expect(v?.status).toBe('pending');
      expect(await obtenerConteoPendientesSync(testDb)).toBe(1);
    });
  });
});
