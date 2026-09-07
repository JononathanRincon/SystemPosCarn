import { Sucursal } from '../entities/sucursal.entity';

export const SUCURSAL_REPOSITORY_PORT = Symbol('SUCURSAL_REPOSITORY_PORT');

export interface SucursalRepositoryPort {
  findById(id: string): Promise<Sucursal | null>;
  findByNegocioId(negocioId: string): Promise<Sucursal[]>;
  findByIdAndNegocioId(id: string, negocioId: string): Promise<Sucursal | null>;
  save(sucursal: Sucursal): Promise<Sucursal>;
  delete(id: string, negocioId: string): Promise<boolean>;
}
