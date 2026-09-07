import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NegocioService } from './application/services/negocio.service';
import { SucursalService } from './application/services/sucursal.service';
import { TenantContextService } from './application/services/tenant-context.service';
import { TenantMiddleware } from './presentation/middleware/tenant.middleware';
import { TenantInterceptor } from './presentation/interceptors/tenant.interceptor';
import { BranchesController } from './presentation/http/branches.controller';

@Module({
  imports: [AuthModule],
  controllers: [BranchesController],
  providers: [
    NegocioService,
    SucursalService,
    TenantContextService,
    TenantMiddleware,
    TenantInterceptor,
  ],
  exports: [
    NegocioService,
    SucursalService,
    TenantContextService,
    TenantMiddleware,
    TenantInterceptor,
  ],
})
export class CatalogModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
