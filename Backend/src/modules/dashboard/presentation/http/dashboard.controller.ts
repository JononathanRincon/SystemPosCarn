import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { DashboardService } from '../../application/services/dashboard.service';
import { DashboardOwnerResponseDto } from '../../application/dtos/dashboard-owner.dto';
import { DashboardManagerResponseDto } from '../../application/dtos/dashboard-manager.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/guards/roles.decorator';

@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * EARS-DASH-01, EARS-DASH-02, US-13:
   * GET /dashboard/owner
   * Consulta indicadores financieros y operacionales del negocio.
   */
  @Get('owner')
  @Roles('dueno', 'administrador')
  async getOwnerDashboard(@Req() req: any): Promise<DashboardOwnerResponseDto> {
    const user = req.user;
    const negocioId = user?.negocioId || user?.negocio_id || 'negocio-default';
    return this.dashboardService.getDashboardOwner(negocioId);
  }

  /**
   * EARS-DASH-01, EARS-DASH-02, US-14:
   * GET /dashboard/manager?sucursalId=...
   * Consulta resumen operativo de la sucursal activa.
   */
  @Get('manager')
  @Roles('dueno', 'administrador', 'gerente')
  async getManagerDashboard(
    @Query('sucursalId') sucursalIdQuery?: string,
    @Req() req?: any,
  ): Promise<DashboardManagerResponseDto> {
    const user = req?.user;
    const sucursalId = sucursalIdQuery || user?.sucursalId || user?.sucursal_id;

    if (!sucursalId) {
      throw new BadRequestException('El parámetro sucursalId es obligatorio.');
    }

    return this.dashboardService.getDashboardManager(sucursalId);
  }
}
