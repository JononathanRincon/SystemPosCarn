import { Injectable, Inject, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { Inventario } from '../../../inventory/domain/entities/inventario.entity';
import { MovimientoInventario } from '../../../inventory/domain/entities/movimiento-inventario.entity';
import {
  IInventarioRepository,
  INVENTARIO_REPOSITORY,
} from '../../../inventory/domain/ports/inventario-repository.port';
import {
  IMovimientoRepository,
  MOVIMIENTO_REPOSITORY,
} from '../../../inventory/domain/ports/movimiento-repository.port';
import {
  AlertaStockNegativoDto,
  AlertaStockNegativoEvent,
} from '../dtos/alerta-stock-negativo.dto';
import {
  IDomainEventEmitter,
  DOMAIN_EVENT_EMITTER,
} from '../../../sales/application/services/venta.service';

export interface DeltaVentaOfflineItem {
  productoId: string;
  cantidad: number; // Cantidad vendida (positiva)
  precioUnitario?: number;
  loteId?: string | null;
}

export interface ResolverDeltasVentaOfflineInput {
  ventaId: string;
  sucursalId: string;
  dispositivoId: string;
  cajeroId: string;
  fechaHoraDispositivo: Date;
  items: DeltaVentaOfflineItem[];
}

export interface ResultadoResolucionConcurrente {
  ventaId: string;
  deltasAplicados: {
    productoId: string;
    delta: number;
    stockAnterior: number;
    stockNuevo: number;
    alertaStockNegativo?: AlertaStockNegativoDto;
  }[];
  alertasGeneradas: AlertaStockNegativoDto[];
}

@Injectable()
export class ConflictoService {
  private inventariosEnMemoria: Map<string, number> = new Map();
  private alertasEnMemoria: AlertaStockNegativoDto[] = [];

  constructor(
    @Optional()
    @Inject(INVENTARIO_REPOSITORY)
    private readonly inventarioRepo?: IInventarioRepository,
    @Optional()
    @Inject(MOVIMIENTO_REPOSITORY)
    private readonly movimientoRepo?: IMovimientoRepository,
    @Optional()
    @Inject(DOMAIN_EVENT_EMITTER)
    private readonly eventEmitter?: IDomainEventEmitter,
  ) {}

  /**
   * EARS-SYNC-05, PA-02, Caso Límite 3:
   * Aplica deltas cronológicos de ventas offline concurrentes sobre el inventario.
   * Si el stock consolidado resultante queda negativo:
   *   1. NO se bloquea ni se anula la venta ya efectuada físicamente.
   *   2. Se persiste el delta negativo en MovimientoInventario para trazabilidad y auditoría.
   *   3. Se actualiza el inventario con el valor resultante en sobregiro.
   *   4. Se emite una alerta prioritaria de stock negativo para el panel de gerencia/dueño.
   */
  async aplicarDeltasVentaOffline(
    input: ResolverDeltasVentaOfflineInput,
  ): Promise<ResultadoResolucionConcurrente> {
    const deltasAplicados: ResultadoResolucionConcurrente['deltasAplicados'] = [];
    const alertasGeneradas: AlertaStockNegativoDto[] = [];
    const movimientosParaCrear: MovimientoInventario[] = [];

    for (const item of input.items) {
      const cantidadVendida = Number(item.cantidad.toFixed(3));
      const delta = -cantidadVendida;
      const key = `${input.sucursalId}:${item.productoId}`;

      let stockAnterior = 0.0;
      let stockNuevo = 0.0;
      let inventarioEntidad: Inventario | null = null;

      if (this.inventarioRepo) {
        inventarioEntidad = await this.inventarioRepo.buscarPorProductoYSucursal(
          item.productoId,
          input.sucursalId,
        );

        if (!inventarioEntidad) {
          inventarioEntidad = new Inventario({
            id: crypto.randomUUID(),
            sucursalId: input.sucursalId,
            productoId: item.productoId,
            cantidadActual: 0.0,
            cantidadMinimaAlerta: 5.0,
          });
          stockAnterior = 0.0;
          inventarioEntidad.aplicarDelta(delta);
          stockNuevo = inventarioEntidad.cantidadActual;
          await this.inventarioRepo.crear(inventarioEntidad);
        } else {
          stockAnterior = inventarioEntidad.cantidadActual;
          inventarioEntidad.aplicarDelta(delta);
          stockNuevo = inventarioEntidad.cantidadActual;
          await this.inventarioRepo.actualizar(inventarioEntidad);
        }
      } else {
        stockAnterior = this.inventariosEnMemoria.get(key) ?? 0.0;
        stockNuevo = Number((stockAnterior + delta).toFixed(3));
        this.inventariosEnMemoria.set(key, stockNuevo);
      }

      // EARS-INV-01: Auditoría mediante MovimientoInventario con delta negativo
      const movimiento = new MovimientoInventario({
        id: crypto.randomUUID(),
        sucursalId: input.sucursalId,
        productoId: item.productoId,
        tipo: 'venta',
        cantidadDelta: delta,
        cantidadAnterior: stockAnterior,
        cantidadNueva: stockNuevo,
        usuarioId: input.cajeroId,
        loteId: item.loteId || null,
        referenciaId: input.ventaId,
        motivo: `Venta offline sincronizada - Delta concurrente (${input.dispositivoId})`,
        creadoEn: input.fechaHoraDispositivo,
      });
      movimientosParaCrear.push(movimiento);

      let alerta: AlertaStockNegativoDto | undefined;

      // EARS-SYNC-05: Si el stock consolidado queda en negativo, emitir alerta sin anular la venta
      if (stockNuevo < 0) {
        alerta = {
          productoId: item.productoId,
          sucursalId: input.sucursalId,
          stockResultante: stockNuevo,
          deltaAplicado: delta,
          referenciaVentaId: input.ventaId,
          dispositivoId: input.dispositivoId,
          fechaDeteccion: new Date(),
          severidad: stockNuevo < -10.0 ? 'critica' : 'alta',
          mensaje: `Alerta de sobregiro concurrente: El producto ${item.productoId} en la sucursal ${input.sucursalId} alcanzó un stock negativo de ${stockNuevo.toFixed(3)} tras sincronizar la venta ${input.ventaId} desde el dispositivo ${input.dispositivoId}.`,
        };

        alertasGeneradas.push(alerta);
        this.alertasEnMemoria.push(alerta);

        // Desacoplamiento por eventos de dominio (DDD)
        if (this.eventEmitter) {
          this.eventEmitter.emit(
            AlertaStockNegativoEvent.EVENT_NAME,
            new AlertaStockNegativoEvent(alerta),
          );
        }
      }

      deltasAplicados.push({
        productoId: item.productoId,
        delta,
        stockAnterior,
        stockNuevo,
        alertaStockNegativo: alerta,
      });
    }

    if (this.movimientoRepo && movimientosParaCrear.length > 0) {
      await this.movimientoRepo.crearMuchos(movimientosParaCrear);
    }

    return {
      ventaId: input.ventaId,
      deltasAplicados,
      alertasGeneradas,
    };
  }

  /**
   * Consulta alertas de stock negativo generadas en el sistema
   */
  public consultarAlertasStockNegativo(sucursalId?: string): AlertaStockNegativoDto[] {
    if (!sucursalId) {
      return [...this.alertasEnMemoria];
    }
    return this.alertasEnMemoria.filter((a) => a.sucursalId === sucursalId);
  }

  /**
   * Helper para inicializar o consultar stock en memoria en pruebas
   */
  public fijarStockEnMemoria(sucursalId: string, productoId: string, stock: number): void {
    this.inventariosEnMemoria.set(`${sucursalId}:${productoId}`, Number(stock.toFixed(3)));
  }

  public obtenerStockEnMemoria(sucursalId: string, productoId: string): number {
    return this.inventariosEnMemoria.get(`${sucursalId}:${productoId}`) ?? 0.0;
  }
}
