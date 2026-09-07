import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import {
  CreateProductoDto,
  UpdateProductoDto,
  FilterProductosDto,
  CambiarPrecioDto,
  CatalogoSucursalDto,
} from '../dtos/producto.dto';
import { RedisCacheService } from '../../../../common/cache/redis-cache.service';
import {
  CatalogoModificadoEvent,
  TipoModificacionCatalogo,
} from '../../domain/events/catalogo-modificado.event';

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
    @Optional()
    private readonly cacheService?: RedisCacheService,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
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
    await this.invalidarCacheCatalogo(tenantId, guardado.id, 'producto');
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
    await this.invalidarCacheCatalogo(tenantId, guardado.id, 'producto');
    return guardado.toResponseDto();
  }

  /**
   * Desactiva un producto del catálogo e invalida caché.
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
    await this.invalidarCacheCatalogo(tenantId, guardado.id, 'producto');
    return guardado.toResponseDto();
  }

  /**
   * Elimina un producto si pertenece al tenant e invalida caché.
   */
  async delete(id: string, tenantIdOverride?: string): Promise<boolean> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const eliminado = await this.productoRepository.delete(id, tenantId);
    if (eliminado) {
      await this.invalidarCacheCatalogo(tenantId, id, 'producto');
    }
    return eliminado;
  }

  /**
   * US-11: Actualización directa de precio de catálogo con distribución automática (invalidación de caché).
   */
  async cambiarPrecio(
    id: string,
    dto: CambiarPrecioDto,
    tenantIdOverride?: string,
  ): Promise<ProductoResponseDto> {
    if (!this.productoRepository) {
      throw new Error('ProductoRepositoryPort no inyectado');
    }

    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const producto = await this.productoRepository.findById(id, tenantId);

    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado en este negocio`);
    }

    producto.actualizar({ precio: dto.precio });
    const guardado = await this.productoRepository.save(producto);
    await this.invalidarCacheCatalogo(tenantId, guardado.id, 'precio');
    return guardado.toResponseDto();
  }

  /**
   * design.md Sec. 1.3, 9.1:
   * Consulta el catálogo de productos y categorías de la sucursal aplicando el patrón Cache-Aside.
   * 1. Consulta Redis en namespace 'catalog:sucursal:{sucursalId}'.
   * 2. Cache Hit: retorna inmediatamente (< 15ms).
   * 3. Cache Miss: consulta repositorio, serializa a JSON, puebla Redis con TTL 3600s y retorna.
   */
  async obtenerCatalogoPorSucursal(
    sucursalId: string,
    tenantIdOverride?: string,
  ): Promise<CatalogoSucursalDto> {
    const cacheKey = RedisCacheService.getCatalogSucursalKey(sucursalId);

    // 1. Intentar Cache Hit en Redis
    if (this.cacheService) {
      try {
        const cached = await this.cacheService.get<CatalogoSucursalDto>(cacheKey);
        if (cached) {
          return { ...cached, fromCache: true };
        }
      } catch {
        // Resiliencia: fallback transparente ante desconexión o fallo de Redis
      }
    }

    // 2. Cache Miss: consultar base de datos
    const tenantId = tenantIdOverride || this.tenantContextService.getRequiredTenantId();
    const productos = await this.findAllByTenant({ activo: true }, tenantId);

    let categorias: any[] = [];
    if (this.categoriaRepository) {
      const categoriasEntidades = await this.categoriaRepository.findByNegocioId(tenantId);
      categorias = categoriasEntidades
        .sort((a, b) => a.ordenVisualizacion - b.ordenVisualizacion)
        .map((c) => c.toResponseDto());
    }

    const catalogo: CatalogoSucursalDto = {
      sucursalId,
      tenantId,
      productos,
      categorias,
      totalProductos: productos.length,
      generadoEn: new Date().toISOString(),
      fromCache: false,
    };

    // 3. Poblar Redis con TTL de 3600s (1 hora)
    if (this.cacheService) {
      try {
        await this.cacheService.set(cacheKey, catalogo, RedisCacheService.DEFAULT_TTL_SECONDS);
      } catch {
        // Resiliencia: continuar sin fallar si Redis no acepta escrituras
      }
    }

    return catalogo;
  }

  /**
   * Helper privado para invalidar proactivamente la caché en Redis y emitir evento de dominio.
   */
  private async invalidarCacheCatalogo(
    tenantId: string,
    entidadId: string,
    tipo: TipoModificacionCatalogo,
    sucursalId?: string,
  ): Promise<void> {
    if (this.cacheService) {
      try {
        if (sucursalId) {
          await this.cacheService.del(RedisCacheService.getCatalogSucursalKey(sucursalId));
        } else {
          await this.cacheService.delPattern('catalog:sucursal:*');
        }
      } catch {
        // Resiliencia en caso de fallo de Redis
      }
    }

    if (this.eventEmitter) {
      this.eventEmitter.emit(
        CatalogoModificadoEvent.EVENT_NAME,
        new CatalogoModificadoEvent(tenantId, entidadId, tipo, sucursalId),
      );
    }
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
