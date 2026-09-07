export type TipoMovimiento = 'venta' | 'merma' | 'recepcion' | 'ajuste_manual' | 'devolucion';

export interface MovimientoInventarioProps {
  id: string;
  sucursalId: string;
  productoId: string;
  tipo: TipoMovimiento;
  cantidadDelta: number;
  cantidadAnterior: number;
  cantidadNueva: number;
  usuarioId: string;
  loteId?: string | null;
  referenciaId?: string | null;
  motivo?: string | null;
  creadoEn?: Date;
}

export class MovimientoInventario {
  private readonly _id: string;
  private readonly _sucursalId: string;
  private readonly _productoId: string;
  private readonly _tipo: TipoMovimiento;
  private readonly _cantidadDelta: number;
  private readonly _cantidadAnterior: number;
  private readonly _cantidadNueva: number;
  private readonly _usuarioId: string;
  private readonly _loteId: string | null;
  private readonly _referenciaId: string | null;
  private readonly _motivo: string | null;
  private readonly _creadoEn: Date;

  constructor(props: MovimientoInventarioProps) {
    if (!props.id) throw new Error('El ID de movimiento es obligatorio');
    if (!props.sucursalId) throw new Error('El sucursalId es obligatorio');
    if (!props.productoId) throw new Error('El productoId es obligatorio');
    if (!props.usuarioId) throw new Error('El usuarioId es obligatorio');
    if (!props.tipo) throw new Error('El tipo de movimiento es obligatorio');

    const tiposValidos: TipoMovimiento[] = ['venta', 'merma', 'recepcion', 'ajuste_manual', 'devolucion'];
    if (!tiposValidos.includes(props.tipo)) {
      throw new Error(`Tipo de movimiento inválido: ${props.tipo}. Debe ser uno de: ${tiposValidos.join(', ')}`);
    }

    if (props.cantidadDelta === 0) {
      throw new Error('La cantidad delta no puede ser cero');
    }

    this._id = props.id;
    this._sucursalId = props.sucursalId;
    this._productoId = props.productoId;
    this._tipo = props.tipo;
    this._cantidadDelta = Number(props.cantidadDelta.toFixed(3));
    this._cantidadAnterior = Number(props.cantidadAnterior.toFixed(3));
    this._cantidadNueva = Number(props.cantidadNueva.toFixed(3));
    this._usuarioId = props.usuarioId;
    this._loteId = props.loteId || null;
    this._referenciaId = props.referenciaId || null;
    this._motivo = props.motivo?.trim() || null;
    this._creadoEn = props.creadoEn || new Date();
  }

  get id(): string { return this._id; }
  get sucursalId(): string { return this._sucursalId; }
  get productoId(): string { return this._productoId; }
  get tipo(): TipoMovimiento { return this._tipo; }
  get cantidadDelta(): number { return this._cantidadDelta; }
  get cantidadAnterior(): number { return this._cantidadAnterior; }
  get cantidadNueva(): number { return this._cantidadNueva; }
  get usuarioId(): string { return this._usuarioId; }
  get loteId(): string | null { return this._loteId; }
  get referenciaId(): string | null { return this._referenciaId; }
  get motivo(): string | null { return this._motivo; }
  get creadoEn(): Date { return this._creadoEn; }
}
