import { Controller, Post, Get, Body, Query, Param, UseGuards, Optional } from '@nestjs/common';
import { CorteCajaService } from '../../application/services/corte-caja.service';
import { MovimientoCajaService } from '../../application/services/movimiento-caja.service';
import {
  OpenCashShiftDto,
  CurrentCashShiftQueryDto,
  CashShiftResponseDto,
} from '../../application/dtos/cash-shift.dto';
import {
  RegistrarMovimientoCajaDto,
  MovimientoCajaResponseDto,
  ResumenMovimientosTurnoDto,
} from '../../application/dtos/movimiento-caja.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';

@Controller('cash-shifts')
@UseGuards(AuthGuard, RolesGuard)
export class CashShiftsController {
  private readonly movimientoCajaService: MovimientoCajaService;

  constructor(
    private readonly corteCajaService: CorteCajaService,
    @Optional() movimientoCajaService?: MovimientoCajaService,
  ) {
    this.movimientoCajaService =
      movimientoCajaService ?? new MovimientoCajaService(this.corteCajaService);
  }

  @Post('open')
  async openShift(@Body() dto: OpenCashShiftDto): Promise<CashShiftResponseDto> {
    return this.corteCajaService.abrirTurno(dto);
  }

  @Get('current')
  async getCurrentShift(@Query() query: CurrentCashShiftQueryDto): Promise<CashShiftResponseDto> {
    return this.corteCajaService.obtenerTurnoActual(query.dispositivoId);
  }

  @Post('movements')
  async registerMovement(@Body() dto: RegistrarMovimientoCajaDto): Promise<MovimientoCajaResponseDto> {
    return this.movimientoCajaService.registrarMovimiento(dto);
  }

  @Get('current/movements')
  async getCurrentShiftMovements(
    @Query() query: CurrentCashShiftQueryDto,
  ): Promise<ResumenMovimientosTurnoDto> {
    return this.movimientoCajaService.obtenerMovimientosTurnoActual(query.dispositivoId);
  }

  @Get(':id/movements')
  async getMovementsByShiftId(@Param('id') id: string): Promise<MovimientoCajaResponseDto[]> {
    return this.movimientoCajaService.obtenerMovimientosPorCorteId(id);
  }
}
