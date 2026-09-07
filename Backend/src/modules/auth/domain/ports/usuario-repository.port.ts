import { Usuario } from '../entities/usuario.entity';

export const USUARIO_REPOSITORY_PORT = Symbol('USUARIO_REPOSITORY_PORT');

export interface UsuarioRepositoryPort {
  findById(id: string): Promise<Usuario | null>;
  findByEmail(email: string): Promise<Usuario | null>;
  findByNegocioAndPin(negocioId: string, pin: string): Promise<Usuario | null>;
  findBySucursal?(sucursalId: string): Promise<Usuario[]>;
  findBySucursalAndPin?(sucursalId: string, pin: string): Promise<Usuario | null>;
  save(usuario: Usuario): Promise<Usuario>;
}
