import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { CorteCaja } from '../../domain/entities/corte-caja.entity';
import {
  ICorteCajaRepository,
  CORTE_CAJA_REPOSITORY,
} from '../../domain/ports/corte-caja-repository.port';
import {
  OpenCashShiftDto,
  CloseCashShiftDto,
  CashShiftResponseDto,
} from '../dtos/cash-shift.dto';

export interface ISalesCashQueryProvider {
  obtenerTotalVentasEfectivo(dispositivoId: string, desde: Date, hasta?: Date): Promise<number>;
  obtenerTotalesPorMetodo(dispositivoId: string, desde: Date, hasta?: Date): Promise<Record<string, number>>;
}

export const SALES_CASH_QUERY_PROVIDER = Symbol('SALES_CASH_QUERY_PROVIDER');

@Injectable()
export class CorteCajaService {
  private turnosEnMemoria: Map<string, CorteCaja> = new Map();

  constructor(
    @Optional()
    @Inject(CORTE_CAJA_REPOSITORY)
    private readonly corteCajaRepo?: ICorteCajaRepository,
    @Optional()
    @Inject(SALES_CASH_QUERY_PROVIDER)
    private readonly salesQueryProvider?: ISalesCashQueryProvider,
  ) {}

  /**
   * EARS-CAJA-01, EARS-CAJA-03:
   * Apertura de turno con base inicial en efectivo (montoApertura).
   * Impide abrir un nuevo turno si el dispositivo ya tiene una caja abierta.
   */
  async abrirTurno(dto: OpenCashShiftDto): Promise<CashShiftResponseDto> {
    if (dto.montoApertura === undefined || dto.montoApertura === null || dto.montoApertura < 0) {
      throw new BadRequestException('El monto de apertura (base inicial) no puede ser negativo.');
    }

    const turnoExistente = await this.buscarTurnoAbiertoPorDispositivo(dto.dispositivoId);
    if (turnoExistente && turnoExistente.estaAbierta()) {
      throw new BadRequestException(
        'El dispositivo ya cuenta con un turno de caja abierto. Debe cerrarlo antes de iniciar uno nuevo.',
      );
    }

    const nuevoCorte = new CorteCaja({
      id: crypto.randomUUID(),
      sucursalId: dto.sucursalId,
      dispositivoId: dto.dispositivoId,
      usuarioId: dto.usuarioId,
      estado: 'abierta',
      fechaApertura: new Date(),
      montoApertura: Number(dto.montoApertura),
      totalEfectivoEsperado: Number(dto.montoApertura),
      totalEfectivoContado: 0,
      diferencia: 0,
      totalesPorMetodoPago: {},
    });

    if (this.corteCajaRepo) {
      await this.corteCajaRepo.crear(nuevoCorte);
    } else {
      this.turnosEnMemoria.set(nuevoCorte.id, nuevoCorte);
    }

    return this.mapToResponse(nuevoCorte, 0);
  }

  /**
   * GET /cash-shifts/current
   * Consulta el estado del turno actual, base inicial y efectivo esperado.
   */
  async obtenerTurnoActual(dispositivoId: string): Promise<CashShiftResponseDto> {
    if (!dispositivoId) {
      throw new BadRequestException('El dispositivoId es requerido para consultar el turno actual.');
    }

    const turno = await this.buscarTurnoAbiertoPorDispositivo(dispositivoId);
    if (!turno || !turno.estaAbierta()) {
      throw new NotFoundException('No existe un turno de caja abierto para este dispositivo.');
    }

    let ventasEfectivo = 0;
    if (this.salesQueryProvider) {
      ventasEfectivo = await this.salesQueryProvider.obtenerTotalVentasEfectivo(
        dispositivoId,
        turno.fechaApertura,
      );
    }

    turno.actualizarEfectivoEsperado(ventasEfectivo);
    return this.mapToResponse(turno, ventasEfectivo);
  }

  /**
   * EARS-CAJA-02, EARS-CAJA-04, US-06:
   * Cierre de turno inmutable. Recibe totalEfectivoContado y desglose por método de pago.
   * Sella estado = 'cerrada' e impide ventas posteriores en esa caja sin nueva apertura.
   */
  async cerrarTurno(dto: CloseCashShiftDto): Promise<CashShiftResponseDto> {
    if (dto.totalEfectivoContado === undefined || dto.totalEfectivoContado === null || dto.totalEfectivoContado < 0) {
      throw new BadRequestException('El total de efectivo contado no puede ser negativo.');
    }

    let corte: CorteCaja | null = null;
    if (this.corteCajaRepo) {
      corte = await this.corteCajaRepo.buscarPorId(dto.corteId);
    } else {
      corte = this.turnosEnMemoria.get(dto.corteId) || null;
    }

    if (!corte) {
      throw new NotFoundException('El corte de caja especificado no existe.');
    }

    if (corte.estaCerrada()) {
      throw new BadRequestException('El turno de caja ya se encuentra cerrado e inmutable.');
    }

    let ventasEfectivo = 0;
    let totalesMetodo = dto.totalesPorMetodoPago || {};

    if (this.salesQueryProvider && corte.dispositivoId) {
      ventasEfectivo = await this.salesQueryProvider.obtenerTotalVentasEfectivo(
        corte.dispositivoId,
        corte.fechaApertura,
      );
      if (!dto.totalesPorMetodoPago || Object.keys(dto.totalesPorMetodoPago).length === 0) {
        totalesMetodo = await this.salesQueryProvider.obtenerTotalesPorMetodo(
          corte.dispositivoId,
          corte.fechaApertura,
        );
      }
    }

    const efectivoEsperado = Math.round((corte.montoApertura + ventasEfectivo) * 100) / 100;

    corte.cerrarTurno(
      dto.totalEfectivoContado,
      efectivoEsperado,
      totalesMetodo,
      dto.observaciones,
      new Date(),
    );

    if (this.corteCajaRepo) {
      await this.corteCajaRepo.actualizar(corte);
    } else {
      this.turnosEnMemoria.set(corte.id, corte);
    }

    return this.mapToResponse(corte, ventasEfectivo);
  }

  /**
   * EARS-CAJA-03, EARS-CAJA-04:
   * Verifica si la caja de un dispositivo se encuentra en estado abierto para permitir transacciones.
   */
  async verificarCajaAbierta(dispositivoId: string): Promise<boolean> {
    const turno = await this.buscarTurnoAbiertoPorDispositivo(dispositivoId);
    return turno !== null && turno.estaAbierta();
  }

  public async buscarTurnoAbiertoPorDispositivo(dispositivoId: string): Promise<CorteCaja | null> {
    if (this.corteCajaRepo) {
      return this.corteCajaRepo.buscarTurnoAbiertoPorDispositivo(dispositivoId);
    }

    const turnos = Array.from(this.turnosEnMemoria.values());
    const turno = turnos
      .filter((t) => t.dispositivoId === dispositivoId && t.estaAbierta())
      .sort((a, b) => b.fechaApertura.getTime() - a.fechaApertura.getTime())[0];

    return turno || null;
  }

  private mapToResponse(corte: CorteCaja, ventasAcumuladas: number): CashShiftResponseDto {
    return {
      corteId: corte.id,
      sucursalId: corte.sucursalId,
      dispositivoId: corte.dispositivoId,
      usuarioId: corte.usuarioId,
      estado: corte.estado,
      fechaApertura: corte.fechaApertura,
      fechaCierre: corte.fechaCierre,
      montoApertura: corte.montoApertura,
      ventasAcumuladas: Math.round(ventasAcumuladas * 100) / 100,
      efectivoEsperado: corte.totalEfectivoEsperado,
      totalEfectivoContado: corte.totalEfectivoContado,
      diferencia: corte.diferencia,
      totalesPorMetodoPago: corte.totalesPorMetodoPago,
      observaciones: corte.observaciones,
    };
  }
}
