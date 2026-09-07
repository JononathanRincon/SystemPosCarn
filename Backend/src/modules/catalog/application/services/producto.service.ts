import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Producto, ProductoResponseDto } from '../../domain/entities/producto.entity';
import {
  ProductoRepositoryPort,
  PRODUCTO_REPOSITORY_PORT,
} from '../../domain/ports/producto-repository.port';
import {
  CategoriaRepositoryPort,
  CATEGORIA_REPOSITORY_PORT,
} from '../../domain/ports/categoria-repository.port';
import { TenantContextService } from './tenant-context.service';
import { CreateProductoDto, UpdateProductoDto, FilterProductosDto } from '../dtos/producto.dto';

@Injectable()
export class ProductoService {
  constructor(
    @Optional()
    @Inject(PRODUCTO_REPOSITORY_PORT)
    private readonly productoRepository?: ProductoRepositoryPort,
    @Optional()
    @Inject(CATEGORIA_REPOSITORY_PORT)
    private readonly categoriaRepository?: CategoriaRepositoryPort,
    @Optional()
    private readonly tenantContextService: TenantContextService = new TenantContextService(),
  ) {}

  /**
   * Registra un nuevo producto validando:
   * - Pertenencia de la categoría al tenant.
   * - Coherencia tipoVenta ('peso'|'unidad') vs unidadMedida ('kg'|'g'|'unidad').
   * - Precio estrictamente mayor a cero con hasta 2 decimales monetarios.
   * - Unicidad opcional de código de barras dentro del tenant.
   */
  async create(dto: CreateProductoDto, tenantIdOverride?: string): Promise<ProductoResponseDto> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();

    // 1. Validar que la categoría exista en este tenant si se inyectó el repositorio de categorías
    if (this.categoriaRepository) {
      const categoria = await this.categoriaRepository.findById(dto.categoriaId, tenantId);
      if (!categoria) {
        throw new BadRequestException(
          `La categoría ${dto.categoriaId} no existe o no pertenece a este negocio`,
        );
      }
    }

    // 2. Validar unicidad de código de barras si fue provisto
    if (dto.codigoBarras && dto.codigoBarras.trim().length > 0) {
      const existente = await this.productoRepository.findByCodigoBarras(
        dto.codigoBarras.trim(),
        tenantId,
      );
      if (existente) {
        throw new ConflictException(
          `Ya existe un producto con el código de barras ${dto.codigoBarras} en este negocio`,
        );
      }
    }

    // 3. Crear entidad de dominio (aplica invariantes de negocio: peso vs unidad, precio > 0)
    const nuevoProducto = new Producto({
      id: crypto.randomUUID(),
      negocioId: tenantId,
      categoriaId: dto.categoriaId,
      nombre: dto.nombre,
      codigoBarras: dto.codigoBarras,
      tipoVenta: dto.tipoVenta,
      unidadMedida: dto.unidadMedida,
      precio: dto.precio,
      costoPromedio: dto.costoPromedio,
      fotoUrl: dto.fotoUrl,
      activo: dto.activo !== undefined ? dto.activo : true,
    });

    const guardado = await this.productoRepository.save(nuevoProducto);
    return guardado.toResponseDto();
  }

  /**
   * Consulta productos del tenant con filtros opcionales (categoriaId, activo).
   */
  async findAllByTenant(
    filtros?: FilterProductosDto,
    tenantIdOverride?: string,
  ): Promise<ProductoResponseDto[]> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const productos = await this.productoRepository.findByNegocioId(tenantId, filtros);
    return productos.map((p) => p.toResponseDto());
  }

  /**
   * Consulta un producto por su ID asegurando pertenencia estricta al tenant.
   */
  async findById(id: string, tenantIdOverride?: string): Promise<ProductoResponseDto> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const producto = await this.productoRepository.findById(id, tenantId);

    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado en este negocio`);
    }

    return producto.toResponseDto();
  }

  /**
   * Búsqueda rápida por código de barras para lector POS (design.md sec. 10.1).
   */
  async findByCodigoBarras(codigoBarras: string, tenantIdOverride?: string): Promise<ProductoResponseDto> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const producto = await this.productoRepository.findByCodigoBarras(codigoBarras.trim(), tenantId);

    if (!producto) {
      throw new NotFoundException(`Producto con código de barras ${codigoBarras} no encontrado`);
    }

    return producto.toResponseDto();
  }

  /**
   * Actualiza los datos de un producto del tenant.
   */
  async update(id: string, dto: UpdateProductoDto, tenantIdOverride?: string): Promise<ProductoResponseDto> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const producto = await this.productoRepository.findById(id, tenantId);

    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado en este negocio`);
    }

    if (dto.categoriaId && this.categoriaRepository) {
      const categoria = await this.categoriaRepository.findById(dto.categoriaId, tenantId);
      if (!categoria) {
        throw new BadRequestException(
          `La categoría ${dto.categoriaId} no existe o no pertenece a este negocio`,
        );
      }
    }

    producto.actualizar({
      nombre: dto.nombre,
      categoriaId: dto.categoriaId,
      codigoBarras: dto.codigoBarras,
      tipoVenta: dto.tipoVenta,
      unidadMedida: dto.unidadMedida,
      precio: dto.precio,
      costoPromedio: dto.costoPromedio,
      fotoUrl: dto.fotoUrl,
    });

    const guardado = await this.productoRepository.save(producto);
    return guardado.toResponseDto();
  }

  /**
   * Desactiva un producto del catálogo.
   */
  async deactivate(id: string, tenantIdOverride?: string): Promise<ProductoResponseDto> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const producto = await this.productoRepository.findById(id, tenantId);

    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado en este negocio`);
    }

    producto.desactivar();
    const guardado = await this.productoRepository.save(producto);
    return guardado.toResponseDto();
  }

  /**
   * Elimina un producto si pertenece al tenant.
   */
  async delete(id: string, tenantIdOverride?: string): Promise<boolean> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    return this.productoRepository.delete(id, tenantId);
  }

  /**
   * Calcula el subtotal monetario de una línea de venta para el producto dado (EARS-VENTA-01).
   */
  async calcularTotalLinea(id: string, cantidad: number, tenantIdOverride?: string): Promise<number> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const producto = await this.productoRepository.findById(id, tenantId);

    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado en este negocio`);
    }

    return producto.calcularSubtotalLinea(cantidad);
  }
}
