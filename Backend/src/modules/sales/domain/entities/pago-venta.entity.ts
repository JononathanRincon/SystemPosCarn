export type MetodoPagoVenta = 'efectivo' | 'tarjeta' | 'transferencia' | 'fiado' | string;

export interface PagoVentaProps {
  id?: string;
  ventaId: string;
  metodo: MetodoPagoVenta;
  monto: number;
  referenciaTransaccion?: string | null;
}

export class PagoVenta {
  public readonly id?: string;
  public readonly ventaId: string;
  public readonly metodo: MetodoPagoVenta;
  public readonly monto: number;
  public readonly referenciaTransaccion: string | null;

  constructor(props: PagoVentaProps) {
    this.id = props.id;
    this.ventaId = props.ventaId;
    this.metodo = props.metodo;
    this.monto = Math.round(Number(props.monto) * 100) / 100;
    this.referenciaTransaccion = props.referenciaTransaccion ?? null;
  }

  public toJSON() {
    return {
      id: this.id,
      ventaId: this.ventaId,
      metodo: this.metodo,
      monto: this.monto,
      referenciaTransaccion: this.referenciaTransaccion,
    };
  }
}
