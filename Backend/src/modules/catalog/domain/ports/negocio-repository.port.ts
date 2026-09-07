import { Negocio } from '../entities/negocio.entity';

export const NEGOCIO_REPOSITORY_PORT = Symbol('NEGOCIO_REPOSITORY_PORT');

export interface NegocioRepositoryPort {
  findById(id: string): Promise<Negocio | null>;
  findByNit(nitRut: string): Promise<Negocio | null>;
  save(negocio: Negocio): Promise<Negocio>;
  findAll(): Promise<Negocio[]>;
}
