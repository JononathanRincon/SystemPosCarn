import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { VentaCompletadaEvent } from '../../../sales/domain/events/venta-completada.event';
import { VentaAnuladaEvent } from '../../../sales/domain/events/venta-anulada.event';
import { RecepcionCreadaEvent } from '../../domain/events/recepcion-creada.event';
import { FefoDispatchService } from '../services/fefo-dispatch.service';
import { ILoteRepository, LOTE_REPOSITORY } from '../../domain/ports/lote-repository.port';
import { IInventarioRepository, INVENTARIO_REPOSITORY } from '../../domain/ports/inventario-repository.port';
import { IMovimientoRepository, MOVIMIENTO_REPOSITORY } from '../../domain/ports/movimiento-repository.port';
import { MovimientoInventario } from '../../domain/entities/movimiento-inventario.entity';
import { CadenaFrioAlertService } from '../services/cadena-frio-alert.service';

@Injectable()
export class InventoryEventListener {
  private readonly logger = new Logger(InventoryEventListener.name);

  constructor(
    @Optional()
    private readonly fefoDispatchService?: FefoDispatchService,
    @Optional()
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepo?: ILoteRepository,
    @Optional()
    @Inject(INVENTARIO_REPOSITORY)
    private readonly inventarioRepo?: IInventarioRepository,
    @Optional()
    @Inject(MOVIMIENTO_REPOSITORY)
    private readonly movimientoRepo?: IMovimientoRepository,
    @Optional()
    private readonly cadenaFrioAlertService?: CadenaFrioAlertService,
  ) {}

  /**
   * EARS-INV-02, EARS-LOTE-02:
   * Cuando se completa una venta, descuenta existencias mediante estrategia FEFO
   * y genera deltas negativos en auditoría sin acoplamiento directo a SalesModule.
   */
  @OnEvent(VentaCompletadaEvent.EVENT_NAME, { async: true })
  async handleVentaCompletada(event: VentaCompletadaEvent): Promise<void> {
    this.logger.log(`[DDD Event] Venta completada ${event.ventaId} recibida en InventoryEventListener`);

    if (this.fefoDispatchService && event.detalles && event.detalles.length > 0) {
      for (const item of event.detalles) {
        try {
          await this.fefoDispatchService.despacharFefo({
            productoId: item.productoId,
            sucursalId: event.sucursalId,
            cantidad: item.cantidad,
            ventaId: event.ventaId,
            permitirStockNegativo: true,
          });
        } catch (error: any) {
          this.logger.error(
            `Error en despacho FEFO para producto ${item.productoId} en venta ${event.ventaId}: ${error?.message}`,
          );
        }
      }
    }
  }

  /**
   * design.md Sec. 8:
   * Cuando se anula una venta, genera deltas positivos de reversión y reabre lotes agotados.
   */
  @OnEvent(VentaAnuladaEvent.EVENT_NAME, { async: true })
  async handleVentaAnulada(event: VentaAnuladaEvent): Promise<void> {
    this.logger.log(`[DDD Event] Venta anulada ${event.ventaId} recibida en InventoryEventListener`);

    if (!event.detalles || event.detalles.length === 0) {
      return;
    }

    for (const item of event.detalles) {
      try {
        // 1. Reversión en inventario general (+ delta)
        if (this.inventarioRepo) {
          const inv = await this.inventarioRepo.buscarPorProductoYSucursal(
            item.productoId,
            event.sucursalId,
          );
          if (inv) {
            const anterior = inv.cantidadActual;
            inv.incrementar(item.cantidad);
            await this.inventarioRepo.actualizar(inv);

            // 2. Registrar movimiento de reversión (+ delta)
            if (this.movimientoRepo) {
              await this.movimientoRepo.crear(
                new MovimientoInventario({
                  id: crypto.randomUUID(),
                  sucursalId: event.sucursalId,
                  productoId: item.productoId,
                  tipo: 'devolucion',
                  cantidadDelta: item.cantidad,
                  cantidadAnterior: anterior,
                  cantidadNueva: inv.cantidadActual,
                  usuarioId: event.usuarioId,
                  referenciaId: event.ventaId,
                  motivo: `Reversión por anulación de venta: ${event.motivo}`,
                }),
              );
            }
          }
        }

        // 3. Reabrir lotes agotados si procede
        if (this.loteRepo) {
          const lotes = await this.loteRepo.buscarPorSucursal(
            event.sucursalId,
            item.productoId,
          );
          const loteAgotado = lotes.find((l) => l.estado === 'agotado');
          if (loteAgotado) {
            loteAgotado.reponer(item.cantidad);
            await this.loteRepo.actualizar(loteAgotado);
          }
        }
      } catch (error: any) {
        this.logger.error(
          `Error al revertir inventario para producto ${item.productoId} en venta anulada ${event.ventaId}: ${error?.message}`,
        );
      }
    }
  }

  /**
   * EARS-LOTE-05, design.md Sec. 8:
   * Cuando se crea una recepción de mercancía, verifica temperatura y genera
   * alertas en caso de ruptura de cadena de frío (> 4°C).
   */
  @OnEvent(RecepcionCreadaEvent.EVENT_NAME, { async: true })
  async handleRecepcionCreada(event: RecepcionCreadaEvent): Promise<void> {
    this.logger.log(`[DDD Event] Recepción ${event.recepcionId} recibida en InventoryEventListener`);

    if (event.alertaCadenaFrio) {
      const itemsCriticos = (event.items || []).filter(
        (i) => i.temperaturaRecepcion !== undefined && i.temperaturaRecepcion !== null && i.temperaturaRecepcion > 4.0,
      );

      const mensaje = `Alerta de ruptura de cadena de frío en recepción ${event.recepcionId} (Proveedor: ${event.proveedor}). Vehículo: ${event.temperaturaVehiculo ?? 'N/A'}°C. Items con temperatura > 4°C: ${itemsCriticos.length}`;
      this.logger.warn(mensaje);

      if (this.cadenaFrioAlertService) {
        this.cadenaFrioAlertService.registrarAlerta({
          recepcionId: event.recepcionId,
          sucursalId: event.sucursalId,
          proveedor: event.proveedor,
          temperaturaVehiculo: event.temperaturaVehiculo,
          itemsCriticos: itemsCriticos.map((i) => ({
            productoId: i.productoId,
            codigoLote: i.codigoLote,
            temperatura: i.temperaturaRecepcion!,
          })),
          mensaje,
          timestamp: event.timestamp,
        });
      }
    }
  }
}
