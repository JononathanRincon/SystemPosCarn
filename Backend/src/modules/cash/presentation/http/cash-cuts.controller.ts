import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CorteCajaService } from '../../application/services/corte-caja.service';
import { CloseCashShiftDto, CashShiftResponseDto } from '../../application/dtos/cash-shift.dto';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';

@Controller('cash-cuts')
@UseGuards(AuthGuard, RolesGuard)
export class CashCutsController {
  constructor(private readonly corteCajaService: CorteCajaService) {}

  @Post()
  async closeShift(@Body() dto: CloseCashShiftDto): Promise<CashShiftResponseDto> {
    return this.corteCajaService.cerrarTurno(dto);
  }
}
