import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { MovimientoCaja } from '../../domain/entities/movimiento-caja.entity';
import {
  IMovimientoCajaRepository,
  MOVIMIENTO_CAJA_REPOSITORY,
} from '../../domain/ports/movimiento-caja-repository.port';
import {
  ICorteCajaRepository,
  CORTE_CAJA_REPOSITORY,
} from '../../domain/ports/corte-caja-repository.port';
import {
  CorteCajaService,
  ISalesCashQueryProvider,
  SALES_CASH_QUERY_PROVIDER,
} from './corte-caja.service';
import {
  RegistrarMovimientoCajaDto,
  MovimientoCajaResponseDto,
  ResumenMovimientosTurnoDto,
} from '../dtos/movimiento-caja.dto';

@Injectable()
export class MovimientoCajaService {
  private movimientosEnMemoria: Map<string, MovimientoCaja> = new Map();

  constructor(
    private readonly corteCajaService: CorteCajaService,
    @Optional()
    @Inject(MOVIMIENTO_CAJA_REPOSITORY)
    private readonly movimientoRepo?: IMovimientoCajaRepository,
    @Optional()
    @Inject(CORTE_CAJA_REPOSITORY)
    private readonly corteCajaRepo?: ICorteCajaRepository,
    @Optional()
    @Inject(SALES_CASH_QUERY_PROVIDER)
    private readonly salesQueryProvider?: ISalesCashQueryProvider,
  ) {}

  /**
   * EARS-CAJA-05, EARS-CAJA-06, EARS-CAJA-07, Caso Límite 7:
   * Registra un ingreso o egreso de caja.
   * Valida que el turno esté abierto y que, en caso de egreso,
   * el saldo disponible en efectivo sea suficiente (monto <= saldoDisponible).
   */
  async registrarMovimiento(dto: RegistrarMovimientoCajaDto): Promise<MovimientoCajaResponseDto> {
    if (dto.monto === undefined || dto.monto === null || Number(dto.monto) <= 0) {
      throw new BadRequestException('El monto del movimiento debe ser un número mayor a 0.');
    }

    if (!dto.descripcion || dto.descripcion.trim() === '') {
      throw new BadRequestException('La justificación o descripción del movimiento es obligatoria.');
    }

    const corte = await this.corteCajaService.buscarPorId(dto.corteId);
    if (!corte) {
      throw new NotFoundException(`No se encontró el turno de caja con ID: ${dto.corteId}`);
    }

    if (corte.estaCerrada()) {
      throw new BadRequestException('No se pueden registrar movimientos en un turno de caja cerrado.');
    }

    // Obtener ventas en efectivo acumuladas durante el turno
    let ventasEfectivo = 0;
    const dispositivoId = dto.dispositivoId || corte.dispositivoId;
    if (this.salesQueryProvider && dispositivoId) {
      ventasEfectivo = await this.salesQueryProvider.obtenerTotalVentasEfectivo(
        dispositivoId,
        corte.fechaApertura,
      );
    }

    // Validación estricta de saldo para egresos (EARS-CAJA-07, Caso Límite 7)
    if (dto.tipo === 'egreso') {
      const saldoDisponible = corte.calcularSaldoDisponible(ventasEfectivo);
      if (dto.monto > saldoDisponible) {
        throw new BadRequestException(
          `Saldo insuficiente en efectivo en la caja. Saldo disponible: $${saldoDisponible}, monto solicitado: $${dto.monto}`,
        );
      }
    }

    const nuevoMovimiento = new MovimientoCaja({
      id: crypto.randomUUID(),
      corteId: dto.corteId,
      sucursalId: dto.sucursalId,
      dispositivoId: dispositivoId ?? null,
      usuarioId: dto.usuarioId,
      autorizadoPorId: dto.autorizadoPorId ?? null,
      tipo: dto.tipo,
      categoria: dto.categoria,
      monto: Number(dto.monto),
      beneficiarioProveedor: dto.beneficiarioProveedor ?? null,
      comprobante: dto.comprobante ?? null,
      descripcion: dto.descripcion,
      fechaHoraDispositivo: dto.fechaHoraDispositivo ? new Date(dto.fechaHoraDispositivo) : new Date(),
      fechaHoraServidor: new Date(),
      sincronizado: true,
    });

    // Actualizar acumuladores del turno de caja
    corte.registrarMovimiento(dto.tipo, dto.monto);
    corte.actualizarEfectivoEsperado(ventasEfectivo);
    await this.corteCajaService.guardarCorte(corte);

    // Persistir movimiento
    if (this.movimientoRepo) {
      await this.movimientoRepo.crear(nuevoMovimiento);
    } else {
      this.movimientosEnMemoria.set(nuevoMovimiento.id, nuevoMovimiento);
    }

    return this.mapToResponse(nuevoMovimiento);
  }

  /**
   * GET /cash-shifts/current/movements
   * Lista los movimientos y el resumen del turno activo actual por dispositivo.
   */
  async obtenerMovimientosTurnoActual(dispositivoId: string): Promise<ResumenMovimientosTurnoDto> {
    if (!dispositivoId) {
      throw new BadRequestException('El dispositivoId es requerido para consultar los movimientos del turno actual.');
    }

    const corte = await this.corteCajaService.buscarTurnoAbiertoPorDispositivo(dispositivoId);
    if (!corte || !corte.estaAbierta()) {
      throw new NotFoundException('No existe un turno de caja abierto para este dispositivo.');
    }

    let movimientos: MovimientoCaja[] = [];
    if (this.movimientoRepo) {
      movimientos = await this.movimientoRepo.buscarPorCorteId(corte.id);
    } else {
      movimientos = Array.from(this.movimientosEnMemoria.values()).filter((m) => m.corteId === corte.id);
    }

    let ventasEfectivo = 0;
    if (this.salesQueryProvider && corte.dispositivoId) {
      ventasEfectivo = await this.salesQueryProvider.obtenerTotalVentasEfectivo(
        corte.dispositivoId,
        corte.fechaApertura,
      );
    }

    return {
      corteId: corte.id,
      montoApertura: corte.montoApertura,
      ventasEfectivo: Math.round(ventasEfectivo * 100) / 100,
      totalIngresosExtra: corte.totalIngresosExtra,
      totalEgresos: corte.totalEgresos,
      saldoDisponible: corte.calcularSaldoDisponible(ventasEfectivo),
      efectivoEsperado: corte.calcularEfectivoEsperado(ventasEfectivo),
      movimientos: movimientos.map((m) => this.mapToResponse(m)),
    };
  }

  /**
   * GET /cash-shifts/:id/movements
   * Retorna los movimientos de un turno específico (activo o histórico cerrado).
   */
  async obtenerMovimientosPorCorteId(corteId: string): Promise<MovimientoCajaResponseDto[]> {
    if (!corteId) {
      throw new BadRequestException('El corteId es requerido.');
    }

    let movimientos: MovimientoCaja[] = [];
    if (this.movimientoRepo) {
      movimientos = await this.movimientoRepo.buscarPorCorteId(corteId);
    } else {
      movimientos = Array.from(this.movimientosEnMemoria.values()).filter((m) => m.corteId === corteId);
    }

    return movimientos.map((m) => this.mapToResponse(m));
  }

  private mapToResponse(movimiento: MovimientoCaja): MovimientoCajaResponseDto {
    return {
      id: movimiento.id,
      corteId: movimiento.corteId,
      sucursalId: movimiento.sucursalId,
      dispositivoId: movimiento.dispositivoId,
      usuarioId: movimiento.usuarioId,
      autorizadoPorId: movimiento.autorizadoPorId,
      tipo: movimiento.tipo,
      categoria: movimiento.categoria,
      monto: movimiento.monto,
      beneficiarioProveedor: movimiento.beneficiarioProveedor,
      comprobante: movimiento.comprobante,
      descripcion: movimiento.descripcion,
      fechaHoraDispositivo: movimiento.fechaHoraDispositivo,
      fechaHoraServidor: movimiento.fechaHoraServidor,
      sincronizado: movimiento.sincronizado,
    };
  }
}