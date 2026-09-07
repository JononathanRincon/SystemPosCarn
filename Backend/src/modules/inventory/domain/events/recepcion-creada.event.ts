export interface ItemRecepcionEvent {
  productoId: string;
  codigoLote: string;
  cantidad: number;
  costoUnitario: number;
  temperaturaRecepcion?: number | null;
  fechaVencimiento?: Date | null;
  loteId?: string | null;
}

export class RecepcionCreadaEvent {
  public static readonly EVENT_NAME = 'recepcion.creada';

  constructor(
    public readonly recepcionId: string,
    public readonly sucursalId: string,
    public readonly proveedor: string,
    public readonly usuarioId: string,
    public readonly items: ItemRecepcionEvent[],
    public readonly alertaCadenaFrio: boolean,
    public readonly temperaturaVehiculo?: number | null,
    public readonly timestamp: Date = new Date(),
    public readonly tenantId?: string,
    public readonly temperaturaRecepcion?: number | null,
  ) {}

  get lotes(): ItemRecepcionEvent[] {
    return this.items;
  }
}
