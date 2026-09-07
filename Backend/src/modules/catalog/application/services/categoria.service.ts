import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Categoria, CategoriaResponseDto } from '../../domain/entities/categoria.entity';
import {
  CategoriaRepositoryPort,
  CATEGORIA_REPOSITORY_PORT,
} from '../../domain/ports/categoria-repository.port';
import { TenantContextService } from './tenant-context.service';
import { CreateCategoriaDto, UpdateCategoriaDto } from '../dtos/categoria.dto';

@Injectable()
export class CategoriaService {
  constructor(
    @Optional()
    @Inject(CATEGORIA_REPOSITORY_PORT)
    private readonly categoriaRepository?: CategoriaRepositoryPort,
    @Optional()
    private readonly tenantContextService: TenantContextService = new TenantContextService(),
  ) {}

  /**
   * Crea una nueva categoría vinculada al tenant actual.
   */
  async create(dto: CreateCategoriaDto, tenantIdOverride?: string): Promise<CategoriaResponseDto> {
    if (!this.categoriaRepository) {
      throw new Error('CategoriaRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();

    const nuevaCategoria = new Categoria({
      id: crypto.randomUUID(),
      negocioId: tenantId,
      nombre: dto.nombre,
      ordenVisualizacion: dto.ordenVisualizacion !== undefined ? dto.ordenVisualizacion : 0,
    });

    const guardada = await this.categoriaRepository.save(nuevaCategoria);
    return guardada.toResponseDto();
  }

  /**
   * Retorna todas las categorías del tenant ordenadas por orden_visualizacion ASC (design.md sec. 2).
   */
  async findAllByTenant(tenantIdOverride?: string): Promise<CategoriaResponseDto[]> {
    if (!this.categoriaRepository) {
      throw new Error('CategoriaRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const categorias = await this.categoriaRepository.findByNegocioId(tenantId);

    // Ordenamiento garantizado por ordenVisualizacion ascendente para agilidad en POS
    return categorias
      .sort((a, b) => a.ordenVisualizacion - b.ordenVisualizacion)
      .map((c) => c.toResponseDto());
  }

  /**
   * Consulta una categoría por ID dentro del tenant actual.
   */
  async findById(id: string, tenantIdOverride?: string): Promise<CategoriaResponseDto> {
    if (!this.categoriaRepository) {
      throw new Error('CategoriaRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const categoria = await this.categoriaRepository.findById(id, tenantId);

    if (!categoria) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada en este negocio`);
    }

    return categoria.toResponseDto();
  }

  /**
   * Actualiza nombre u orden de una categoría.
   */
  async update(id: string, dto: UpdateCategoriaDto, tenantIdOverride?: string): Promise<CategoriaResponseDto> {
    if (!this.categoriaRepository) {
      throw new Error('CategoriaRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const categoria = await this.categoriaRepository.findById(id, tenantId);

    if (!categoria) {
      throw new NotFoundException(`Categoría con ID ${id} no encontrada en este negocio`);
    }

    categoria.actualizar({
      nombre: dto.nombre,
      ordenVisualizacion: dto.ordenVisualizacion,
    });

    const guardada = await this.categoriaRepository.save(categoria);
    return guardada.toResponseDto();
  }

  /**
   * Elimina una categoría del tenant activo.
   */
  async delete(id: string, tenantIdOverride?: string): Promise<boolean> {
    if (!this.categoriaRepository) {
      throw new Error('CategoriaRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    return this.categoriaRepository.delete(id, tenantId);
  }
}
