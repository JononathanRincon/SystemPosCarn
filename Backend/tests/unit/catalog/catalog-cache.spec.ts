import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { ProductoService } from '../../../src/modules/catalog/application/services/producto.service';
import { CategoriaService } from '../../../src/modules/catalog/application/services/categoria.service';
import { RedisCacheService } from '../../../src/common/cache/redis-cache.service';
import { CatalogCacheListener } from '../../../src/modules/catalog/application/listeners/catalog-cache.listener';
import { CatalogoModificadoEvent } from '../../../src/modules/catalog/domain/events/catalogo-modificado.event';
import { Producto } from '../../../src/modules/catalog/domain/entities/producto.entity';
import { Categoria } from '../../../src/modules/catalog/domain/entities/categoria.entity';
import { PRODUCTO_REPOSITORY_PORT } from '../../../src/modules/catalog/domain/ports/producto-repository.port';
import { CATEGORIA_REPOSITORY_PORT } from '../../../src/modules/catalog/domain/ports/categoria-repository.port';
import { TenantContextService } from '../../../src/modules/catalog/application/services/tenant-context.service';

describe('TASK-18: Cache-Aside de Catálogo en Redis e Invalidación Reactiva', () => {
  let moduleRef: TestingModule;
  let productoService: ProductoService;
  let categoriaService: CategoriaService;
  let cacheService: RedisCacheService;
  let eventEmitter: EventEmitter2;
  let listener: CatalogCacheListener;

  // Repositorios en memoria
  let mockProductoRepo: any;
  let mockCategoriaRepo: any;

  const tenantId = 'negocio-uuid-1234';
  const sucursalId = 'sucursal-uuid-5678';
  const categoriaId = 'cat-uuid-0001';
  const productoId = 'prod-corte-uuid-1111';

  beforeEach(async () => {
    const categoriaInicial = new Categoria({
      id: categoriaId,
      negocioId: tenantId,
      nombre: 'Cortes Finos de Res',
      ordenVisualizacion: 1,
    });

    const productoInicial = new Producto({
      id: productoId,
      negocioId: tenantId,
      categoriaId,
      nombre: 'Punta de Anca',
      tipoVenta: 'peso',
      unidadMedida: 'kg',
      precio: 35000,
      costoPromedio: 22000,
      activo: true,
    });

    mockCategoriaRepo = {
      categorias: [categoriaInicial],
      save: jest.fn(async (cat: Categoria) => {
        const idx = mockCategoriaRepo.categorias.findIndex((c: Categoria) => c.id === cat.id);
        if (idx >= 0) mockCategoriaRepo.categorias[idx] = cat;
        else mockCategoriaRepo.categorias.push(cat);
        return cat;
      }),
      findById: jest.fn(async (id: string, tId: string) =>
        mockCategoriaRepo.categorias.find((c: Categoria) => c.id === id && c.negocioId === tId) || null,
      ),
      findByNegocioId: jest.fn(async (tId: string) =>
        mockCategoriaRepo.categorias.filter((c: Categoria) => c.negocioId === tId),
      ),
      delete: jest.fn(async (id: string, tId: string) => {
        const idx = mockCategoriaRepo.categorias.findIndex((c: Categoria) => c.id === id && c.negocioId === tId);
        if (idx >= 0) {
          mockCategoriaRepo.categorias.splice(idx, 1);
          return true;
        }
        return false;
      }),
    };

    mockProductoRepo = {
      productos: [productoInicial],
      save: jest.fn(async (prod: Producto) => {
        const idx = mockProductoRepo.productos.findIndex((p: Producto) => p.id === prod.id);
        if (idx >= 0) mockProductoRepo.productos[idx] = prod;
        else mockProductoRepo.productos.push(prod);
        return prod;
      }),
      findById: jest.fn(async (id: string, tId: string) =>
        mockProductoRepo.productos.find((p: Producto) => p.id === id && p.negocioId === tId) || null,
      ),
      findByCodigoBarras: jest.fn(async () => null),
      findByNegocioId: jest.fn(async (tId: string, filtros?: any) => {
        return mockProductoRepo.productos.filter((p: Producto) => {
          if (p.negocioId !== tId) return false;
          if (filtros?.activo !== undefined && p.activo !== filtros.activo) return false;
          if (filtros?.categoriaId && p.categoriaId !== filtros.categoriaId) return false;
          return true;
        });
      }),
      delete: jest.fn(async (id: string, tId: string) => {
        const idx = mockProductoRepo.productos.findIndex((p: Producto) => p.id === id && p.negocioId === tId);
        if (idx >= 0) {
          mockProductoRepo.productos.splice(idx, 1);
          return true;
        }
        return false;
      }),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({
          wildcard: false,
          delimiter: '.',
          maxListeners: 20,
        }),
      ],
      providers: [
        {
          provide: RedisCacheService,
          useFactory: () => new RedisCacheService(null, { disableRedis: true }),
        },
        {
          provide: TenantContextService,
          useValue: {
            getTenantId: () => tenantId,
            getRequiredTenantId: () => tenantId,
          },
        },
        CatalogCacheListener,
        ProductoService,
        CategoriaService,
        { provide: PRODUCTO_REPOSITORY_PORT, useValue: mockProductoRepo },
        { provide: CATEGORIA_REPOSITORY_PORT, useValue: mockCategoriaRepo },
      ],
    }).compile();

    await moduleRef.init();

    productoService = moduleRef.get<ProductoService>(ProductoService);
    categoriaService = moduleRef.get<CategoriaService>(CategoriaService);
    cacheService = moduleRef.get<RedisCacheService>(RedisCacheService);
    eventEmitter = moduleRef.get<EventEmitter2>(EventEmitter2);
    listener = moduleRef.get<CatalogCacheListener>(CatalogCacheListener);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe('1. Patrón Cache-Aside (Cache Miss vs Cache Hit)', () => {
    it('debe consultar base de datos en Cache Miss inicial y poblar Redis con TTL 3600s', async () => {
      const cacheKey = RedisCacheService.getCatalogSucursalKey(sucursalId);
      expect(cacheKey).toBe(`catalog:sucursal:${sucursalId}`);

      // Verificar que inicialmente la caché está vacía
      const cachedInicial = await cacheService.get(cacheKey);
      expect(cachedInicial).toBeNull();

      const spyRepo = jest.spyOn(mockProductoRepo, 'findByNegocioId');
      const spyCacheSet = jest.spyOn(cacheService, 'set');

      // 1. Primera consulta: Cache Miss
      const catalogo1 = await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);

      expect(catalogo1).toBeDefined();
      expect(catalogo1.sucursalId).toBe(sucursalId);
      expect(catalogo1.fromCache).toBe(false);
      expect(catalogo1.totalProductos).toBe(1);
      expect(catalogo1.productos[0].nombre).toBe('Punta de Anca');
      expect(spyRepo).toHaveBeenCalledTimes(1);

      // Verificar que se pobló Redis con el TTL canónico (3600s)
      expect(spyCacheSet).toHaveBeenCalledWith(
        cacheKey,
        expect.objectContaining({ sucursalId, totalProductos: 1 }),
        3600,
      );

      // 2. Segunda consulta: Cache Hit
      spyRepo.mockClear();
      const catalogo2 = await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);

      expect(catalogo2.fromCache).toBe(true);
      expect(catalogo2.productos[0].nombre).toBe('Punta de Anca');
      // No debió consultar nuevamente la base de datos
      expect(spyRepo).not.toHaveBeenCalled();
    });
  });

  describe('2. Invalidación Proactiva ante Mutaciones de Catálogo', () => {
    it('debe invalidar inmediatamente la caché al actualizar precio de producto (US-11)', async () => {
      const cacheKey = RedisCacheService.getCatalogSucursalKey(sucursalId);

      // Poblar caché
      await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);
      expect(await cacheService.get(cacheKey)).not.toBeNull();

      // Cambiar precio del producto
      const nuevoPrecio = 38500;
      const actualizado = await productoService.cambiarPrecio(
        productoId,
        { precio: nuevoPrecio },
        tenantId,
      );
      expect(actualizado.precio).toBe(nuevoPrecio);

      // La clave en caché debió ser invalidada proactivamente
      const enCacheTrasMutacion = await cacheService.get(cacheKey);
      expect(enCacheTrasMutacion).toBeNull();

      // La siguiente consulta debe generar Cache Miss y traer el precio actualizado
      const catalogoRefrescado = await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);
      expect(catalogoRefrescado.fromCache).toBe(false);
      expect(catalogoRefrescado.productos[0].precio).toBe(nuevoPrecio);
    });

    it('debe invalidar inmediatamente la caché al crear un nuevo producto', async () => {
      const cacheKey = RedisCacheService.getCatalogSucursalKey(sucursalId);
      await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);

      await productoService.create(
        {
          categoriaId,
          nombre: 'Costilla Especial',
          tipoVenta: 'peso',
          unidadMedida: 'kg',
          precio: 26000,
        },
        tenantId,
      );

      expect(await cacheService.get(cacheKey)).toBeNull();
      const catalogo = await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);
      expect(catalogo.totalProductos).toBe(2);
    });

    it('debe invalidar la caché al desactivar o eliminar un producto', async () => {
      const cacheKey = RedisCacheService.getCatalogSucursalKey(sucursalId);
      await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);

      await productoService.deactivate(productoId, tenantId);
      expect(await cacheService.get(cacheKey)).toBeNull();

      const catalogo = await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);
      // Solo deben listarse productos activos
      expect(catalogo.totalProductos).toBe(0);
    });

    it('debe invalidar la caché al crear o actualizar una categoría', async () => {
      const cacheKey = RedisCacheService.getCatalogSucursalKey(sucursalId);
      await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);

      await categoriaService.create(
        {
          nombre: 'Carnes de Cerdo',
          ordenVisualizacion: 2,
        },
        tenantId,
      );

      expect(await cacheService.get(cacheKey)).toBeNull();
      const catalogo = await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);
      expect(catalogo.categorias).toHaveLength(2);
    });
  });

  describe('3. Invalidación Reactiva mediante Bus de Eventos (EventEmitter2)', () => {
    it('debe invalidar caché reactivamente cuando se emite CatalogoModificadoEvent', async () => {
      const cacheKey = RedisCacheService.getCatalogSucursalKey(sucursalId);
      await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);
      expect(await cacheService.get(cacheKey)).not.toBeNull();

      const spyListener = jest.spyOn(listener, 'handleCatalogoModificado');

      // Emisión de evento de dominio
      eventEmitter.emit(
        CatalogoModificadoEvent.EVENT_NAME,
        new CatalogoModificadoEvent(tenantId, productoId, 'precio', sucursalId),
      );

      // Esperar micro-tick para propagación asíncrona
      await new Promise((r) => setTimeout(r, 50));

      expect(spyListener).toHaveBeenCalled();
      expect(await cacheService.get(cacheKey)).toBeNull();
    });
  });

  describe('4. Resiliencia y Fallback ante Desconexión o Fallos de Redis', () => {
    it('debe responder correctamente desde la base de datos si el método get de Redis lanza error', async () => {
      const spyCacheGet = jest.spyOn(cacheService, 'get').mockRejectedValueOnce(new Error('Redis connection timeout'));

      // No debe lanzar 500 ni fallar la petición
      const catalogo = await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);

      expect(catalogo).toBeDefined();
      expect(catalogo.productos).toHaveLength(1);
      expect(catalogo.fromCache).toBe(false);
      expect(spyCacheGet).toHaveBeenCalled();
    });

    it('debe continuar exitosamente si el método set de Redis falla', async () => {
      jest.spyOn(cacheService, 'set').mockRejectedValueOnce(new Error('Redis readonly replica error'));

      const catalogo = await productoService.obtenerCatalogoPorSucursal(sucursalId, tenantId);

      expect(catalogo).toBeDefined();
      expect(catalogo.productos).toHaveLength(1);
    });
  });
});
