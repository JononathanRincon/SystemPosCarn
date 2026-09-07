import { DetalleVenta } from './detalle-venta.entity';
import { PagoVenta } from './pago-venta.entity';

export type EstadoVenta = 'completada' | 'anulada';

export interface VentaProps {
  id: string;
  sucursalId: string;
  dispositivoId: string;
  cajeroId: string;
  clienteId?: string | null;
  subtotal: number;
  descuento?: number;
  total: number;
  metodoPago: string;
  estado?: EstadoVenta;
  fechaHoraDispositivo: Date;
  fechaHoraServidor?: Date;
  sincronizada?: boolean;
  detalles: DetalleVenta[];
  pagos: PagoVenta[];
}

export class Venta {
  public readonly id: string;
  public readonly sucursalId: string;
  public readonly dispositivoId: string;
  public readonly cajeroId: string;
  public readonly clienteId: string | null;
  public readonly subtotal: number;
  public readonly descuento: number;
  public readonly total: number;
  public readonly metodoPago: string;
  private _estado: EstadoVenta;
  public readonly fechaHoraDispositivo: Date;
  public readonly fechaHoraServidor: Date;
  public readonly sincronizada: boolean;
  public readonly detalles: DetalleVenta[];
  public readonly pagos: PagoVenta[];

  constructor(props: VentaProps) {
    this.id = props.id;
    this.sucursalId = props.sucursalId;
    this.dispositivoId = props.dispositivoId;
    this.cajeroId = props.cajeroId;
    this.clienteId = props.clienteId ?? null;
    this.subtotal = Math.round(Number(props.subtotal) * 100) / 100;
    this.descuento = Math.round((Number(props.descuento) || 0) * 100) / 100;
    this.total = Math.round(Number(props.total) * 100) / 100;
    this.metodoPago = props.metodoPago;
    this._estado = props.estado ?? 'completada';
    this.fechaHoraDispositivo = props.fechaHoraDispositivo;
    this.fechaHoraServidor = props.fechaHoraServidor ?? new Date();
    this.sincronizada = props.sincronizada ?? true;
    this.detalles = [...props.detalles];
    this.pagos = [...props.pagos];
  }

  get estado(): EstadoVenta {
    return this._estado;
  }

  public anular(): void {
    if (this._estado === 'anulada') {
      throw new Error('La venta ya se encuentra anulada.');
    }
    this._estado = 'anulada';
  }

  /**
   * EARS-VENTA-01, EARS-VENTA-03, EARS-VENTA-04:
   * Valida la concordancia matemática entre líneas de detalle, subtotales, descuentos y pagos.
   */
  public static calcularTotales(
    detalles: { cantidad: number; precioUnitario: number }[],
    descuento = 0,
  ): { subtotal: number; descuento: number; total: number } {
    let subtotal = 0;
    for (const item of detalles) {
      const linea = Math.round(Number(item.cantidad) * Number(item.precioUnitario) * 100) / 100;
      subtotal += linea;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const desc = Math.round(Number(descuento) * 100) / 100;
    const total = Math.max(0, Math.round((subtotal - desc) * 100) / 100);
    return { subtotal, descuento: desc, total };
  }

  public toJSON() {
    return {
      id: this.id,
      sucursalId: this.sucursalId,
      dispositivoId: this.dispositivoId,
      cajeroId: this.cajeroId,
      clienteId: this.clienteId,
      subtotal: this.subtotal,
      descuento: this.descuento,
      total: this.total,
      metodoPago: this.metodoPago,
      estado: this.estado,
      fechaHoraDispositivo: this.fechaHoraDispositivo,
      fechaHoraServidor: this.fechaHoraServidor,
      sincronizada: this.sincronizada,
      detalles: this.detalles.map((d) => d.toJSON()),
      pagos: this.pagos.map((p) => p.toJSON()),
    };
  }
}
