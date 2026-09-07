import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductoService } from '../../application/services/producto.service';
import { CreateProductoDto, UpdateProductoDto, FilterProductosDto } from '../../application/dtos/producto.dto';
import { ProductoResponseDto } from '../../domain/entities/producto.entity';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/guards/roles.decorator';

@Controller('products')
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class ProductsController {
  constructor(private readonly productoService: ProductoService) {}

  /**
   * Endpoint GET /products (design.md sec. 7.2 endpoint 7)
   */
  @Get()
  async findAll(@Query() query: FilterProductosDto): Promise<ProductoResponseDto[]> {
    return this.productoService.findAllByTenant(query);
  }

  /**
   * Endpoint POST /products (design.md sec. 7.2 endpoint 7)
   */
  @Post()
  @Roles('Administrador', 'Dueño')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateProductoDto): Promise<ProductoResponseDto> {
    return this.productoService.create(createDto);
  }

  /**
   * Endpoint GET /products/barcode/:barcode (Lector de código de barras para POS)
   */
  @Get('barcode/:barcode')
  async findByBarcode(@Param('barcode') barcode: string): Promise<ProductoResponseDto> {
    return this.productoService.findByCodigoBarras(barcode);
  }

  /**
   * Endpoint GET /products/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<ProductoResponseDto> {
    return this.productoService.findById(id);
  }

  /**
   * Endpoint PATCH /products/:id (design.md sec. 7.2 endpoint 7)
   * Modificar precios de catálogo está reservado a Administrador (design.md sec. 14.1).
   */
  @Patch(':id')
  @Roles('Administrador', 'Dueño')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductoDto,
  ): Promise<ProductoResponseDto> {
    return this.productoService.update(id, updateDto);
  }

  /**
   * Endpoint PATCH /products/:id/price (US-11: Actualización de precio con distribución automática)
   */
  @Patch(':id/price')
  @Roles('Administrador', 'Dueño')
  async changePrice(
    @Param('id') id: string,
    @Body() body: { precio: number },
  ): Promise<ProductoResponseDto> {
    return this.productoService.cambiarPrecio(id, body);
  }

  /**
   * Endpoint GET /products/branch/:branchId (design.md sec. 1.3: Cache-Aside de catálogo por sucursal)
   */
  @Get('branch/:branchId')
  async getCatalogByBranch(@Param('branchId') branchId: string) {
    return this.productoService.obtenerCatalogoPorSucursal(branchId);
  }

  /**
   * Endpoint DELETE /products/:id
   */
  @Delete(':id')
  @Roles('Administrador', 'Dueño')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    const deleted = await this.productoService.delete(id);
    return { success: deleted };
  }
}
