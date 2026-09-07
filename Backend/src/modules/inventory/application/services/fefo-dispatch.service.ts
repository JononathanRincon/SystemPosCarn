import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Lote } from '../../domain/entities/lote.entity';
import { MovimientoInventario } from '../../domain/entities/movimiento-inventario.entity';
import {
  ILoteRepository,
  LOTE_REPOSITORY,
} from '../../domain/ports/lote-repository.port';
import {
  IInventarioRepository,
  INVENTARIO_REPOSITORY,
} from '../../domain/ports/inventario-repository.port';
import {
  IMovimientoRepository,
  MOVIMIENTO_REPOSITORY,
} from '../../domain/ports/movimiento-repository.port';

export interface DespachoFefoInput {
  productoId: string;
  sucursalId: string;
  cantidad: number;
  permitirStockNegativo?: boolean;
  ventaId?: string;
  usuarioId?: string;
}

export interface AsignacionLoteItem {
  loteId: string;
  codigoLote: string;
  cantidadDescontada: number;
  costoUnitario: number;
  fechaVencimiento: Date | null;
  loteAgotado: boolean;
}

export interface DespachoFefoResult {
  productoId: string;
  cantidadTotalDespachada: number;
  cantidadPendienteSinLote: number;
  asignaciones: AsignacionLoteItem[];
  costoTotalDespacho: number;
  completamenteCubierto: boolean;
}

@Injectable()
export class FefoDispatchService {
  constructor(
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepo: ILoteRepository,
    @Inject(INVENTARIO_REPOSITORY)
    private readonly inventarioRepo: IInventarioRepository,
    @Inject(MOVIMIENTO_REPOSITORY)
    private readonly movimientoRepo: IMovimientoRepository,
  ) {}

  /**
   * EARS-LOTE-02, EARS-LOTE-04, US-18:
   * Despacha existencias automáticamente desde el lote activo con fecha de vencimiento más próxima (FEFO).
   * Si la cantidad supera la disponible en el primer lote, divide entre lotes sucesivos (multi-lote).
   * Cuando un lote llega a 0.000, su estado muta automáticamente a 'agotado'.
   */
  async despacharFefo(input: DespachoFefoInput): Promise<DespachoFefoResult> {
    if (!input.productoId) throw new BadRequestException('El productoId es obligatorio');
    if (!input.sucursalId) throw new BadRequestException('El sucursalId es obligatorio');
    if (!input.cantidad || input.cantidad <= 0) {
      throw new BadRequestException('La cantidad a despachar debe ser mayor a cero');
    }

    const cantidadSolicitada = Number(input.cantidad.toFixed(3));
    let restantePorDespachar = cantidadSolicitada;
    let costoTotal = 0;

    // 1. Obtener lotes activos ordenados por FEFO (vencimiento ASC)
    const lotesActivos = await this.loteRepo.buscarLotesActivosPorProductoFEFO(
      input.productoId,
      input.sucursalId,
    );

    const ahora = new Date();
    const asignaciones: AsignacionLoteItem[] = [];
    const lotesModificados: Lote[] = [];
    const movimientosACrear: MovimientoInventario[] = [];

    for (const lote of lotesActivos) {
      if (restantePorDespachar <= 0.00001) {
        break;
      }

      // Descartar lotes vencidos en fecha
      if (lote.verificarVencimiento(ahora)) {
        lotesModificados.push(lote);
        continue;
      }

      if (lote.estado !== 'activo' || lote.cantidadDisponible <= 0.00001) {
        continue;
      }

      // Descontar del lote
      const cantidadDescontada = lote.descontar(restantePorDespachar);
      restantePorDespachar = Number((restantePorDespachar - cantidadDescontada).toFixed(3));
      costoTotal += Number((cantidadDescontada * lote.costoUnitario).toFixed(2));

      asignaciones.push({
        loteId: lote.id,
        codigoLote: lote.codigoLote,
        cantidadDescontada,
        costoUnitario: lote.costoUnitario,
        fechaVencimiento: lote.fechaVencimiento,
        loteAgotado: lote.estaAgotado(),
      });

      lotesModificados.push(lote);

      // EARS-INV-01: Movimiento de inventario con delta negativo por lote
      movimientosACrear.push(
        new MovimientoInventario({
          id: crypto.randomUUID(),
          sucursalId: input.sucursalId,
          productoId: input.productoId,
          tipo: 'venta',
          cantidadDelta: -cantidadDescontada,
          cantidadAnterior: Number((lote.cantidadDisponible + cantidadDescontada).toFixed(3)),
          cantidadNueva: lote.cantidadDisponible,
          usuarioId: input.usuarioId || 'system-pos',
          loteId: lote.id,
          referenciaId: input.ventaId || null,
          motivo: `Despacho FEFO venta - Lote ${lote.codigoLote}`,
        }),
      );
    }

    const cantidadTotalDespachada = Number((cantidadSolicitada - restantePorDespachar).toFixed(3));
    const cantidadPendienteSinLote = Number(restantePorDespachar.toFixed(3));
    const completamenteCubierto = cantidadPendienteSinLote <= 0.00001;

    // Edge Case EC-LOTE-03: Si no cubre todo y no se permite stock negativo, rechazar venta
    if (!completamenteCubierto && !input.permitirStockNegativo) {
      throw new BadRequestException(
        `Stock insuficiente en lotes activos para despachar ${cantidadSolicitada} del producto ${input.productoId}. Disponible en lotes: ${cantidadTotalDespachada}`,
      );
    }

    // 2. Persistir actualizaciones de lotes
    if (lotesModificados.length > 0) {
      await this.loteRepo.actualizarMuchos(lotesModificados);
    }

    // 3. Actualizar Inventario general de la sucursal
    const inventario = await this.inventarioRepo.buscarPorProductoYSucursal(
      input.productoId,
      input.sucursalId,
    );

    if (inventario) {
      // EARS-SYNC-05, Caso Límite 3: Si se permite stock negativo (offline / concurrencia), decrementar directamente
      try {
        inventario.decrementar(cantidadSolicitada, !!input.permitirStockNegativo);
      } catch (err) {
        if (!input.permitirStockNegativo) {
          throw err;
        }
      }
      await this.inventarioRepo.actualizar(inventario);
    }

    // Si hubo remanente sin lote (en offline o stock negativo permitido), registrar movimiento con lote_id null
    if (cantidadPendienteSinLote > 0 && input.permitirStockNegativo) {
      movimientosACrear.push(
        new MovimientoInventario({
          id: crypto.randomUUID(),
          sucursalId: input.sucursalId,
          productoId: input.productoId,
          tipo: 'venta',
          cantidadDelta: -cantidadPendienteSinLote,
          cantidadAnterior: 0,
          cantidadNueva: -cantidadPendienteSinLote,
          usuarioId: input.usuarioId || 'system-pos',
          loteId: null,
          referenciaId: input.ventaId || null,
          motivo: 'Despacho venta con sobregiro / lote pendiente de asignación',
        }),
      );
    }

    // 4. Persistir movimientos de auditoría
    if (movimientosACrear.length > 0) {
      await this.movimientoRepo.crearMuchos(movimientosACrear);
    }

    return {
      productoId: input.productoId,
      cantidadTotalDespachada,
      cantidadPendienteSinLote,
      asignaciones,
      costoTotalDespacho: Number(costoTotal.toFixed(2)),
      completamenteCubierto,
    };
  }
}
