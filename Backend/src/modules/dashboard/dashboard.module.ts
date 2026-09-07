import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CashModule } from '../cash/cash.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DashboardService } from './application/services/dashboard.service';
import { DashboardController } from './presentation/http/dashboard.controller';

@Module({
  imports: [
    AuthModule,
    SalesModule,
    InventoryModule,
    CashModule,
    CatalogModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
