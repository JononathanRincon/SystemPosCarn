import { NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SucursalService } from '../../../src/modules/catalog/application/services/sucursal.service';
import { TenantContextService } from '../../../src/modules/catalog/application/services/tenant-context.service';
import { Sucursal } from '../../../src/modules/catalog/domain/entities/sucursal.entity';
import { SucursalRepositoryPort } from '../../../src/modules/catalog/domain/ports/sucursal-repository.port';

describe('SucursalService (Unitario)', () => {
  let sucursalService: SucursalService;
  let tenantContextService: TenantContextService;
  let mockRepository: jest.Mocked<SucursalRepositoryPort>;
  let sucursalesStore: Map<string, Sucursal>;

  const defaultTenantId = 'tenant-negocio-uuid-1111';

  beforeEach(() => {
    sucursalesStore = new Map();
    tenantContextService = new TenantContextService();
    tenantContextService.setTenantId(defaultTenantId);

    mockRepository = {
      findById: jest.fn(async (id: string) => sucursalesStore.get(id) || null),
      findByNegocioId: jest.fn(async (negocioId: string) => {
        return Array.from(sucursalesStore.values()).filter((s) => s.negocioId === negocioId);
      }),
      findByIdAndNegocioId: jest.fn(async (id: string, negocioId: string) => {
        const s = sucursalesStore.get(id);
        if (s && s.negocioId === negocioId) return s;
        return null;
      }),
      save: jest.fn(async (sucursal: Sucursal) => {
        sucursalesStore.set(sucursal.id, sucursal);
        return sucursal;
      }),
      delete: jest.fn(async (id: string, negocioId: string) => {
        const s = sucursalesStore.get(id);
        if (s && s.negocioId === negocioId) {
          sucursalesStore.delete(id);
          return true;
        }
        return false;
      }),
    };

    sucursalService = new SucursalService(mockRepository, tenantContextService);
  });

  it('debe asociar la sucursal únicamente al tenant_id correcto', async () => {
    const creada = await sucursalService.create({
      nombre: 'Sucursal Principal',
      direccion: 'Carrera 15 #85-10',
      ciudad: 'Bogotá',
    });

    expect(creada.id).toBeDefined();
    expect(creada.negocioId).toBe(defaultTenantId);
    expect(creada.nombre).toBe('Sucursal Principal');
    expect(creada.zonaHoraria).toBe('America/Bogota');
  });

  it('debe requerir nombre válido y zona horaria por defecto', async () => {
    await expect(
      sucursalService.create({
        nombre: '   ',
      }),
    ).rejects.toThrow('El nombre de la sucursal es obligatorio');
  });

  it('debe arrojar UnauthorizedException si se intenta operar sin contexto de tenant', async () => {
    tenantContextService.clear();

    await expect(
      sucursalService.create({
        nombre: 'Sucursal Sin Tenant',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('debe actualizar los datos de una sucursal del tenant activo', async () => {
    const creada = await sucursalService.create({
      nombre: 'Sucursal Antigua',
      ciudad: 'Cali',
    });

    const actualizada = await sucursalService.update(creada.id, {
      nombre: 'Sucursal Renovada',
      direccion: 'Calle 5 #10-20',
    });

    expect(actualizada.nombre).toBe('Sucursal Renovada');
    expect(actualizada.direccion).toBe('Calle 5 #10-20');
  });
});
