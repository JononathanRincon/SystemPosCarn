import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
} from '@nestjs/common';
import { SyncSalesBatchDto, SyncResponseDto, SyncSaleItemDto } from '../dtos/sync.dto';
import { VentaService } from '../../../sales/application/services/venta.service';
import { IVentaRepository, VENTA_REPOSITORY } from '../../../sales/domain/ports/venta-repository.port';

@Injectable()
export class SyncService {
  constructor(
    private readonly ventaService: VentaService,
    @Optional()
    @Inject(VENTA_REPOSITORY)
    private readonly ventaRepo?: IVentaRepository,
  ) {}

  /**
   * EARS-SYNC-01, EARS-SYNC-04, US-05, design.md sec 7.3:
   * Ingesta por lotes offline con garantía estricta de idempotencia por UUID de venta.
   */
  async sincronizarLoteVentas(batch: SyncSalesBatchDto): Promise<SyncResponseDto> {
    if (!batch || !batch.dispositivoId) {
      throw new BadRequestException('El dispositivoId es obligatorio para la sincronización.');
    }

    if (!batch.ventas || !Array.isArray(batch.ventas)) {
      throw new BadRequestException('El lote de sincronización debe contener un arreglo de ventas.');
    }

    let procesadas = 0;
    let duplicadasIgnoradas = 0;
    const errores: string[] = [];

    for (const ventaItem of batch.ventas) {
      try {
        // 1. Comprobación estricta de idempotencia por UUID del cliente
        const yaExiste = await this.verificarVentaExistente(ventaItem.id);
        if (yaExiste) {
          duplicadasIgnoradas++;
          continue;
        }

        // 2. Procesamiento de venta offline asegurando que se marque sincronizada en servidor
        const ventaParaProcesar = {
          ...ventaItem,
          dispositivoId: batch.dispositivoId,
          esOffline: true,
          sincronizada: false, // Proveniente de terminal offline
        };

        await this.ventaService.crearVenta(ventaParaProcesar);
        procesadas++;
      } catch (error: any) {
        errores.push(`Venta ${ventaItem.id}: ${error?.message || 'Error desconocido al sincronizar'}`);
      }
    }

    return {
      procesadas,
      duplicadasIgnoradas,
      errores,
    };
  }

  /**
   * Verifica si una venta ya fue persistida previamente en base de datos o memoria
   */
  public async verificarVentaExistente(ventaId: string): Promise<boolean> {
    if (this.ventaRepo) {
      const venta = await this.ventaRepo.buscarPorId(ventaId);
      return venta !== null;
    }

    const venta = await this.ventaService.buscarVentaPorId(ventaId);
    return venta !== null;
  }
}
