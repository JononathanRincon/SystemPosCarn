import { Venta } from '../entities/venta.entity';

export const VENTA_REPOSITORY = Symbol('VENTA_REPOSITORY');

export interface IVentaRepository {
  guardarTransaccional(venta: Venta): Promise<Venta>;
  buscarPorId(id: string): Promise<Venta | null>;
  buscarPorDispositivoYRango(dispositivoId: string, desde: Date, hasta?: Date): Promise<Venta[]>;
  buscarPorSucursal(sucursalId: string, limite?: number): Promise<Venta[]>;
  actualizar(venta: Venta): Promise<Venta>;
}
