import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CategoriaService } from '../../application/services/categoria.service';
import { CreateCategoriaDto, UpdateCategoriaDto } from '../../application/dtos/categoria.dto';
import { CategoriaResponseDto } from '../../domain/entities/categoria.entity';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/guards/roles.decorator';

@Controller('categories')
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class CategoriesController {
  constructor(private readonly categoriaService: CategoriaService) {}

  /**
   * Endpoint GET /categories (design.md sec. 7.2 endpoint 8)
   * Retorna categorías del tenant ordenadas por orden_visualizacion ASC para POS.
   */
  @Get()
  async findAll(): Promise<CategoriaResponseDto[]> {
    return this.categoriaService.findAllByTenant();
  }

  /**
   * Endpoint POST /categories (design.md sec. 7.2 endpoint 8)
   */
  @Post()
  @Roles('Administrador', 'Dueño')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateCategoriaDto): Promise<CategoriaResponseDto> {
    return this.categoriaService.create(createDto);
  }

  /**
   * Endpoint GET /categories/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<CategoriaResponseDto> {
    return this.categoriaService.findById(id);
  }

  /**
   * Endpoint PATCH /categories/:id
   */
  @Patch(':id')
  @Roles('Administrador', 'Dueño')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCategoriaDto,
  ): Promise<CategoriaResponseDto> {
    return this.categoriaService.update(id, updateDto);
  }

  /**
   * Endpoint DELETE /categories/:id
   */
  @Delete(':id')
  @Roles('Administrador', 'Dueño')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    const deleted = await this.categoriaService.delete(id);
    return { success: deleted };
  }
}
