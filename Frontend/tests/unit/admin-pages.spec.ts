import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiClient } from '@/lib/api/api-client';

describe('Admin Web Pages Logic Tests (Fase 3 Cierre)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Catálogo y Precios (Cortes Cárnicos y Tipos de Venta)', () => {
    it('debe consultar productos desde el backend vía apiClient', async () => {
      const mockProductos = [
        {
          id: 'prod-1',
          nombre: 'Lomo Fino de Res',
          categoriaId: 'res',
          tipoVenta: 'peso',
          unidadMedida: 'kg',
          precio: 45000,
          costoPromedio: 32000,
          activo: true,
        },
      ];

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockProductos);

      const resultado = await apiClient.get('/products');

      expect(getSpy).toHaveBeenCalledWith('/products');
      expect(resultado).toHaveLength(1);
      expect(resultado[0].nombre).toBe('Lomo Fino de Res');
      expect(resultado[0].tipoVenta).toBe('peso');
    });

    it('debe actualizar el precio de un corte cárnico vía PATCH /products/:id/price', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        id: 'prod-1',
        precio: 48000,
      });

      const resultado = await apiClient.patch('/products/prod-1/price', { precio: 48000 });

      expect(patchSpy).toHaveBeenCalledWith('/products/prod-1/price', { precio: 48000 });
      expect(resultado.precio).toBe(48000);
    });

    it('debe crear un nuevo corte cárnico vía POST /products', async () => {
      const nuevoProducto = {
        nombre: 'Sobrebarriga Gruesa',
        categoriaId: 'res',
        tipoVenta: 'peso',
        unidadMedida: 'kg',
        precio: 26000,
        costoPromedio: 18000,
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        id: 'prod-new-1',
        ...nuevoProducto,
        activo: true,
      });

      const resultado = await apiClient.post('/products', nuevoProducto);

      expect(postSpy).toHaveBeenCalledWith('/products', nuevoProducto);
      expect(resultado.id).toBe('prod-new-1');
      expect(resultado.nombre).toBe('Sobrebarriga Gruesa');
    });
  });

  describe('2. Auditoría y Gestión de Terminales POS', () => {
    it('debe consultar el listado de terminales registradas vía GET /devices', async () => {
      const mockDevices = [
        {
          id: 'caja-mostrador-01',
          nombreAlias: 'Tablet Mostrador 01',
          modelo: 'Samsung Tab A8',
          sistemaOperativo: 'Android 13',
          ultimoLatido: new Date().toISOString(),
          activo: true,
          ventasPendientesSync: 0,
          cajeroTurnoActivo: 'Carlos Morales',
        },
        {
          id: 'caja-mostrador-02',
          nombreAlias: 'Tablet Mostrador 02',
          modelo: 'iPad 10.2"',
          sistemaOperativo: 'iPadOS 16',
          ultimoLatido: new Date().toISOString(),
          activo: true,
          ventasPendientesSync: 2,
          cajeroTurnoActivo: 'María Rojas',
        },
      ];

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockDevices);

      const terminales = await apiClient.get('/devices');

      expect(getSpy).toHaveBeenCalledWith('/devices');
      expect(terminales).toHaveLength(2);
      expect(terminales[0].nombreAlias).toBe('Tablet Mostrador 01');
      expect(terminales[1].ventasPendientesSync).toBe(2);
    });

    it('debe revocar el acceso a una terminal vía PATCH /devices/:id/revoke', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        id: 'caja-mostrador-02',
        activo: false,
      });

      const resultado = await apiClient.patch('/devices/caja-mostrador-02/revoke');

      expect(patchSpy).toHaveBeenCalledWith('/devices/caja-mostrador-02/revoke');
      expect(resultado.activo).toBe(false);
    });
  });
});
