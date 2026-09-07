export interface AlertaStockNegativoDto {
  productoId: string;
  sucursalId: string;
  stockResultante: number;
  deltaAplicado: number;
  referenciaVentaId?: string;
  dispositivoId: string;
  fechaDeteccion: Date;
  severidad: 'alta' | 'critica';
  mensaje: string;
}

export class AlertaStockNegativoEvent {
  public static readonly EVENT_NAME = 'inventario.stock_negativo';

  constructor(public readonly alerta: AlertaStockNegativoDto) {}
}
