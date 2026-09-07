import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CashModule } from '../cash/cash.module';
import { VentaService } from './application/services/venta.service';
import { SalesController } from './presentation/http/sales.controller';

@Module({
  imports: [AuthModule, CashModule],
  controllers: [SalesController],
  providers: [VentaService],
  exports: [VentaService],
})
export class SalesModule {}
