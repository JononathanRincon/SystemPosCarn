import { AlertaStockDto } from '../../../inventory/application/dtos/inventario.dto';
import { LoteDetalleDto } from '../../../inventory/application/dtos/lote.dto';

export interface ResumenVentasCajeroDto {
  cajeroId: string;
  nombreCajero?: string;
  totalVentas: number;
  totalTransacciones: number;
  ticketPromedio: number;
}

export interface EstadoCajaActualDto {
  corteId?: string;
  dispositivoId?: string;
  estado: 'abierta' | 'cerrada' | 'sin_turno';
  montoApertura: number;
  ventasAcumuladasEfectivo: number;
  efectivoEsperado: number;
}

export interface TopProductoManagerDto {
  productoId: string;
  nombreProducto: string;
  tipoVenta: 'peso' | 'unidad';
  cantidadTotal: number;
  unidadMedida: string;
  totalRecaudado: number;
}

export interface DashboardManagerResponseDto {
  sucursalId: string;
  nombreSucursal: string;
  fecha: Date;
  syncTimestamp: string; // ISO String exigido por EARS-DASH-01
  ventasTurnoActual: {
    totalVentas: number;
    totalTransacciones: number;
    ticketPromedio: number;
    desgloseMetodosPago: Record<string, number>;
  };
  estadoCaja: EstadoCajaActualDto;
  ventasPorCajero: ResumenVentasCajeroDto[];
  topProductos: TopProductoManagerDto[];
  inventarioCritico: AlertaStockDto[];
  lotesPorVencer: LoteDetalleDto[];
  mermasHoy: {
    totalRegistros: number;
    cantidadTotalKg: number;
  };
}
