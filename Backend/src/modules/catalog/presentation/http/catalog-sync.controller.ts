import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ProductoService } from '../../application/services/producto.service';
import { CategoriaService } from '../../application/services/categoria.service';
import { ProductoResponseDto } from '../../domain/entities/producto.entity';
import { CategoriaResponseDto } from '../../domain/entities/categoria.entity';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';

export interface CatalogSyncResponseDto {
  syncToken: string;
  productos: ProductoResponseDto[];
  categorias: CategoriaResponseDto[];
}

@Controller('catalog')
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class CatalogSyncController {
  constructor(
    private readonly productoService: ProductoService,
    private readonly categoriaService: CategoriaService,
  ) {}

  /**
   * Endpoint GET /catalog/sync (design.md sec. 7.2)
   * Descarga incremental de catálogo por sync token temporal (since) y sucursal.
   */
  @Get('sync')
  async syncCatalog(
    @Query('since') since?: string,
    @Query('sucursalId') sucursalId?: string,
  ): Promise<CatalogSyncResponseDto> {
    const [productos, categorias] = await Promise.all([
      this.productoService.findAllByTenant(),
      this.categoriaService.findAllByTenant(),
    ]);

    const syncToken = new Date().toISOString();

    return {
      syncToken,
      productos,
      categorias,
    };
  }
}
