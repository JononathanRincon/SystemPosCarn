import { Inventario } from '../entities/inventario.entity';

export interface IInventarioRepository {
  crear(inventario: Inventario): Promise<Inventario>;
  buscarPorProductoYSucursal(productoId: string, sucursalId: string): Promise<Inventario | null>;
  buscarPorSucursal(sucursalId: string): Promise<Inventario[]>;
  buscarBajoStock(sucursalId: string): Promise<Inventario[]>;
  actualizar(inventario: Inventario): Promise<Inventario>;
}

export const INVENTARIO_REPOSITORY = Symbol('IInventarioRepository');
