import { Categoria } from '../entities/categoria.entity';

export const CATEGORIA_REPOSITORY_PORT = Symbol('CATEGORIA_REPOSITORY_PORT');

export interface CategoriaRepositoryPort {
  findById(id: string, negocioId: string): Promise<Categoria | null>;
  findByNegocioId(negocioId: string): Promise<Categoria[]>;
  save(categoria: Categoria): Promise<Categoria>;
  delete(id: string, negocioId: string): Promise<boolean>;
}
