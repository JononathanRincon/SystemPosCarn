export class VentaCompletadaEvent {
  public static readonly EVENT_NAME = 'venta.completada';

  constructor(
    public readonly ventaId: string,
    public readonly sucursalId: string,
    public readonly dispositivoId: string,
    public readonly total: number,
    public readonly detalles: {
      productoId: string;
      cantidad: number;
      precioUnitario: number;
      pesoNeto?: number | null;
    }[],
    public readonly timestamp: Date = new Date(),
  ) {}
}
