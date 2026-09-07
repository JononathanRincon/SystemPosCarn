export type EstadoTurnoCaja = 'abierta' | 'cerrada';

export interface TotalesPorMetodoPago {
  efectivo?: number;
  tarjeta?: number;
  transferencia?: number;
  fiado?: number;
  [key: string]: number | undefined;
}

export interface CorteCajaProps {
  id: string;
  sucursalId: string;
  dispositivoId?: string | null;
  usuarioId: string;
  estado?: EstadoTurnoCaja;
  fechaApertura: Date;
  fechaCierre?: Date | null;
  montoApertura: number;
  totalIngresosExtra?: number;
  totalEgresos?: number;
  totalEfectivoEsperado?: number;
  totalEfectivoContado?: number;
  diferencia?: number;
  totalesPorMetodoPago?: TotalesPorMetodoPago;
  observaciones?: string | null;
}

export class CorteCaja {
  public readonly id: string;
  public readonly sucursalId: string;
  public readonly dispositivoId: string | null;
  public readonly usuarioId: string;
  private _estado: EstadoTurnoCaja;
  public readonly fechaApertura: Date;
  private _fechaCierre: Date | null;
  public readonly montoApertura: number;
  private _totalIngresosExtra: number;
  private _totalEgresos: number;
  private _totalEfectivoEsperado: number;
  private _totalEfectivoContado: number;
  private _diferencia: number;
  private _totalesPorMetodoPago: TotalesPorMetodoPago;
  private _observaciones: string | null;

  constructor(props: CorteCajaProps) {
    this.id = props.id;
    this.sucursalId = props.sucursalId;
    this.dispositivoId = props.dispositivoId ?? null;
    this.usuarioId = props.usuarioId;
    this._estado = props.estado ?? 'abierta';
    this.fechaApertura = props.fechaApertura;
    this._fechaCierre = props.fechaCierre ?? null;
    this.montoApertura = Number(props.montoApertura) || 0;
    this._totalIngresosExtra = Number(props.totalIngresosExtra) || 0;
    this._totalEgresos = Number(props.totalEgresos) || 0;
    this._totalEfectivoEsperado =
      Number(props.totalEfectivoEsperado) ||
      (this.montoApertura + this._totalIngresosExtra - this._totalEgresos);
    this._totalEfectivoContado = Number(props.totalEfectivoContado) || 0;
    this._diferencia = Number(props.diferencia) || 0;
    this._totalesPorMetodoPago = props.totalesPorMetodoPago ?? {};
    this._observaciones = props.observaciones ?? null;
  }

  get estado(): EstadoTurnoCaja {
    return this._estado;
  }

  get fechaCierre(): Date | null {
    return this._fechaCierre;
  }

  get totalIngresosExtra(): number {
    return this._totalIngresosExtra;
  }

  get totalEgresos(): number {
    return this._totalEgresos;
  }

  get totalEfectivoEsperado(): number {
    return this._totalEfectivoEsperado;
  }

  get totalEfectivoContado(): number {
    return this._totalEfectivoContado;
  }

  get diferencia(): number {
    return this._diferencia;
  }

  get totalesPorMetodoPago(): TotalesPorMetodoPago {
    return { ...this._totalesPorMetodoPago };
  }

  get observaciones(): string | null {
    return this._observaciones;
  }

  public estaAbierta(): boolean {
    return this._estado === 'abierta';
  }

  public estaCerrada(): boolean {
    return this._estado === 'cerrada';
  }

  /**
   * Calcula el saldo de efectivo actualmente disponible en caja física:
   * saldoDisponible = montoApertura + ventasEfectivo + totalIngresosExtra - totalEgresos
   */
  public calcularSaldoDisponible(ventasEfectivo: number = 0): number {
    return (
      Math.round(
        (this.montoApertura +
          Number(ventasEfectivo) +
          this._totalIngresosExtra -
          this._totalEgresos) *
          100,
      ) / 100
    );
  }

  /**
   * En cualquier momento, el efectivo esperado coincide con el saldo teórico de caja:
   * efectivoEsperado = montoApertura + ventasEfectivo + totalIngresosExtra - totalEgresos
   */
  public calcularEfectivoEsperado(ventasEfectivo: number = 0): number {
    return this.calcularSaldoDisponible(ventasEfectivo);
  }

  /**
   * Registra un movimiento extraordinario de caja (ingreso o egreso) en los acumuladores del turno.
   */
  public registrarMovimiento(tipo: 'ingreso' | 'egreso', monto: number): void {
    if (this._estado === 'cerrada') {
      throw new Error('No se pueden registrar movimientos en un turno de caja cerrado.');
    }
    const val = Math.round(Number(monto) * 100) / 100;
    if (tipo === 'ingreso') {
      this._totalIngresosExtra = Math.round((this._totalIngresosExtra + val) * 100) / 100;
    } else if (tipo === 'egreso') {
      this._totalEgresos = Math.round((this._totalEgresos + val) * 100) / 100;
    }
  }

  /**
   * EARS-CAJA-02:
   * Calcula la diferencia aritmetica inmutable: contado - esperado
   * y sella el turno como cerrado.
   */
  public cerrarTurno(
    totalEfectivoContado: number,
    totalEfectivoEsperado: number,
    totalesPorMetodoPago: TotalesPorMetodoPago = {},
    observaciones?: string | null,
    fechaCierre: Date = new Date(),
  ): void {
    if (this._estado === 'cerrada') {
      throw new Error('El turno de caja ya se encuentra cerrado e inmutable.');
    }

    this._estado = 'cerrada';
    this._fechaCierre = fechaCierre;
    this._totalEfectivoContado = Math.round(Number(totalEfectivoContado) * 100) / 100;
    this._totalEfectivoEsperado = Math.round(Number(totalEfectivoEsperado) * 100) / 100;
    this._diferencia = Math.round((this._totalEfectivoContado - this._totalEfectivoEsperado) * 100) / 100;
    this._totalesPorMetodoPago = { ...totalesPorMetodoPago };
    this._observaciones = observaciones ?? null;
  }

  public actualizarEfectivoEsperado(ventasEfectivoAcumuladas: number): void {
    if (this._estado === 'abierta') {
      this._totalEfectivoEsperado = this.calcularEfectivoEsperado(ventasEfectivoAcumuladas);
    }
  }

  public toJSON() {
    return {
      id: this.id,
      sucursalId: this.sucursalId,
      dispositivoId: this.dispositivoId,
      usuarioId: this.usuarioId,
      estado: this.estado,
      fechaApertura: this.fechaApertura,
      fechaCierre: this.fechaCierre,
      montoApertura: this.montoApertura,
      totalIngresosExtra: this.totalIngresosExtra,
      totalEgresos: this.totalEgresos,
      totalEfectivoEsperado: this.totalEfectivoEsperado,
      totalEfectivoContado: this.totalEfectivoContado,
      diferencia: this.diferencia,
      totalesPorMetodoPago: this.totalesPorMetodoPago,
      observaciones: this.observaciones,
    };
  }
}
