import { Injectable, Inject, Optional, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Lote, EstadoLote } from '../../domain/entities/lote.entity';
import { RecepcionMercancia } from '../../domain/entities/recepcion-mercancia.entity';
import { Inventario } from '../../domain/entities/inventario.entity';
import { MovimientoInventario } from '../../domain/entities/movimiento-inventario.entity';
import {
  ILoteRepository,
  LOTE_REPOSITORY,
} from '../../domain/ports/lote-repository.port';
import {
  IRecepcionRepository,
  RECEPCION_REPOSITORY,
} from '../../domain/ports/recepcion-repository.port';
import {
  IInventarioRepository,
  INVENTARIO_REPOSITORY,
} from '../../domain/ports/inventario-repository.port';
import {
  IMovimientoRepository,
  MOVIMIENTO_REPOSITORY,
} from '../../domain/ports/movimiento-repository.port';
import { CreateRecepcionDto, RecepcionResponse } from '../dtos/recepcion.dto';
import { QueryLotesDto, LoteDetalleDto } from '../dtos/lote.dto';
import { AlertaStockDto } from '../dtos/inventario.dto';

@Injectable()
export class InventarioService {
  constructor(
    @Optional()
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepo?: ILoteRepository,
    @Optional()
    @Inject(RECEPCION_REPOSITORY)
    private readonly recepcionRepo?: IRecepcionRepository,
    @Optional()
    @Inject(INVENTARIO_REPOSITORY)
    private readonly inventarioRepo?: IInventarioRepository,
    @Optional()
    @Inject(MOVIMIENTO_REPOSITORY)
    private readonly movimientoRepo?: IMovimientoRepository,
  ) {}

  /**
   * EARS-LOTE-01, EARS-LOTE-05, EARS-INV-01:
   * Registra una recepción de mercancía y genera los lotes correspondientes,
   * actualizando el inventario por sucursal y registrando movimientos de auditoría.
   */
  async registrarRecepcion(
    dto: CreateRecepcionDto,
    usuarioId: string,
  ): Promise<RecepcionResponse> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La recepción debe contener al menos un producto');
    }

    const recepcionId = crypto.randomUUID();
    const hayAlertaVehiculo =
      dto.temperatura_vehiculo !== undefined &&
      dto.temperatura_vehiculo !== null &&
      dto.temperatura_vehiculo > 4.0;

    let hayAlertaItems = false;
    const lotesParaCrear: Lote[] = [];
    const movimientosParaCrear: MovimientoInventario[] = [];

    const recepcion = new RecepcionMercancia({
      id: recepcionId,
      sucursalId: dto.sucursal_id,
      proveedor: dto.proveedor,
      usuarioId,
      numeroFacturaRemision: dto.numero_factura_remision,
      temperaturaVehiculo: dto.temperatura_vehiculo,
      observaciones: dto.observaciones,
      items: dto.items.map((i) => ({
        productoId: i.producto_id,
        codigoLote: i.codigo_lote,
        cantidadRecibida: i.cantidad,
        costoUnitario: i.costo_unitario,
        fechaVencimiento: i.fecha_vencimiento ? new Date(i.fecha_vencimiento) : null,
        temperaturaRecepcion: i.temperatura_recepcion,
        notas: i.notas,
      })),
    });

    if (this.recepcionRepo) {
      await this.recepcionRepo.crear(recepcion);
    }

    for (const item of dto.items) {
      const loteId = crypto.randomUUID();
      const lote = new Lote({
        id: loteId,
        productoId: item.producto_id,
        sucursalId: dto.sucursal_id,
        recepcionId,
        codigoLote: item.codigo_lote,
        proveedor: dto.proveedor,
        cantidadRecibida: item.cantidad,
        cantidadDisponible: item.cantidad,
        costoUnitario: item.costo_unitario,
        fechaVencimiento: item.fecha_vencimiento ? new Date(item.fecha_vencimiento) : null,
        temperaturaRecepcion: item.temperatura_recepcion,
        notas: item.notas,
      });

      if (lote.tieneRupturaCadenaFrio()) {
        hayAlertaItems = true;
      }
      lotesParaCrear.push(lote);

      // Actualizar o crear Inventario individualizado por sucursal
      let cantidadAnterior = 0.0;
      let cantidadNueva = item.cantidad;

      if (this.inventarioRepo) {
        let inventario = await this.inventarioRepo.buscarPorProductoYSucursal(
          item.producto_id,
          dto.sucursal_id,
        );

        if (!inventario) {
          inventario = new Inventario({
            id: crypto.randomUUID(),
            sucursalId: dto.sucursal_id,
            productoId: item.producto_id,
            cantidadActual: item.cantidad,
            cantidadMinimaAlerta: 5.0,
          });
          cantidadAnterior = 0.0;
          cantidadNueva = item.cantidad;
          await this.inventarioRepo.crear(inventario);
        } else {
          cantidadAnterior = inventario.cantidadActual;
          inventario.incrementar(item.cantidad);
          cantidadNueva = inventario.cantidadActual;
          await this.inventarioRepo.actualizar(inventario);
        }
      }

      // EARS-INV-01: Auditoría con delta incremental (+)
      const movimiento = new MovimientoInventario({
        id: crypto.randomUUID(),
        sucursalId: dto.sucursal_id,
        productoId: item.producto_id,
        tipo: 'recepcion',
        cantidadDelta: item.cantidad,
        cantidadAnterior,
        cantidadNueva,
        usuarioId,
        loteId,
        referenciaId: recepcionId,
        motivo: `Recepción de mercancía - Lote ${item.codigo_lote}`,
      });
      movimientosParaCrear.push(movimiento);
    }

    if (this.loteRepo) {
      await this.loteRepo.crearMuchos(lotesParaCrear);
    }

    if (this.movimientoRepo) {
      await this.movimientoRepo.crearMuchos(movimientosParaCrear);
    }

    const alertaCadenaFrio = hayAlertaVehiculo || hayAlertaItems;

    return {
      recepcion_id: recepcionId,
      alerta_cadena_frio: alertaCadenaFrio,
      lotes_creados: lotesParaCrear.length,
      mensaje: alertaCadenaFrio
        ? 'Recepción registrada con advertencia: se detectó temperatura superior a 4.0°C (ruptura de cadena de frío)'
        : 'Recepción registrada exitosamente',
    };
  }

  /**
   * Consulta lotes filtrados por sucursal, producto y estado.
   */
  async consultarLotes(query: QueryLotesDto): Promise<LoteDetalleDto[]> {
    if (!this.loteRepo) {
      return [];
    }

    const lotes = await this.loteRepo.buscarPorSucursal(
      query.sucursal_id,
      query.producto_id,
      query.estado,
    );

    const ahora = new Date();
    return lotes.map((l) => {
      let diasParaVencer: number | null = null;
      if (l.fechaVencimiento) {
        const diffMs = l.fechaVencimiento.getTime() - ahora.getTime();
        diasParaVencer = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }

      return {
        id: l.id,
        producto_id: l.productoId,
        sucursal_id: l.sucursalId,
        recepcion_id: l.recepcionId,
        codigo_lote: l.codigoLote,
        proveedor: l.proveedor,
        cantidad_recibida: l.cantidadRecibida,
        cantidad_disponible: l.cantidadDisponible,
        costo_unitario: l.costoUnitario,
        fecha_recepcion: l.fechaRecepcion.toISOString(),
        fecha_vencimiento: l.fechaVencimiento ? l.fechaVencimiento.toISOString() : null,
        dias_para_vencer: diasParaVencer,
        temperatura_recepcion: l.temperaturaRecepcion,
        estado: l.estado,
        alerta_cadena_frio: l.tieneRupturaCadenaFrio(),
        proximo_a_vencer: l.esProximoAVencer(3, ahora),
      };
    });
  }

  /**
   * EARS-INV-02: Consulta alertas de stock bajo o crítico por sucursal.
   */
  async consultarAlertasStock(sucursalId: string): Promise<AlertaStockDto[]> {
    if (!this.inventarioRepo) {
      return [];
    }

    const itemsBajoStock = await this.inventarioRepo.buscarBajoStock(sucursalId);

    return itemsBajoStock.map((inv) => ({
      producto_id: inv.productoId,
      sucursal_id: inv.sucursalId,
      stock_actual: inv.cantidadActual,
      stock_minimo: inv.cantidadMinimaAlerta,
      estado_alerta: inv.cantidadActual <= 0 ? 'critico' : 'bajo',
    }));
  }

  /**
   * EARS-LOTE-03: Lotes próximos a vencer dentro de los próximos N días.
   */
  async consultarLotesPorVencer(sucursalId: string, diasLimite: number = 3): Promise<Lote[]> {
    if (!this.loteRepo) {
      return [];
    }
    return this.loteRepo.buscarProximosAVencer(sucursalId, diasLimite);
  }

  /**
   * Consulta stock actual de un producto en una sucursal.
   */
  async consultarStock(productoId: string, sucursalId: string): Promise<number> {
    if (!this.inventarioRepo) {
      return 0.0;
    }
    const inv = await this.inventarioRepo.buscarPorProductoYSucursal(productoId, sucursalId);
    return inv ? inv.cantidadActual : 0.0;
  }
}
