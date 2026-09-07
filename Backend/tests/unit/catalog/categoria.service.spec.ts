import { NotFoundException } from '@nestjs/common';
import { CategoriaService } from '../../../src/modules/catalog/application/services/categoria.service';
import { TenantContextService } from '../../../src/modules/catalog/application/services/tenant-context.service';
import { Categoria } from '../../../src/modules/catalog/domain/entities/categoria.entity';
import { CategoriaRepositoryPort } from '../../../src/modules/catalog/domain/ports/categoria-repository.port';

describe('CategoriaService (Unitario)', () => {
  let categoriaService: CategoriaService;
  let tenantContextService: TenantContextService;
  let mockRepo: CategoriaRepositoryPort;
  let store: Map<string, Categoria>;

  const defaultTenantId = 'tenant-uuid-111';

  beforeEach(() => {
    store = new Map();
    tenantContextService = new TenantContextService();
    tenantContextService.setTenantId(defaultTenantId);

    mockRepo = {
      findById: jest.fn(async (id: string, negocioId: string) => {
        const c = store.get(id);
        if (c && c.negocioId === negocioId) return c;
        return null;
      }),
      findByNegocioId: jest.fn(async (negocioId: string) => {
        return Array.from(store.values()).filter((c) => c.negocioId === negocioId);
      }),
      save: jest.fn(async (c: Categoria) => {
        store.set(c.id, c);
        return c;
      }),
      delete: jest.fn(async (id: string, negocioId: string) => {
        const c = store.get(id);
        if (c && c.negocioId === negocioId) {
          store.delete(id);
          return true;
        }
        return false;
      }),
    };

    categoriaService = new CategoriaService(mockRepo, tenantContextService);
  });

  it('debe crear una categoría vinculada al tenant_id activo', async () => {
    const creada = await categoriaService.create({
      nombre: 'Cortes de Res',
      ordenVisualizacion: 1,
    });

    expect(creada.id).toBeDefined();
    expect(creada.negocioId).toBe(defaultTenantId);
    expect(creada.nombre).toBe('Cortes de Res');
    expect(creada.ordenVisualizacion).toBe(1);
  });

  it('debe ordenar las categorías según orden_visualizacion ASC para agilizar el POS (design.md sec. 2)', async () => {
    await categoriaService.create({ nombre: 'Pollo', ordenVisualizacion: 3 });
    await categoriaService.create({ nombre: 'Res', ordenVisualizacion: 1 });
    await categoriaService.create({ nombre: 'Cerdo', ordenVisualizacion: 2 });

    const ordenadas = await categoriaService.findAllByTenant();

    expect(ordenadas).toHaveLength(3);
    expect(ordenadas[0].nombre).toBe('Res');
    expect(ordenadas[1].nombre).toBe('Cerdo');
    expect(ordenadas[2].nombre).toBe('Pollo');
    expect(ordenadas[0].ordenVisualizacion).toBeLessThan(ordenadas[1].ordenVisualizacion);
  });

  it('debe actualizar el nombre y orden de una categoría existente', async () => {
    const creada = await categoriaService.create({ nombre: 'Embutidos', ordenVisualizacion: 5 });

    const actualizada = await categoriaService.update(creada.id, {
      nombre: 'Charcutería y Embutidos',
      ordenVisualizacion: 4,
    });

    expect(actualizada.nombre).toBe('Charcutería y Embutidos');
    expect(actualizada.ordenVisualizacion).toBe(4);
  });

  it('debe arrojar NotFoundException si la categoría pertenece a otro tenant', async () => {
    const catOtroTenant = new Categoria({
      id: 'cat-otro-1',
      negocioId: 'otro-tenant-999',
      nombre: 'Lácteos',
    });
    store.set(catOtroTenant.id, catOtroTenant);

    await expect(categoriaService.findById(catOtroTenant.id)).rejects.toThrow(NotFoundException);
  });

  it('debe eliminar una categoría existente del tenant', async () => {
    const creada = await categoriaService.create({ nombre: 'Temporada' });
    const eliminada = await categoriaService.delete(creada.id);

    expect(eliminada).toBe(true);
    expect(store.has(creada.id)).toBe(false);
  });
});
