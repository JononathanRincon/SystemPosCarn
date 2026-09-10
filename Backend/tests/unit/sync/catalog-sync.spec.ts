import { CatalogSyncController } from '../../../src/modules/catalog/presentation/http/catalog-sync.controller';
import { ProductoService } from '../../../src/modules/catalog/application/services/producto.service';
import { CategoriaService } from '../../../src/modules/catalog/application/services/categoria.service';

describe('CatalogSyncController (Unitario)', () => {
  let controller: CatalogSyncController;
  let mockProductoService: Partial<ProductoService>;
  let mockCategoriaService: Partial<CategoriaService>;

  const mockProductos = [
    {
      id: 'prod-1',
      negocioId: 'neg-1',
      categoriaId: 'cat-1',
      nombre: 'Lomo Fino de Res',
      codigoBarras: '770123456789',
      tipoVenta: 'peso' as const,
      unidadMedida: 'kg' as const,
      precio: 45000,
      costoPromedio: 32000,
      fotoUrl: null,
      activo: true,
    },
    {
      id: 'prod-2',
      negocioId: 'neg-1',
      categoriaId: 'cat-1',
      nombre: 'Costilla de Cerdo',
      codigoBarras: null,
      tipoVenta: 'peso' as const,
      unidadMedida: 'kg' as const,
      precio: 28000,
      costoPromedio: 19000,
      fotoUrl: null,
      activo: true,
    },
  ];

  const mockCategorias = [
    {
      id: 'cat-1',
      negocioId: 'neg-1',
      nombre: 'Res',
      ordenVisualizacion: 1,
    },
    {
      id: 'cat-2',
      negocioId: 'neg-1',
      nombre: 'Cerdo',
      ordenVisualizacion: 2,
    },
  ];

  beforeEach(() => {
    mockProductoService = {
      findAllByTenant: jest.fn().mockResolvedValue(mockProductos),
    };

    mockCategoriaService = {
      findAllByTenant: jest.fn().mockResolvedValue(mockCategorias),
    };

    controller = new CatalogSyncController(
      mockProductoService as ProductoService,
      mockCategoriaService as CategoriaService,
    );
  });

  it('debe retornar el catálogo completo de productos y categorías con syncToken cuando no se envía since', async () => {
    const result = await controller.syncCatalog();

    expect(result).toBeDefined();
    expect(result.syncToken).toBeDefined();
    expect(new Date(result.syncToken).getTime()).not.toBeNaN();
    expect(result.productos).toHaveLength(2);
    expect(result.categorias).toHaveLength(2);
    expect(result.productos[0].nombre).toBe('Lomo Fino de Res');
    expect(result.categorias[0].nombre).toBe('Res');
    expect(mockProductoService.findAllByTenant).toHaveBeenCalled();
    expect(mockCategoriaService.findAllByTenant).toHaveBeenCalled();
  });

  it('debe responder con syncToken ISO válido y catálogo al enviar since', async () => {
    const sinceTimestamp = new Date(Date.now() - 3600000).toISOString();
    const result = await controller.syncCatalog(sinceTimestamp, 'sucursal-1');

    expect(result).toBeDefined();
    expect(result.syncToken).toBeDefined();
    expect(result.productos).toBeDefined();
    expect(result.categorias).toBeDefined();
  });
});
