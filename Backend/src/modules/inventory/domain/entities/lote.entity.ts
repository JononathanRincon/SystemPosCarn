export type EstadoLote = 'activo' | 'agotado' | 'vencido' | 'retirado';

export interface LoteProps {
  id: string;
  productoId: string;
  sucursalId: string;
  recepcionId?: string | null;
  codigoLote: string;
  proveedor: string;
  cantidadRecibida: number;
  cantidadDisponible: number;
  costoUnitario: number;
  fechaRecepcion?: Date;
  fechaVencimiento?: Date | null;
  temperaturaRecepcion?: number | null;
  estado?: EstadoLote;
  notas?: string | null;
  sincronizado?: boolean;
}

export interface LoteResponseDto {
  id: string;
  productoId: string;
  sucursalId: string;
  recepcionId: string | null;
  codigoLote: string;
  proveedor: string;
  cantidadRecibida: number;
  cantidadDisponible: number;
  costoUnitario: number;
  fechaRecepcion: Date;
  fechaVencimiento: Date | null;
  temperaturaRecepcion: number | null;
  estado: EstadoLote;
  notas: string | null;
  alertaCadenaFrio: boolean;
  proximoAVencer: boolean;
}

export class Lote {
  private readonly _id: string;
  private readonly _productoId: string;
  private readonly _sucursalId: string;
  private _recepcionId: string | null;
  private readonly _codigoLote: string;
  private readonly _proveedor: string;
  private readonly _cantidadRecibida: number;
  private _cantidadDisponible: number;
  private readonly _costoUnitario: number;
  private readonly _fechaRecepcion: Date;
  private readonly _fechaVencimiento: Date | null;
  private readonly _temperaturaRecepcion: number | null;
  private _estado: EstadoLote;
  private _notas: string | null;
  private _sincronizado: boolean;

  constructor(props: LoteProps) {
    if (!props.id) throw new Error('El ID de lote es obligatorio');
    if (!props.productoId) throw new Error('El productoId es obligatorio');
    if (!props.sucursalId) throw new Error('El sucursalId es obligatorio');
    if (!props.codigoLote || props.codigoLote.trim().length === 0) {
      throw new Error('El código de lote es obligatorio');
    }
    if (!props.proveedor || props.proveedor.trim().length === 0) {
      throw new Error('El proveedor es obligatorio');
    }
    if (props.cantidadRecibida === undefined || props.cantidadRecibida <= 0) {
      throw new Error('La cantidad recibida debe ser mayor a cero');
    }
    if (props.cantidadDisponible === undefined || props.cantidadDisponible < 0) {
      throw new Error('La cantidad disponible no puede ser negativa');
    }
    if (props.costoUnitario === undefined || props.costoUnitario < 0) {
      throw new Error('El costo unitario no puede ser negativo');
    }

    this._id = props.id;
    this._productoId = props.productoId;
    this._sucursalId = props.sucursalId;
    this._recepcionId = props.recepcionId || null;
    this._codigoLote = props.codigoLote.trim();
    this._proveedor = props.proveedor.trim();
    this._cantidadRecibida = Number(props.cantidadRecibida.toFixed(3));
    this._cantidadDisponible = Number(props.cantidadDisponible.toFixed(3));
    this._costoUnitario = Number(props.costoUnitario.toFixed(2));
    this._fechaRecepcion = props.fechaRecepcion || new Date();
    this._fechaVencimiento = props.fechaVencimiento ? new Date(props.fechaVencimiento) : null;
    this._temperaturaRecepcion =
      props.temperaturaRecepcion !== undefined && props.temperaturaRecepcion !== null
        ? Number(Number(props.temperaturaRecepcion).toFixed(1))
        : null;
    this._estado = props.estado || (this._cantidadDisponible === 0 ? 'agotado' : 'activo');
    this._notas = props.notas?.trim() || null;
    this._sincronizado = props.sincronizado !== undefined ? props.sincronizado : true;
  }

  get id(): string { return this._id; }
  get productoId(): string { return this._productoId; }
  get sucursalId(): string { return this._sucursalId; }
  get recepcionId(): string | null { return this._recepcionId; }
  get codigoLote(): string { return this._codigoLote; }
  get proveedor(): string { return this._proveedor; }
  get cantidadRecibida(): number { return this._cantidadRecibida; }
  get cantidadDisponible(): number { return this._cantidadDisponible; }
  get costoUnitario(): number { return this._costoUnitario; }
  get fechaRecepcion(): Date { return this._fechaRecepcion; }
  get fechaVencimiento(): Date | null { return this._fechaVencimiento; }
  get temperaturaRecepcion(): number | null { return this._temperaturaRecepcion; }
  get estado(): EstadoLote { return this._estado; }
  get notas(): string | null { return this._notas; }
  get sincronizado(): boolean { return this._sincronizado; }

  /**
   * EARS-LOTE-05: Advertencia si la temperatura excede 4.0°C en refrigerados.
   */
  public tieneRupturaCadenaFrio(): boolean {
    return this._temperaturaRecepcion !== null && this._temperaturaRecepcion > 4.0;
  }

  /**
   * EARS-LOTE-03: Alerta si el lote vence dentro de los próximos N días (por defecto 3).
   */
  public esProximoAVencer(diasLimite: number = 3, fechaReferencia: Date = new Date()): boolean {
    if (!this._fechaVencimiento || this._estado === 'agotado') return false;
    const diffMs = this._fechaVencimiento.getTime() - fechaReferencia.getTime();
    const diffDias = diffMs / (1000 * 60 * 60 * 24);
    return diffDias >= 0 && diffDias <= diasLimite;
  }

  /**
   * Verifica si el lote ha caducado. Si es así, muta el estado a 'vencido'.
   */
  public verificarVencimiento(fechaReferencia: Date = new Date()): boolean {
    if (!this._fechaVencimiento) return false;
    if (this._fechaVencimiento.getTime() < fechaReferencia.getTime()) {
      if (this._estado === 'activo') {
        this._estado = 'vencido';
      }
      return true;
    }
    return false;
  }

  /**
   * EARS-LOTE-02 y EARS-LOTE-04:
   * Descuenta stock del lote. Retorna la cantidad efectivamente descontada.
   * Si la cantidad disponible llega a 0.000, el estado muta automáticamente a 'agotado'.
   */
  public descontar(cantidad: number): number {
    if (cantidad <= 0) {
      throw new Error('La cantidad a descontar debe ser mayor a cero');
    }
    if (this._estado !== 'activo') {
      throw new Error(`No se puede descontar del lote ${this._codigoLote} porque su estado es '${this._estado}'`);
    }

    const cantidadADescontar = Math.min(this._cantidadDisponible, Number(cantidad.toFixed(3)));
    this._cantidadDisponible = Number((this._cantidadDisponible - cantidadADescontar).toFixed(3));

    // EARS-LOTE-04: Si la cantidad disponible llega a 0.000, muta automáticamente a 'agotado'
    if (this._cantidadDisponible <= 0.00001) {
      this._cantidadDisponible = 0.000;
      this._estado = 'agotado';
    }

    return cantidadADescontar;
  }

  public estaAgotado(): boolean {
    return this._estado === 'agotado';
  }

  public toResponseDto(): LoteResponseDto {
    return {
      id: this._id,
      productoId: this._productoId,
      sucursalId: this._sucursalId,
      recepcionId: this._recepcionId,
      codigoLote: this._codigoLote,
      proveedor: this._proveedor,
      cantidadRecibida: this._cantidadRecibida,
      cantidadDisponible: this._cantidadDisponible,
      costoUnitario: this._costoUnitario,
      fechaRecepcion: this._fechaRecepcion,
      fechaVencimiento: this._fechaVencimiento,
      temperaturaRecepcion: this._temperaturaRecepcion,
      estado: this._estado,
      notas: this._notas,
      alertaCadenaFrio: this.tieneRupturaCadenaFrio(),
      proximoAVencer: this.esProximoAVencer(),
    };
  }
}
