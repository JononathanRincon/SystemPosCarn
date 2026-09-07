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
import { SucursalService } from '../../application/services/sucursal.service';
import { CreateSucursalDto, UpdateSucursalDto } from '../../application/dtos/sucursal.dto';
import { SucursalResponseDto } from '../../domain/entities/sucursal.entity';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/guards/roles.decorator';

@Controller('branches')
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class BranchesController {
  constructor(private readonly sucursalService: SucursalService) {}

  /**
   * Endpoint GET /branches (design.md sec. 7.2 endpoint 11)
   * Retorna todas las sucursales pertenecientes al tenant autenticado.
   */
  @Get()
  async findAll(): Promise<SucursalResponseDto[]> {
    return this.sucursalService.findAllByTenant();
  }

  /**
   * Endpoint POST /branches (design.md sec. 7.2 endpoint 11)
   * Crea una nueva sucursal vinculada estrictamente al tenant activo.
   */
  @Post()
  @Roles('Administrador', 'Dueño')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createDto: CreateSucursalDto): Promise<SucursalResponseDto> {
    return this.sucursalService.create(createDto);
  }

  /**
   * Endpoint GET /branches/:id (design.md sec. 7.2)
   * Retorna una sucursal validando pertenencia forzada al tenant (404/403 si pertenece a otro).
   */
  @Get(':id')
  async findById(@Param('id') id: string): Promise<SucursalResponseDto> {
    return this.sucursalService.findById(id);
  }

  /**
   * Endpoint PATCH /branches/:id (design.md sec. 7.2)
   */
  @Patch(':id')
  @Roles('Administrador', 'Dueño', 'Gerente Sucursal', 'Gerente')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSucursalDto,
  ): Promise<SucursalResponseDto> {
    return this.sucursalService.update(id, updateDto);
  }

  /**
   * Endpoint DELETE /branches/:id
   */
  @Delete(':id')
  @Roles('Administrador', 'Dueño')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    const deleted = await this.sucursalService.delete(id);
    return { success: deleted };
  }
}
