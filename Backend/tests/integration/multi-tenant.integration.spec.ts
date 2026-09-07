import { ExecutionContext, CallHandler, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { of } from 'rxjs';
import { NegocioService } from '../../src/modules/catalog/application/services/negocio.service';
import { SucursalService } from '../../src/modules/catalog/application/services/sucursal.service';
import { TenantContextService } from '../../src/modules/catalog/application/services/tenant-context.service';
import { TenantMiddleware, TenantRequest } from '../../src/modules/catalog/presentation/middleware/tenant.middleware';
import { TenantInterceptor } from '../../src/modules/catalog/presentation/interceptors/tenant.interceptor';
import { Negocio } from '../../src/modules/catalog/domain/entities/negocio.entity';
import { Sucursal } from '../../src/modules/catalog/domain/entities/sucursal.entity';
import { NegocioRepositoryPort } from '../../src/modules/catalog/domain/ports/negocio-repository.port';
import { SucursalRepositoryPort } from '../../src/modules/catalog/domain/ports/sucursal-repository.port';

describe('TASK-07: Integración y Aislamiento Estricto Multi-Tenant en Servicios de Catálogo', () => {
  let tenantContextService: TenantContextService;
  let negocioService: NegocioService;
  let sucursalService: SucursalService;

  // Repositorios en memoria aislados para pruebas
  let negociosStore: Map<string, Negocio>;
  let sucursalesStore: Map<string, Sucursal>;
  let mockNegocioRepo: NegocioRepositoryPort;
  let mockSucursalRepo: SucursalRepositoryPort;

  beforeEach(() => {
    negociosStore = new Map();
    sucursalesStore = new Map();
    tenantContextService = new TenantContextService();

    mockNegocioRepo = {
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

    mockSucursalRepo = {
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

    negocioService = new NegocioService(mockNegocioRepo);
    sucursalService = new SucursalService(mockSucursalRepo, tenantContextService);
  });

  describe('1. Aislamiento Multi-Tenant en Sucursales (Cero Fuga Cross-Tenant)', () => {
    const tenantA = 'tenant-negocio-aaa-111';
    const tenantB = 'tenant-negocio-bbb-222';

    beforeEach(async () => {
      // Crear sucursales de Negocio A
      await sucursalService.create(
        { nombre: 'Sucursal Norte A', direccion: 'Calle 100 #10-20', ciudad: 'Bogotá' },
        tenantA,
      );
      await sucursalService.create(
        { nombre: 'Sucursal Sur A', direccion: 'Av 1 de Mayo #50-10', ciudad: 'Bogotá' },
        tenantA,
      );

      // Crear sucursales de Negocio B
      await sucursalService.create(
        { nombre: 'Sucursal Centro B', direccion: 'Carrera 7 #15-30', ciudad: 'Medellín' },
        tenantB,
      );
    });

    it('debe listar únicamente las sucursales del tenant activo sin fuga de datos', async () => {
      // Consultar sucursales de Negocio A
      const sucursalesA = await sucursalService.findAllByTenant(tenantA);
      expect(sucursalesA).toHaveLength(2);
      expect(sucursalesA.every((s) => s.negocioId === tenantA)).toBe(true);
      expect(sucursalesA.map((s) => s.nombre)).toEqual(
        expect.arrayContaining(['Sucursal Norte A', 'Sucursal Sur A']),
      );

      // Consultar sucursales de Negocio B
      const sucursalesB = await sucursalService.findAllByTenant(tenantB);
      expect(sucursalesB).toHaveLength(1);
      expect(sucursalesB[0].negocioId).toBe(tenantB);
      expect(sucursalesB[0].nombre).toBe('Sucursal Centro B');
    });

    it('debe impedir que un usuario del Tenant A consulte por ID una sucursal del Tenant B', async () => {
      const sucursalesB = await sucursalService.findAllByTenant(tenantB);
      const idSucursalB = sucursalesB[0].id;

      // Tenant A intenta consultar sucursal de B
      await expect(sucursalService.findById(idSucursalB, tenantA)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('debe impedir que un usuario del Tenant A actualice una sucursal del Tenant B', async () => {
      const sucursalesB = await sucursalService.findAllByTenant(tenantB);
      const idSucursalB = sucursalesB[0].id;

      await expect(
        sucursalService.update(idSucursalB, { nombre: 'Intento Hack Nombre' }, tenantA),
      ).rejects.toThrow(NotFoundException);

      // Verificar que el nombre original en B no cambió
      const sucursalBOriginal = await sucursalService.findById(idSucursalB, tenantB);
      expect(sucursalBOriginal.nombre).toBe('Sucursal Centro B');
    });

    it('debe impedir que un usuario del Tenant A elimine una sucursal del Tenant B', async () => {
      const sucursalesB = await sucursalService.findAllByTenant(tenantB);
      const idSucursalB = sucursalesB[0].id;

      const resultadoDelete = await sucursalService.delete(idSucursalB, tenantA);
      expect(resultadoDelete).toBe(false);

      // La sucursal debe seguir existiendo en el Tenant B
      const sucursalesBPost = await sucursalService.findAllByTenant(tenantB);
      expect(sucursalesBPost).toHaveLength(1);
    });
  });

  describe('2. Inyección Automática de Contexto vía Middleware e Interceptor', () => {
    it('TenantMiddleware debe extraer tenantId desde la cabecera X-Tenant-ID y ejecutar el contexto', (done) => {
      const middleware = new TenantMiddleware(tenantContextService);
      const req: TenantRequest = {
        headers: { 'x-tenant-id': 'tenant-header-uuid-999' },
      } as any;
      const res: any = {};

      middleware.use(req, res, () => {
        expect(req.tenantId).toBe('tenant-header-uuid-999');
        expect(tenantContextService.getTenantId()).toBe('tenant-header-uuid-999');
        done();
      });
    });

    it('TenantMiddleware debe extraer tenantId desde req.user.negocioId si viene autenticado con JWT', (done) => {
      const middleware = new TenantMiddleware(tenantContextService);
      const req: TenantRequest = {
        headers: {},
        user: { negocioId: 'tenant-jwt-negocio-555' },
      } as any;
      const res: any = {};

      middleware.use(req, res, () => {
        expect(req.tenantId).toBe('tenant-jwt-negocio-555');
        expect(tenantContextService.getTenantId()).toBe('tenant-jwt-negocio-555');
        done();
      });
    });

    it('TenantInterceptor debe arrojar BadRequestException si no existe tenantId en la petición', () => {
      const interceptor = new TenantInterceptor(tenantContextService);
      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as any;
      const next: CallHandler = {
        handle: () => of({}),
      };

      expect(() => interceptor.intercept(context, next)).toThrow(BadRequestException);
    });

    it('TenantInterceptor debe inyectar tenantId en TenantContextService si viene presente', (done) => {
      const interceptor = new TenantInterceptor(tenantContextService);
      const req: any = { headers: { 'x-tenant-id': 'tenant-valido-123' } };
      const context: ExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any;
      const next: CallHandler = {
        handle: () => of({ success: true }),
      };

      interceptor.intercept(context, next).subscribe(() => {
        expect(req.tenantId).toBe('tenant-valido-123');
        expect(tenantContextService.getTenantId()).toBe('tenant-valido-123');
        done();
      });
    });
  });

  describe('3. Concurrencia y Aislamiento Thread-Safe (AsyncLocalStorage)', () => {
    it('debe mantener contextos de tenant completamente aislados en ejecuciones asíncronas simultáneas', async () => {
      const tareaTenantA = tenantContextService.runWithTenant('tenant-ALPHA', async () => {
        // Simular latencia de I/O
        await new Promise((resolve) => setTimeout(resolve, 20));
        return tenantContextService.getTenantId();
      });

      const tareaTenantB = tenantContextService.runWithTenant('tenant-BETA', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return tenantContextService.getTenantId();
      });

      const [resultadoA, resultadoB] = await Promise.all([tareaTenantA, tareaTenantB]);

      expect(resultadoA).toBe('tenant-ALPHA');
      expect(resultadoB).toBe('tenant-BETA');
    });
  });

  describe('4. NegocioService (Registro de Negocios y Unicidad de NIT)', () => {
    it('debe registrar un negocio con plan por defecto basico', async () => {
      const dto = {
        nombreComercial: 'Carnicería El Buen Corte',
        razonSocial: 'El Buen Corte SAS',
        nitRut: '900111222-3',
      };

      const creado = await negocioService.create(dto);
      expect(creado.id).toBeDefined();
      expect(creado.nombreComercial).toBe(dto.nombreComercial);
      expect(creado.nitRut).toBe(dto.nitRut);
      expect(creado.plan).toBe('basico');
      expect(creado.activo).toBe(true);
    });

    it('debe arrojar ConflictException si se intenta registrar un negocio con un NIT/RUT ya existente', async () => {
      const dto = {
        nombreComercial: 'Carnes Premium',
        razonSocial: 'Carnes Premium Ltda',
        nitRut: '900888777-1',
      };

      await negocioService.create(dto);

      // Segundo intento con mismo NIT
      await expect(
        negocioService.create({
          nombreComercial: 'Otra Carnicería',
          razonSocial: 'Otra Razón',
          nitRut: '900888777-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
