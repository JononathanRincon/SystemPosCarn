import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InventarioService } from '../../application/services/inventario.service';
import { QueryLotesDto, LoteDetalleDto } from '../../application/dtos/lote.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';

@Controller('lots')
@UseGuards(AuthGuard, RolesGuard)
export class LotsController {
  constructor(private readonly inventarioService: InventarioService) {}

  /**
   * Endpoint GET /lots (design.md sec. 7.4 endpoint 10)
   * Consulta lotes por sucursal, producto y estado, incluyendo días para vencer y alerta de frío.
   */
  @Get()
  async getLots(@Query() query: QueryLotesDto): Promise<LoteDetalleDto[]> {
    return this.inventarioService.consultarLotes(query);
  }
}
