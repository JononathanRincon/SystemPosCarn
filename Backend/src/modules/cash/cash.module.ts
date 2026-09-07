import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CorteCajaService } from './application/services/corte-caja.service';
import { MovimientoCajaService } from './application/services/movimiento-caja.service';
import { CashShiftsController } from './presentation/http/cash-shifts.controller';
import { CashCutsController } from './presentation/http/cash-cuts.controller';

@Module({
  imports: [AuthModule],
  controllers: [CashShiftsController, CashCutsController],
  providers: [CorteCajaService, MovimientoCajaService],
  exports: [CorteCajaService, MovimientoCajaService],
})
export class CashModule {}
