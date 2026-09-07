import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from '../../application/services/tenant-context.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    let tenantId: string | null =
      request.tenantId ||
      request.user?.negocioId ||
      request.headers?.['x-tenant-id'] ||
      null;

    if (!tenantId) {
      throw new BadRequestException(
        'Tenant ID no encontrado en la petición. Envíe la cabecera X-Tenant-ID o autentíquese con credenciales de negocio',
      );
    }

    request.tenantId = tenantId;
    this.tenantContextService.setTenantId(tenantId);

    return next.handle();
  }
}
