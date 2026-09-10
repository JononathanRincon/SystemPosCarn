import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { CashModule } from './modules/cash/cash.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { SyncModule } from './modules/sync/sync.module';
import { EventsModule } from './common/events/events.module';
import { CacheModule } from './common/cache/cache.module';
import { SecurityModule } from './common/security/security.module';
import { ObservabilityModule } from './common/observability/observability.module';

/**
 * AppModule: Módulo raíz del Backend NestJS del Sistema POS Multi-Sucursal para Carnicerías.
 * Orquesta todos los módulos de dominio y servicios transversales de infraestructura.
 */
@Module({
  imports: [
    // Infraestructura transversal
    EventsModule,
    CacheModule,
    SecurityModule,
    ObservabilityModule,

    // Dominio del negocio
    AuthModule,
    CashModule,
    CatalogModule,
    DashboardModule,
    InventoryModule,
    SalesModule,
    SyncModule,
  ],
})
export class AppModule {}
