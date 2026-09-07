import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextStore {
  tenantId: string;
}

@Injectable()
export class TenantContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<TenantContextStore>();
  private fallbackTenantId: string | null = null;

  /**
   * Ejecuta una función dentro de un contexto aislado con el tenantId dado.
   * Garantiza que peticiones concurrentes nunca compartan o sobreescriban el tenant_id.
   */
  async runWithTenant<T>(tenantId: string, fn: () => Promise<T> | T): Promise<T> {
    return this.asyncLocalStorage.run({ tenantId }, async () => {
      return await fn();
    });
  }

  /**
   * Establece un tenantId de respaldo (útil para pruebas unitarias o scripts sin contexto HTTP).
   */
  setTenantId(tenantId: string | null): void {
    this.fallbackTenantId = tenantId;
  }

  /**
   * Retorna el tenantId del contexto actual (AsyncLocalStorage) o el de respaldo si no hay almacenamiento activo.
   */
  getTenantId(): string | null {
    const store = this.asyncLocalStorage.getStore();
    if (store && store.tenantId) {
      return store.tenantId;
    }
    return this.fallbackTenantId;
  }

  /**
   * Retorna el tenantId obligatorio. Si no existe, arroja UnauthorizedException.
   */
  getRequiredTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new UnauthorizedException(
        'Contexto multi-tenant no inicializado: tenant_id es requerido para esta operación',
      );
    }
    return tenantId;
  }

  /**
   * Limpia el tenant de respaldo.
   */
  clear(): void {
    this.fallbackTenantId = null;
  }
}
