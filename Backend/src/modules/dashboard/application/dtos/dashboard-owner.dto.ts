export interface MetricasVentasOwnerDto {
  totalVentas: number;
  totalTransacciones: number;
  ticketPromedio: number;
  costoTotalEstimado: number;
  margenBrutoEstimado: number;
  porcentajeMargenBruto: number;
}

export interface VentasPorMetodoPagoDto {
  metodo: string;
  monto: number;
  porcentaje: number;
}

export interface ComparativoSucursalDto {
  sucursalId: string;
  nombreSucursal: string;
  totalVentas: number;
  totalTransacciones: number;
  ticketPromedio: number;
  participacion: number;
}

export interface TopProductoOwnerDto {
  productoId: string;
  nombreProducto: string;
  cantidadTotal: number;
  unidadMedida: string;
  montoTotal: number;
}

export interface DashboardOwnerResponseDto {
  negocioId: string;
  fechaInicio: Date;
  fechaFin: Date;
  syncTimestamp: string; // ISO String exigido por EARS-DASH-01
  ventasHoy: MetricasVentasOwnerDto;
  ventasAyer?: MetricasVentasOwnerDto;
  desgloseMetodosPago: VentasPorMetodoPagoDto[];
  comparativoSucursales: ComparativoSucursalDto[];
  topProductos: TopProductoOwnerDto[];
  alertasStockBajoTotal: number;
  lotesPorVencerTotal: number;
}
