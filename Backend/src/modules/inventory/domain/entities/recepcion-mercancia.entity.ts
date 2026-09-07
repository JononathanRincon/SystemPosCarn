export interface ItemRecepcionInput {
  productoId: string;
  codigoLote: string;
  cantidadRecibida: number;
  costoUnitario: number;
  fechaVencimiento?: Date | null;
  temperaturaRecepcion?: number | null;
  notas?: string | null;
}

export interface RecepcionMercanciaProps {
  id: string;
  sucursalId: string;
  proveedor: string;
  usuarioId: string;
  numeroFacturaRemision?: string | null;
  temperaturaVehiculo?: number | null;
  fechaRecepcion?: Date;
  observaciones?: string | null;
  sincronizado?: boolean;
  items?: ItemRecepcionInput[];
}

export interface RecepcionMercanciaResponseDto {
  id: string;
  sucursalId: string;
  proveedor: string;
  usuarioId: string;
  numeroFacturaRemision: string | null;
  temperaturaVehiculo: number | null;
  fechaRecepcion: Date;
  observaciones: string | null;
  alertaTemperaturaVehiculo: boolean;
  itemsCount: number;
}

export class RecepcionMercancia {
  private readonly _id: string;
  private readonly _sucursalId: string;
  private readonly _proveedor: string;
  private readonly _usuarioId: string;
  private readonly _numeroFacturaRemision: string | null;
  private readonly _temperaturaVehiculo: number | null;
  private readonly _fechaRecepcion: Date;
  private readonly _observaciones: string | null;
  private _sincronizado: boolean;
  private _items: ItemRecepcionInput[];

  constructor(props: RecepcionMercanciaProps) {
    if (!props.id) throw new Error('El ID de recepción es obligatorio');
    if (!props.sucursalId) throw new Error('El sucursalId es obligatorio');
    if (!props.usuarioId) throw new Error('El usuarioId es obligatorio');
    if (!props.proveedor || props.proveedor.trim().length === 0) {
      throw new Error('El proveedor es obligatorio');
    }

    this._id = props.id;
    this._sucursalId = props.sucursalId;
    this._proveedor = props.proveedor.trim();
    this._usuarioId = props.usuarioId;
    this._numeroFacturaRemision = props.numeroFacturaRemision?.trim() || null;
    this._temperaturaVehiculo =
      props.temperaturaVehiculo !== undefined && props.temperaturaVehiculo !== null
        ? Number(Number(props.temperaturaVehiculo).toFixed(1))
        : null;
    this._fechaRecepcion = props.fechaRecepcion || new Date();
    this._observaciones = props.observaciones?.trim() || null;
    this._sincronizado = props.sincronizado !== undefined ? props.sincronizado : true;
    this._items = props.items || [];
  }

  get id(): string { return this._id; }
  get sucursalId(): string { return this._sucursalId; }
  get proveedor(): string { return this._proveedor; }
  get usuarioId(): string { return this._usuarioId; }
  get numeroFacturaRemision(): string | null { return this._numeroFacturaRemision; }
  get temperaturaVehiculo(): number | null { return this._temperaturaVehiculo; }
  get fechaRecepcion(): Date { return this._fechaRecepcion; }
  get observaciones(): string | null { return this._observaciones; }
  get sincronizado(): boolean { return this._sincronizado; }
  get items(): ItemRecepcionInput[] { return [...this._items]; }

  public tieneAlertaCadenaFrio(): boolean {
    return this._temperaturaVehiculo !== null && this._temperaturaVehiculo > 4.0;
  }

  public agregarItem(item: ItemRecepcionInput): void {
    if (!item.productoId) throw new Error('El productoId del item es obligatorio');
    if (!item.codigoLote) throw new Error('El código de lote del item es obligatorio');
    if (item.cantidadRecibida <= 0) throw new Error('La cantidad recibida debe ser mayor a cero');
    if (item.costoUnitario < 0) throw new Error('El costo unitario no puede ser negativo');
    this._items.push({
      ...item,
      cantidadRecibida: Number(item.cantidadRecibida.toFixed(3)),
      costoUnitario: Number(item.costoUnitario.toFixed(2)),
      temperaturaRecepcion:
        item.temperaturaRecepcion !== undefined && item.temperaturaRecepcion !== null
          ? Number(Number(item.temperaturaRecepcion).toFixed(1))
          : null,
    });
  }

  public toResponseDto(): RecepcionMercanciaResponseDto {
    return {
      id: this._id,
      sucursalId: this._sucursalId,
      proveedor: this._proveedor,
      usuarioId: this._usuarioId,
      numeroFacturaRemision: this._numeroFacturaRemision,
      temperaturaVehiculo: this._temperaturaVehiculo,
      fechaRecepcion: this._fechaRecepcion,
      observaciones: this._observaciones,
      alertaTemperaturaVehiculo: this.tieneAlertaCadenaFrio(),
      itemsCount: this._items.length,
    };
  }
}
