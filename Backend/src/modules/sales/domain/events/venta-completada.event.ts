export interface ItemVentaCompletada {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  pesoNeto?: number | null;
  loteId?: string | null;
}

export class VentaCompletadaEvent {
  public static readonly EVENT_NAME = 'venta.completada';

  constructor(
    public readonly ventaId: string,
    public readonly sucursalId: string,
    public readonly dispositivoId: string,
    public readonly total: number,
    public readonly detalles: ItemVentaCompletada[],
    public readonly timestamp: Date = new Date(),
    public readonly metodoPago?: string,
    public readonly tenantId?: string,
  ) {}

  get items(): ItemVentaCompletada[] {
    return this.detalles;
  }
}
