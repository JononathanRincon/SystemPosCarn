import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InventarioService } from '../../application/services/inventario.service';
import { AlertaStockDto } from '../../application/dtos/inventario.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';

@Controller('inventory')
@UseGuards(AuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventarioService: InventarioService) {}

  /**
   * Endpoint GET /inventory/alerts (design.md sec. 7.4 endpoint 11)
   * Consulta productos con stock bajo o crítico por sucursal.
   */
  @Get('alerts')
  async getAlerts(@Query('sucursal_id') sucursalId: string): Promise<AlertaStockDto[]> {
    return this.inventarioService.consultarAlertasStock(sucursalId);
  }
}
