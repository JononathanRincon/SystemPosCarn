import { Database } from '@nozbe/watermelondb';
import { Platform } from 'react-native';
import { createTestDatabase } from './helpers/test-db';
import { getApiBaseUrl, setCustomApiBaseUrl, resetApiConfig } from '../src/config/api';
import { AuthService } from '../src/services/AuthService';
import { SyncWorker, generateUUID } from '../src/services/SyncWorker';
import { CatalogSync } from '../src/services/CatalogSync';
import { Categoria } from '../src/database/models/Categoria';
import { Producto } from '../src/database/models/Producto';

describe('Mobile E2E Connectivity & Integration Suite', () => {
  let database: Database;

  beforeEach(async () => {
    resetApiConfig();
    AuthService.clearSession();
    database = createTestDatabase();
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  });

  describe('1. Dynamic API Host Resolution', () => {
    it('should return custom URL when set', () => {
      setCustomApiBaseUrl('http://192.168.1.100:3001/');
      expect(getApiBaseUrl()).toBe('http://192.168.1.100:3001');
    });

    it('should reset custom URL and fallback', () => {
      setCustomApiBaseUrl('http://192.168.1.100:3001');
      resetApiConfig();
      expect(getApiBaseUrl()).toMatch(/^http:\/\/(10\.0\.2\.2|localhost):3001$/);
    });

    it('should respect Android Platform OS', () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'android';
      expect(getApiBaseUrl()).toBe('http://10.0.2.2:3001');
      (Platform as any).OS = originalOS;
    });

    it('should respect iOS Platform OS', () => {
      const originalOS = Platform.OS;
      (Platform as any).OS = 'ios';
      expect(getApiBaseUrl()).toBe('http://localhost:3001');
      (Platform as any).OS = originalOS;
    });
  });

  describe('2. AuthService PIN Login & Session Storage', () => {
    it('should reject invalid PIN formats without making network requests', async () => {
      const mockFetch = jest.fn();
      const res1 = await AuthService.loginConPin('12', 'suc-1', 'dev-1', mockFetch as any);
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('4 dígitos');

      const res2 = await AuthService.loginConPin('abcd', 'suc-1', 'dev-1', mockFetch as any);
      expect(res2.success).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should authenticate against backend, store session token, and return user info', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          valid: true,
          accessToken: 'jwt-mock-token-abc',
          user: { id: 'usr-cajero-01', nombre: 'Juan Cajero', rol: 'Cajero' },
        }),
      });

      const res = await AuthService.loginConPin('1234', 'suc-01', 'tablet-01', mockFetch as any);

      expect(res.success).toBe(true);
      expect(res.valid).toBe(true);
      expect(res.accessToken).toBe('jwt-mock-token-abc');
      expect(res.isOffline).toBe(false);
      expect(AuthService.getSessionToken()).toBe('jwt-mock-token-abc');
      expect(AuthService.getActiveUser()?.nombre).toBe('Juan Cajero');

      // Verify request payload
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/pin-login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            pin: '1234',
            sucursalId: 'suc-01',
            dispositivoId: 'tablet-01',
          }),
        })
      );
    });

    it('should fallback to offline contingency login when backend is unreachable with PIN 1234', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

      const res = await AuthService.loginConPin('1234', 'suc-01', 'tablet-01', mockFetch as any);

      expect(res.success).toBe(true);
      expect(res.isOffline).toBe(true);
      expect(res.user?.rol).toBe('Cajero');
      expect(AuthService.getSessionToken()).toBe('offline-session-token-contingencia');
    });

    it('should fail offline when unknown PIN is used and backend is down', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

      const res = await AuthService.loginConPin('9999', 'suc-01', 'tablet-01', mockFetch as any);

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('3. SyncWorker Token & Connectivity Integration', () => {
    it('should inject Authorization Bearer header into /sales/sync when user is authenticated', async () => {
      AuthService.setSessionToken('jwt-session-tablet-777', {
        id: 'usr-1',
        nombre: 'Cajero',
        rol: 'Cajero',
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ syncedCount: 1, failedCount: 0 }),
      });

      const worker = new SyncWorker({
        database,
        autoStart: false,
        fetchFn: mockFetch as any,
      });

      const saleId = generateUUID();
      await worker.enqueueSale({
        id: saleId,
        sucursalId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        cajeroId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        total: 15000,
        metodoPago: 'efectivo',
        detalles: [
          {
            productoId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
            cantidad: 2,
            precioUnitario: 7500,
          },
        ],
      });

      const result = await worker.syncPendingSales();

      expect(result.syncedCount).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sales/sync'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-session-tablet-777',
          }),
        })
      );

      worker.destroy();
    });
  });

  describe('4. CatalogSync Initial Master Data Ingestion', () => {
    it('should download products and categories and persist into WatermelonDB', async () => {
      AuthService.setSessionToken('jwt-catalog-admin');

      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/catalog/products')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 'prod-carne-01',
                nombre: 'Lomo Fino Res',
                precio: 35000,
                tipoVenta: 'peso',
                unidadMedida: 'kg',
                activo: true,
                categoriaId: 'cat-res-01',
              },
              {
                id: 'prod-pollo-02',
                nombre: 'Pechuga Pollo',
                precio: 14500,
                tipoVenta: 'peso',
                unidadMedida: 'kg',
                activo: true,
                categoriaId: 'cat-aves-02',
              },
            ],
          });
        }
        if (url.includes('/catalog/categories')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              { id: 'cat-res-01', nombre: 'Carne de Res', ordenVisualizacion: 1 },
              { id: 'cat-aves-02', nombre: 'Aves y Pollo', ordenVisualizacion: 2 },
            ],
          });
        }
        return Promise.reject(new Error('Unknown url'));
      });

      const report = await CatalogSync.descargarCatalogoInicial(database, mockFetch as any);

      expect(report.success).toBe(true);
      expect(report.categoriasActualizadas).toBe(2);
      expect(report.productosActualizados).toBe(2);

      // Verify records in local SQLite / LokiJS
      const cats = await database.get<Categoria>('categorias').query().fetch();
      expect(cats.length).toBe(2);
      expect(cats.map((c) => c.nombre)).toContain('Carne de Res');

      const prods = await database.get<Producto>('productos').query().fetch();
      expect(prods.length).toBe(2);
      expect(prods.find((p) => p.id === 'prod-carne-01')?.precio).toBe(35000);
    });

    it('should gracefully handle network failure when syncing catalog', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Servidor inalcanzable'));

      const report = await CatalogSync.descargarCatalogoInicial(database, mockFetch as any);

      expect(report.success).toBe(false);
      expect(report.error).toContain('Servidor inalcanzable');
      expect(report.productosActualizados).toBe(0);
    });
  });
});
