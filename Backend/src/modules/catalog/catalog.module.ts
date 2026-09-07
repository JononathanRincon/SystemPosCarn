import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NegocioService } from './application/services/negocio.service';
import { SucursalService } from './application/services/sucursal.service';
import { TenantContextService } from './application/services/tenant-context.service';
import { TenantMiddleware } from './presentation/middleware/tenant.middleware';
import { TenantInterceptor } from './presentation/interceptors/tenant.interceptor';
import { CategoriaService } from './application/services/categoria.service';
import { ProductoService } from './application/services/producto.service';
import { CategoriesController } from './presentation/http/categories.controller';
import { ProductsController } from './presentation/http/products.controller';

@Module({
  imports: [AuthModule],
  controllers: [BranchesController, CategoriesController, ProductsController],
  providers: [
    NegocioService,
    SucursalService,
    CategoriaService,
    ProductoService,
    TenantContextService,
    TenantMiddleware,
    TenantInterceptor,
  ],
  exports: [
    NegocioService,
    SucursalService,
    CategoriaService,
    ProductoService,
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
