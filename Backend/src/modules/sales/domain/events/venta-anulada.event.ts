export interface DetalleVentaAnulada {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  pesoNeto?: number | null;
}

export class VentaAnuladaEvent {
  public static readonly EVENT_NAME = 'venta.anulada';

  constructor(
    public readonly ventaId: string,
    public readonly sucursalId: string,
    public readonly motivo: string,
    public readonly usuarioId: string,
    public readonly detalles: DetalleVentaAnulada[],
    public readonly timestamp: Date = new Date(),
  ) {}
}
