export interface DetalleVentaProps {
  id?: string;
  ventaId: string;
  productoId: string;
  cantidad: number;
  precioUnitario: number;
  subtotalLinea?: number;
  pesoBruto?: number | null;
  pesoNeto?: number | null;
}

export class DetalleVenta {
  public readonly id?: string;
  public readonly ventaId: string;
  public readonly productoId: string;
  public readonly cantidad: number;
  public readonly precioUnitario: number; // Snapshot inmutable
  public readonly subtotalLinea: number;
  public readonly pesoBruto: number | null;
  public readonly pesoNeto: number | null;

  constructor(props: DetalleVentaProps) {
    this.id = props.id;
    this.ventaId = props.ventaId;
    this.productoId = props.productoId;
    this.cantidad = Number(props.cantidad);
    this.precioUnitario = Number(props.precioUnitario);
    this.subtotalLinea =
      props.subtotalLinea !== undefined
        ? Math.round(Number(props.subtotalLinea) * 100) / 100
        : Math.round(this.cantidad * this.precioUnitario * 100) / 100;
    this.pesoBruto = props.pesoBruto !== undefined ? props.pesoBruto : null;
    this.pesoNeto = props.pesoNeto !== undefined ? props.pesoNeto : null;
  }

  public toJSON() {
    return {
      id: this.id,
      ventaId: this.ventaId,
      productoId: this.productoId,
      cantidad: this.cantidad,
      precioUnitario: this.precioUnitario,
      subtotalLinea: this.subtotalLinea,
      pesoBruto: this.pesoBruto,
      pesoNeto: this.pesoNeto,
    };
  }
}
