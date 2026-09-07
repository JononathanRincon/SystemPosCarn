import { Producto } from '../entities/producto.entity';

export const PRODUCTO_REPOSITORY_PORT = Symbol('PRODUCTO_REPOSITORY_PORT');

export interface ProductoRepositoryPort {
  findById(id: string, negocioId: string): Promise<Producto | null>;
  findByNegocioId(negocioId: string, options?: { categoriaId?: string; activo?: boolean }): Promise<Producto[]>;
  findByCodigoBarras(codigoBarras: string, negocioId: string): Promise<Producto | null>;
  save(producto: Producto): Promise<Producto>;
  delete(id: string, negocioId: string): Promise<boolean>;
}
