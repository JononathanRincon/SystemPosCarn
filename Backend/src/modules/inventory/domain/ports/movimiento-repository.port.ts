import { MovimientoInventario } from '../entities/movimiento-inventario.entity';

export interface IMovimientoRepository {
  crear(movimiento: MovimientoInventario): Promise<MovimientoInventario>;
  crearMuchos(movimientos: MovimientoInventario[]): Promise<MovimientoInventario[]>;
  buscarPorSucursal(sucursalId: string, limit?: number, offset?: number): Promise<MovimientoInventario[]>;
  buscarPorProducto(productoId: string, sucursalId: string): Promise<MovimientoInventario[]>;
}

export const MOVIMIENTO_REPOSITORY = Symbol('IMovimientoRepository');
