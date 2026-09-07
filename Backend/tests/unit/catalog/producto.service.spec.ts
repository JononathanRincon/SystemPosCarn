import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductoService } from '../../../src/modules/catalog/application/services/producto.service';
import { TenantContextService } from '../../../src/modules/catalog/application/services/tenant-context.service';
import { Producto } from '../../../src/modules/catalog/domain/entities/producto.entity';
import { Categoria } from '../../../src/modules/catalog/domain/entities/categoria.entity';
import { ProductoRepositoryPort } from '../../../src/modules/catalog/domain/ports/producto-repository.port';
import { CategoriaRepositoryPort } from '../../../src/modules/catalog/domain/ports/categoria-repository.port';

describe('TASK-08: ProductoService (Unitario) — Soporte de Peso/Unidad y EARS-VENTA-01', () => {
  let productoService: ProductoService;
  let tenantContextService: TenantContextService;
  let mockProductoRepo: ProductoRepositoryPort;
  let mockCategoriaRepo: CategoriaRepositoryPort;

  let productosStore: Map<string, Producto>;
  let categoriasStore: Map<string, Categoria>;

  const defaultTenantId = 'tenant-carns-101';
  let categoriaRes: Categoria;
  let categoriaAbarrotes: Categoria;

  beforeEach(() => {
    productosStore = new Map();
    categoriasStore = new Map();

    tenantContextService = new TenantContextService();
    tenantContextService.setTenantId(defaultTenantId);

    // Sembrar categorías en el tenant
    categoriaRes = new Categoria({
      id: 'cat-res-uuid',
      negocioId: defaultTenantId,
      nombre: 'Cortes de Res',
      ordenVisualizacion: 1,
    });
    categoriaAbarrotes = new Categoria({
      id: 'cat-abarrotes-uuid',
      negocioId: defaultTenantId,
      nombre: 'Abarrotes y Condimentos',
      ordenVisualizacion: 2,
    });

    categoriasStore.set(categoriaRes.id, categoriaRes);
    categoriasStore.set(categoriaAbarrotes.id, categoriaAbarrotes);

    mockCategoriaRepo = {
      findById: jest.fn(async (id: string, negocioId: string) => {
        const c = categoriasStore.get(id);
        if (c && c.negocioId === negocioId) return c;
        return null;
      }),
      findByNegocioId: jest.fn(async (negocioId: string) => {
        return Array.from(categoriasStore.values()).filter((c) => c.negocioId === negocioId);
      }),
      save: jest.fn(async (c: Categoria) => {
        categoriasStore.set(c.id, c);
        return c;
      }),
      delete: jest.fn(async (id: string, negocioId: string) => {
        const c = categoriasStore.get(id);
        if (c && c.negocioId === negocioId) {
          categoriasStore.delete(id);
          return true;
        }
        return false;
      }),
    };

    mockProductoRepo = {
      findById: jest.fn(async (id: string, negocioId: string) => {
        const p = productosStore.get(id);
        if (p && p.negocioId === negocioId) return p;
        return null;
      }),
      findByNegocioId: jest.fn(async (negocioId: string, options?: { categoriaId?: string; activo?: boolean }) => {
        let prods = Array.from(productosStore.values()).filter((p) => p.negocioId === negocioId);
        if (options?.categoriaId) {
          prods = prods.filter((p) => p.categoriaId === options.categoriaId);
        }
        if (options?.activo !== undefined) {
          prods = prods.filter((p) => p.activo === options.activo);
        }
        return prods;
      }),
      findByCodigoBarras: jest.fn(async (codigoBarras: string, negocioId: string) => {
        for (const p of productosStore.values()) {
          if (p.negocioId === negocioId && p.codigoBarras === codigoBarras) {
            return p;
          }
        }
        return null;
      }),
      save: jest.fn(async (p: Producto) => {
        productosStore.set(p.id, p);
        return p;
      }),
      delete: jest.fn(async (id: string, negocioId: string) => {
        const p = productosStore.get(id);
        if (p && p.negocioId === negocioId) {
          productosStore.delete(id);
          return true;
        }
        return false;
      }),
    };

    productoService = new ProductoService(mockProductoRepo, mockCategoriaRepo, tenantContextService);
  });

  describe('1. Creación de Productos por Peso y Unidad (US-03)', () => {
    it('debe crear un producto por peso admitiendo unidad_medida kg y precio positivo', async () => {
      const dto = {
        categoriaId: categoriaRes.id,
        nombre: 'Lomo Fino de Res',
        tipoVenta: 'peso' as const,
        unidadMedida: 'kg' as const,
        precio: 38500.0,
        costoPromedio: 28000.0,
        codigoBarras: '770123456789',
      };

      const creado = await productoService.create(dto);

      expect(creado.id).toBeDefined();
      expect(creado.negocioId).toBe(defaultTenantId);
      expect(creado.nombre).toBe('Lomo Fino de Res');
      expect(creado.tipoVenta).toBe('peso');
      expect(creado.unidadMedida).toBe('kg');
      expect(creado.precio).toBe(38500.0);
      expect(creado.costoPromedio).toBe(28000.0);
      expect(creado.activo).toBe(true);
    });

    it('debe crear un producto por unidad validando unidad_medida = unidad', async () => {
      const dto = {
        categoriaId: categoriaAbarrotes.id,
        nombre: 'Carbón Vegetal 5kg',
        tipoVenta: 'unidad' as const,
        unidadMedida: 'unidad' as const,
        precio: 16500.0,
        codigoBarras: '770987654321',
      };

      const creado = await productoService.create(dto);

      expect(creado.tipoVenta).toBe('unidad');
      expect(creado.unidadMedida).toBe('unidad');
      expect(creado.precio).toBe(16500.0);
    });

    it('debe rechazar la creación si un producto por peso especifica unidad_medida unidad', async () => {
      const dtoInvalido = {
        categoriaId: categoriaRes.id,
        nombre: 'Punta de Anca',
        tipoVenta: 'peso' as const,
        unidadMedida: 'unidad' as any,
        precio: 32000.0,
      };

      await expect(productoService.create(dtoInvalido)).rejects.toThrow(
        "Un producto por peso no puede tener unidad de medida 'unidad'",
      );
    });

    it('debe rechazar la creación si un producto por unidad especifica unidad_medida kg o g', async () => {
      const dtoInvalido = {
        categoriaId: categoriaAbarrotes.id,
        nombre: 'Cuchillo Carnicero',
        tipoVenta: 'unidad' as const,
        unidadMedida: 'kg' as any,
        precio: 45000.0,
      };

      await expect(productoService.create(dtoInvalido)).rejects.toThrow(
        "Un producto por unidad debe tener unidad de medida 'unidad'",
      );
    });

    it('debe rechazar precios negativos o iguales a cero', async () => {
      const dtoPrecioCero = {
        categoriaId: categoriaRes.id,
        nombre: 'Hueso Rojo',
        tipoVenta: 'peso' as const,
        unidadMedida: 'kg' as const,
        precio: 0,
      };

      await expect(productoService.create(dtoPrecioCero)).rejects.toThrow(
        'El precio debe ser un valor numérico estrictamente mayor a cero',
      );

      const dtoPrecioNegativo = {
        categoriaId: categoriaRes.id,
        nombre: 'Gordana',
        tipoVenta: 'peso' as const,
        unidadMedida: 'kg' as const,
        precio: -1200,
      };

      await expect(productoService.create(dtoPrecioNegativo)).rejects.toThrow(
        'El precio debe ser un valor numérico estrictamente mayor a cero',
      );
    });

    it('debe rechazar la creación si la categoría no existe en el tenant (BadRequestException)', async () => {
      const dtoCatInvalida = {
        categoriaId: 'cat-inexistente-uuid',
        nombre: 'Costilla',
        tipoVenta: 'peso' as const,
        unidadMedida: 'kg' as const,
        precio: 22000.0,
      };

      await expect(productoService.create(dtoCatInvalida)).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar la creación si el código de barras ya existe en el mismo tenant (ConflictException)', async () => {
      await productoService.create({
        categoriaId: categoriaRes.id,
        nombre: 'Sobrebarriga',
        tipoVenta: 'peso' as const,
        unidadMedida: 'kg' as const,
        precio: 24000.0,
        codigoBarras: 'BARCODE-DUPLICADO-123',
      });

      await expect(
        productoService.create({
          categoriaId: categoriaRes.id,
          nombre: 'Sobrebarriga Gruesa',
          tipoVenta: 'peso' as const,
          unidadMedida: 'kg' as const,
          precio: 25000.0,
          codigoBarras: 'BARCODE-DUPLICADO-123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('2. Cálculo de Subtotal de Línea con Precisión Decimal (EARS-VENTA-01)', () => {
    it('debe calcular el subtotal multiplicando kg (3 decimales) por precio unitario redondeando a 2 decimales monetarios', async () => {
      // Producto: Costilla de Cerdo a $22,450.00 el kg
      const producto = await productoService.create({
        categoriaId: categoriaRes.id,
        nombre: 'Costilla de Cerdo Especial',
        tipoVenta: 'peso' as const,
        unidadMedida: 'kg' as const,
        precio: 22450.0,
      });

      // Venta: 1.345 kg (báscula al gramo)
      // 1.345 * 22450 = 30195.25
      const totalLinea1 = await productoService.calcularTotalLinea(producto.id, 1.345);
      expect(totalLinea1).toBe(30195.25);

      // Venta: 0.255 kg
      // 0.255 * 22450 = 5724.75
      const totalLinea2 = await productoService.calcularTotalLinea(producto.id, 0.255);
      expect(totalLinea2).toBe(5724.75);
    });

    it('debe redondear adecuadamente centavos monetarios con precisión flotante', async () => {
      // Producto con precio decimal: $19,990.50
      const producto = await productoService.create({
        categoriaId: categoriaRes.id,
        nombre: 'Carne Molida Especial',
        tipoVenta: 'peso' as const,
        unidadMedida: 'kg' as const,
        precio: 19990.5,
      });

      // Venta: 0.875 kg
      // 0.875 * 19990.5 = 17491.6875 -> redondea a 17491.69
      const total = await productoService.calcularTotalLinea(producto.id, 0.875);
      expect(total).toBe(17491.69);
    });

    it('debe rechazar cantidades fraccionarias en productos por unidad', async () => {
      const productoUnidad = await productoService.create({
        categoriaId: categoriaAbarrotes.id,
        nombre: 'Sal Parrillera 1kg',
        tipoVenta: 'unidad' as const,
        unidadMedida: 'unidad' as const,
        precio: 8500.0,
      });

      await expect(productoService.calcularTotalLinea(productoUnidad.id, 1.5)).rejects.toThrow(
        'Para productos por unidad, la cantidad debe ser un número entero',
      );
    });

    it('debe calcular correctamente productos por unidad con cantidades enteras', async () => {
      const productoUnidad = await productoService.create({
        categoriaId: categoriaAbarrotes.id,
        nombre: 'Salsa BBQ Artesanal',
        tipoVenta: 'unidad' as const,
        unidadMedida: 'unidad' as const,
        precio: 12500.0,
      });

      const total = await productoService.calcularTotalLinea(productoUnidad.id, 4);
      expect(total).toBe(50000.0);
    });
  });

  describe('3. Búsqueda por Código de Barras y Aislamiento Multi-Tenant', () => {
    it('debe encontrar rápidamente un producto por su código de barras (lector POS)', async () => {
      const prod = await productoService.create({
        categoriaId: categoriaRes.id,
        nombre: 'Chorizo Santarrosano',
        tipoVenta: 'unidad' as const,
        unidadMedida: 'unidad' as const,
        precio: 5000.0,
        codigoBarras: '770555444333',
      });

      const encontrado = await productoService.findByCodigoBarras('770555444333');
      expect(encontrado.id).toBe(prod.id);
      expect(encontrado.nombre).toBe('Chorizo Santarrosano');
    });

    it('debe impedir que un producto de otro tenant sea consultado por ID (NotFoundException)', async () => {
      const prodOtroTenant = new Producto({
        id: 'prod-otro-1',
        negocioId: 'otro-tenant-999',
        categoriaId: 'cat-otro',
        nombre: 'Carne Secreta',
        tipoVenta: 'peso',
        unidadMedida: 'kg',
        precio: 50000,
      });
      productosStore.set(prodOtroTenant.id, prodOtroTenant);

      await expect(productoService.findById(prodOtroTenant.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
