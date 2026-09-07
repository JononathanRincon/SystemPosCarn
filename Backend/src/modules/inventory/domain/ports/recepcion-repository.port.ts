import { RecepcionMercancia } from '../entities/recepcion-mercancia.entity';

export interface IRecepcionRepository {
  crear(recepcion: RecepcionMercancia): Promise<RecepcionMercancia>;
  buscarPorId(id: string): Promise<RecepcionMercancia | null>;
  buscarPorSucursal(sucursalId: string, limit?: number, offset?: number): Promise<RecepcionMercancia[]>;
}

export const RECEPCION_REPOSITORY = Symbol('IRecepcionRepository');
