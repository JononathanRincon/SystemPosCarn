import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CashModule } from '../cash/cash.module';
import { EventsModule } from '../../common/events/events.module';
import { VentaService } from './application/services/venta.service';
import { SalesController } from './presentation/http/sales.controller';

@Module({
  imports: [AuthModule, CashModule, EventsModule],
  controllers: [SalesController],
  providers: [VentaService],
  exports: [VentaService, EventsModule],
})
export class SalesModule {}

