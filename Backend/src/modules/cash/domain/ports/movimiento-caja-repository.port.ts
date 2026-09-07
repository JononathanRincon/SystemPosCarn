import { MovimientoCaja } from '../entities/movimiento-caja.entity';

export const MOVIMIENTO_CAJA_REPOSITORY = Symbol('MOVIMIENTO_CAJA_REPOSITORY');

export interface IMovimientoCajaRepository {
  crear(movimiento: MovimientoCaja): Promise<MovimientoCaja>;
  buscarPorId(id: string): Promise<MovimientoCaja | null>;
  buscarPorCorteId(corteId: string): Promise<MovimientoCaja[]>;
  buscarPorSucursal(sucursalId: string, desde?: Date, hasta?: Date): Promise<MovimientoCaja[]>;
  obtenerTotalesPorCorte(corteId: string): Promise<{ totalIngresos: number; totalEgresos: number }>;
}