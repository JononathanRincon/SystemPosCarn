import { Injectable, Inject, Optional, BadRequestException, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Merma, MotivoMerma, MOTIVOS_MERMA_VALIDOS } from '../../domain/entities/merma.entity';
import { MovimientoInventario } from '../../domain/entities/movimiento-inventario.entity';
import {
  IMermaRepository,
  MERMA_REPOSITORY,
} from '../../domain/ports/merma-repository.port';
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
import { CreateMermaDto, MermaResultDto } from '../dtos/merma.dto';

@Injectable()
export class MermaService {
  constructor(
    @Optional()
    @Inject(MERMA_REPOSITORY)
    private readonly mermaRepo?: IMermaRepository,
    @Optional()
    @Inject(LOTE_REPOSITORY)
    private readonly loteRepo?: ILoteRepository,
    @Optional()
    @Inject(INVENTARIO_REPOSITORY)
    private readonly inventarioRepo?: IInventarioRepository,
    @Optional()
    @Inject(MOVIMIENTO_REPOSITORY)
    private readonly movimientoRepo?: IMovimientoRepository,
  ) {}

  /**
   * EARS-INV-04, US-07:
   * Registra una merma operativa exigiendo motivo obligatorio,
   * descuenta del lote asociado (si aplica) mutándolo a 'agotado' si llega a cero,
   * reduce el stock de la sucursal y genera un movimiento de auditoría con delta negativo.
   */
  async registrarMerma(dto: CreateMermaDto, usuarioId: string): Promise<MermaResultDto> {
    if (!dto.motivo || !MOTIVOS_MERMA_VALIDOS.includes(dto.motivo)) {
      throw new BadRequestException(
        `El motivo de merma es obligatorio y debe ser uno de: ${MOTIVOS_MERMA_VALIDOS.join(', ')}`,
      );
    }

    if (!dto.cantidad || dto.cantidad <= 0) {
      throw new BadRequestException('La cantidad de merma debe ser estrictamente mayor a cero');
    }

    const cantidadMerma = Number(dto.cantidad.toFixed(3));
    let descuentoLoteAplicado = false;

    // 1. Si está vinculada a un lote, validar y descontar del lote
    if (dto.lote_id && this.loteRepo) {
      const lote = await this.loteRepo.buscarPorId(dto.lote_id);
      if (!lote) {
        throw new NotFoundException(`El lote ${dto.lote_id} no fue encontrado`);
      }

      if (lote.sucursalId !== dto.sucursal_id) {
        throw new BadRequestException('El lote no pertenece a la sucursal indicada');
      }

      if (lote.productoId !== dto.producto_id) {
        throw new BadRequestException('El lote no corresponde al producto indicado');
      }

      lote.descontar(cantidadMerma);
      await this.loteRepo.actualizar(lote);
      descuentoLoteAplicado = true;
    }

    // 2. Descontar del inventario de la sucursal
    let nuevoStockSucursal = 0.0;
    let stockAnterior = 0.0;

    if (this.inventarioRepo) {
      const inventario = await this.inventarioRepo.buscarPorProductoYSucursal(
        dto.producto_id,
        dto.sucursal_id,
      );

      if (inventario) {
        stockAnterior = inventario.cantidadActual;
        inventario.decrementar(cantidadMerma);
        nuevoStockSucursal = inventario.cantidadActual;
        await this.inventarioRepo.actualizar(inventario);
      }
    }

    const mermaId = crypto.randomUUID();

    // 3. Crear entidad de dominio Merma
    const merma = new Merma({
      id: mermaId,
      productoId: dto.producto_id,
      sucursalId: dto.sucursal_id,
      usuarioId,
      dispositivoId: dto.dispositivo_id,
      cantidad: cantidadMerma,
      motivo: dto.motivo,
      loteId: dto.lote_id,
      fotoEvidenciaUrl: dto.foto_evidencia_url,
      fechaHoraDispositivo: new Date(),
      notas: dto.notas,
    });

    if (this.mermaRepo) {
      await this.mermaRepo.crear(merma);
    }

    // 4. EARS-INV-01 / EARS-INV-04: Registrar movimiento de auditoría con delta negativo (-)
    if (this.movimientoRepo) {
      const movimiento = new MovimientoInventario({
        id: crypto.randomUUID(),
        sucursalId: dto.sucursal_id,
        productoId: dto.producto_id,
        tipo: 'merma',
        cantidadDelta: -cantidadMerma,
        cantidadAnterior: stockAnterior,
        cantidadNueva: nuevoStockSucursal,
        usuarioId,
        loteId: dto.lote_id || null,
        referenciaId: mermaId,
        motivo: `Merma registrada (${dto.motivo})${dto.notas ? ': ' + dto.notas : ''}`,
      });
      await this.movimientoRepo.crear(movimiento);
    }

    return {
      id: mermaId,
      producto_id: dto.producto_id,
      sucursal_id: dto.sucursal_id,
      lote_id: dto.lote_id || null,
      cantidad: cantidadMerma,
      motivo: dto.motivo,
      descuento_lote_aplicado: descuentoLoteAplicado,
      nuevo_stock_sucursal: nuevoStockSucursal,
      mensaje: 'Merma registrada exitosamente',
    };
  }

  async consultarMermasPorSucursal(sucursalId: string): Promise<Merma[]> {
    if (!this.mermaRepo) return [];
    return this.mermaRepo.buscarPorSucursal(sucursalId);
  }
}
