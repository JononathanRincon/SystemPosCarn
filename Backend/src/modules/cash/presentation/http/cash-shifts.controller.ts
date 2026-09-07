import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { CorteCajaService } from '../../application/services/corte-caja.service';
import { OpenCashShiftDto, CurrentCashShiftQueryDto, CashShiftResponseDto } from '../../application/dtos/cash-shift.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';

@Controller('cash-shifts')
@UseGuards(AuthGuard, RolesGuard)
export class CashShiftsController {
  constructor(private readonly corteCajaService: CorteCajaService) {}

  @Post('open')
  async openShift(@Body() dto: OpenCashShiftDto): Promise<CashShiftResponseDto> {
    return this.corteCajaService.abrirTurno(dto);
  }

  @Get('current')
  async getCurrentShift(@Query() query: CurrentCashShiftQueryDto): Promise<CashShiftResponseDto> {
    return this.corteCajaService.obtenerTurnoActual(query.dispositivoId);
  }
}
