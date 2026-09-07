import { ConflictException, NotFoundException } from '@nestjs/common';
import { NegocioService } from '../../../src/modules/catalog/application/services/negocio.service';
import { Negocio } from '../../../src/modules/catalog/domain/entities/negocio.entity';
import { NegocioRepositoryPort } from '../../../src/modules/catalog/domain/ports/negocio-repository.port';

describe('NegocioService (Unitario)', () => {
  let negocioService: NegocioService;
  let mockRepository: jest.Mocked<NegocioRepositoryPort>;
  let negociosStore: Map<string, Negocio>;

  beforeEach(() => {
    negociosStore = new Map();

    mockRepository = {
      findById: jest.fn(async (id: string) => negociosStore.get(id) || null),
      findByNit: jest.fn(async (nit: string) => {
        for (const n of negociosStore.values()) {
          if (n.nitRut === nit) return n;
        }
        return null;
      }),
      save: jest.fn(async (negocio: Negocio) => {
        negociosStore.set(negocio.id, negocio);
        return negocio;
      }),
      findAll: jest.fn(async () => Array.from(negociosStore.values())),
    };

    negocioService = new NegocioService(mockRepository);
  });

  it('debe registrar un nuevo negocio tenant con plan básico o pro', async () => {
    const dto = {
      nombreComercial: 'Carnes Santa Fe',
      razonSocial: 'Santa Fe Carnes SAS',
      nitRut: '900999888-1',
      plan: 'pro' as const,
    };

    const creado = await negocioService.create(dto);

    expect(creado.id).toBeDefined();
    expect(creado.plan).toBe('pro');
    expect(creado.activo).toBe(true);
  });

  it('debe rechazar la creación (ConflictException) si el NIT/RUT ya existe', async () => {
    const dto = {
      nombreComercial: 'Carnes Santa Fe',
      razonSocial: 'Santa Fe Carnes SAS',
      nitRut: '900123456-7',
    };

    await negocioService.create(dto);

    await expect(
      negocioService.create({
        nombreComercial: 'Otra Carniceria',
        razonSocial: 'Otra SAS',
        nitRut: '900123456-7',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('debe actualizar los datos comerciales de un negocio existente', async () => {
    const creado = await negocioService.create({
      nombreComercial: 'Carnes Antiguas',
      razonSocial: 'Carnes Antiguas SAS',
      nitRut: '900111000-1',
    });

    const actualizado = await negocioService.update(creado.id, {
      nombreComercial: 'Carnes Renovadas',
      plan: 'enterprise',
    });

    expect(actualizado.nombreComercial).toBe('Carnes Renovadas');
    expect(actualizado.plan).toBe('enterprise');
  });

  it('debe arrojar NotFoundException al consultar un ID inexistente', async () => {
    await expect(negocioService.findById('uuid-no-existe')).rejects.toThrow(NotFoundException);
  });
});
