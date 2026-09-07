import { Injectable, NestMiddleware } from '@nestjs/common';
import { TenantContextService } from '../../application/services/tenant-context.service';

export interface TenantRequest {
  headers?: Record<string, string | string[] | undefined> | any;
  user?: { negocioId?: string; [key: string]: any };
  tenantId?: string;
  [key: string]: any;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContextService: TenantContextService) {}

  use(req: TenantRequest, res: any, next: (err?: any) => void): void {
    let tenantId: string | null = null;

    // 1. Extraer del usuario autenticado (JWT payload: TokenPayload.negocioId)
    if (req.user && req.user.negocioId) {
      tenantId = req.user.negocioId;
    }

    // 2. Extraer de la cabecera HTTP X-Tenant-ID
    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId && typeof headerTenantId === 'string' && headerTenantId.trim().length > 0) {
      tenantId = headerTenantId.trim();
    }

    // 3. Inyectar en el objeto de request para compatibilidad
    if (tenantId) {
      req.tenantId = tenantId;
      // Inyectar en el contexto de ejecución asíncrono
      this.tenantContextService.runWithTenant(tenantId, () => {
        next();
      });
    } else {
      next();
    }
  }
}
