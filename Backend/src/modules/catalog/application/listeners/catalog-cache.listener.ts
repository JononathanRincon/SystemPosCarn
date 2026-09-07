import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisCacheService } from '../../../../common/cache/redis-cache.service';
import { CatalogoModificadoEvent } from '../../domain/events/catalogo-modificado.event';

@Injectable()
export class CatalogCacheListener {
  private readonly logger = new Logger(CatalogCacheListener.name);

  constructor(private readonly cacheService: RedisCacheService) {}

  /**
   * design.md Sec. 1.3 y 9.1:
   * Invalida proactivamente y reactivamente la caché de Redis ante cualquier mutación del catálogo.
   */
  @OnEvent(CatalogoModificadoEvent.EVENT_NAME, { async: true })
  async handleCatalogoModificado(event: CatalogoModificadoEvent): Promise<void> {
    this.logger.log(
      `[Cache Invalidation] Catálogo modificado (${event.tipo}: ${event.entidadId}, tenant: ${event.tenantId}). Invalidando caché.`,
    );

    if (event.sucursalId) {
      const key = RedisCacheService.getCatalogSucursalKey(event.sucursalId);
      await this.cacheService.del(key);
      this.logger.log(`[Cache Invalidation] Clave específica eliminada: ${key}`);
    } else {
      await this.cacheService.delPattern('catalog:sucursal:*');
      this.logger.log(`[Cache Invalidation] Patrón 'catalog:sucursal:*' invalidado proactivamente.`);
    }
  }
}
