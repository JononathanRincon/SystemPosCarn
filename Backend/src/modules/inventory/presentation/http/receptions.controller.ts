import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { InventarioService } from '../../application/services/inventario.service';
import { CreateRecepcionDto, RecepcionResponse } from '../../application/dtos/recepcion.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/guards/roles.decorator';

@Controller('receptions')
@UseGuards(AuthGuard, RolesGuard)
export class ReceptionsController {
  constructor(private readonly inventarioService: InventarioService) {}

  /**
   * Endpoint POST /receptions (design.md sec. 7.4 endpoint 9)
   * Registra recepción de mercancía y genera los lotes correspondientes.
   */
  @Post()
  @Roles('Administrador', 'Dueño', 'Encargado')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateRecepcionDto,
    @Req() req: any,
  ): Promise<RecepcionResponse> {
    const usuarioId = req.user?.sub || 'system-user';
    return this.inventarioService.registrarRecepcion(createDto, usuarioId);
  }
}
