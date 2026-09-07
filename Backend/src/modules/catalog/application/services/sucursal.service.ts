import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Sucursal, SucursalResponseDto } from '../../domain/entities/sucursal.entity';
import {
  SucursalRepositoryPort,
  SUCURSAL_REPOSITORY_PORT,
} from '../../domain/ports/sucursal-repository.port';
import { TenantContextService } from './tenant-context.service';
import { CreateSucursalDto, UpdateSucursalDto } from '../dtos/sucursal.dto';

@Injectable()
export class SucursalService {
  constructor(
    @Optional()
    @Inject(SUCURSAL_REPOSITORY_PORT)
    private readonly sucursalRepository?: SucursalRepositoryPort,
    @Optional()
    private readonly tenantContextService: TenantContextService = new TenantContextService(),
  ) {}

  /**
   * Registra una nueva Sucursal asociada estrictamente al tenant activo.
   */
  async create(dto: CreateSucursalDto, tenantIdOverride?: string): Promise<SucursalResponseDto> {
    if (!this.sucursalRepository) {
      throw new Error('SucursalRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || dto.negocioId || this.tenantContextService.getRequiredTenantId();

    const nuevaSucursal = new Sucursal({
      id: crypto.randomUUID(),
      negocioId: tenantId,
      nombre: dto.nombre,
      direccion: dto.direccion,
      ciudad: dto.ciudad,
      zonaHoraria: dto.zonaHoraria || 'America/Bogota',
      activo: true,
    });

    const guardada = await this.sucursalRepository.save(nuevaSucursal);
    return guardada.toResponseDto();
  }

  /**
   * Lista todas las sucursales pertenecientes exclusivamente al tenant activo.
   * Impide estrictamente cualquier fuga de datos hacia otros tenants (design.md sec. 11).
   */
  async findAllByTenant(tenantIdOverride?: string): Promise<SucursalResponseDto[]> {
    if (!this.sucursalRepository) {
      throw new Error('SucursalRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const sucursales = await this.sucursalRepository.findByNegocioId(tenantId);
    return sucursales.map((s) => s.toResponseDto());
  }

  /**
   * Consulta una sucursal por ID validando pertenencia forzada al tenant.
   * Si la sucursal existe pero pertenece a otro tenant, rechaza el acceso con ForbiddenException / NotFoundException.
   */
  async findById(id: string, tenantIdOverride?: string): Promise<SucursalResponseDto> {
    if (!this.sucursalRepository) {
      throw new Error('SucursalRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();

    let sucursal: Sucursal | null = null;
    if (this.sucursalRepository.findByIdAndNegocioId) {
      sucursal = await this.sucursalRepository.findByIdAndNegocioId(id, tenantId);
    } else {
      sucursal = await this.sucursalRepository.findById(id);
      if (sucursal && sucursal.negocioId !== tenantId) {
        throw new ForbiddenException('Acceso denegado: la sucursal no pertenece al negocio activo');
      }
    }

    if (!sucursal) {
      throw new NotFoundException(`Sucursal con ID ${id} no encontrada en este negocio`);
    }

    return sucursal.toResponseDto();
  }

  /**
   * Actualiza datos de una sucursal verificando aislamiento multi-tenant.
   */
  async update(id: string, dto: UpdateSucursalDto, tenantIdOverride?: string): Promise<SucursalResponseDto> {
    if (!this.sucursalRepository) {
      throw new Error('SucursalRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();

    let sucursal: Sucursal | null = null;
    if (this.sucursalRepository.findByIdAndNegocioId) {
      sucursal = await this.sucursalRepository.findByIdAndNegocioId(id, tenantId);
    } else {
      sucursal = await this.sucursalRepository.findById(id);
      if (sucursal && sucursal.negocioId !== tenantId) {
        throw new ForbiddenException('Acceso denegado: la sucursal no pertenece al negocio activo');
      }
    }

    if (!sucursal) {
      throw new NotFoundException(`Sucursal con ID ${id} no encontrada en este negocio`);
    }

    sucursal.actualizar({
      nombre: dto.nombre,
      direccion: dto.direccion,
      ciudad: dto.ciudad,
      zonaHoraria: dto.zonaHoraria,
    });

    const guardada = await this.sucursalRepository.save(sucursal);
    return guardada.toResponseDto();
  }

  /**
   * Desactiva una sucursal verificando aislamiento multi-tenant.
   */
  async deactivate(id: string, tenantIdOverride?: string): Promise<SucursalResponseDto> {
    if (!this.sucursalRepository) {
      throw new Error('SucursalRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();

    const sucursal = await this.sucursalRepository.findById(id);
    if (!sucursal) {
      throw new NotFoundException(`Sucursal con ID ${id} no encontrada`);
    }

    if (sucursal.negocioId !== tenantId) {
      throw new ForbiddenException('Acceso denegado: la sucursal no pertenece al negocio activo');
    }

    sucursal.desactivar();
    const guardada = await this.sucursalRepository.save(sucursal);
    return guardada.toResponseDto();
  }

  /**
   * Elimina una sucursal validando aislamiento multi-tenant.
   */
  async delete(id: string, tenantIdOverride?: string): Promise<boolean> {
    if (!this.sucursalRepository) {
      throw new Error('SucursalRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    return this.sucursalRepository.delete(id, tenantId);
  }

  getTenantContextService(): TenantContextService {
    return this.tenantContextService;
  }
}
