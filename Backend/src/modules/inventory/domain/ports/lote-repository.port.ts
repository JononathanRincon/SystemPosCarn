import { Lote, EstadoLote } from '../entities/lote.entity';

export interface ILoteRepository {
  crear(lote: Lote): Promise<Lote>;
  crearMuchos(lotes: Lote[]): Promise<Lote[]>;
  buscarPorId(id: string): Promise<Lote | null>;
  buscarPorCodigo(codigoLote: string, sucursalId: string): Promise<Lote | null>;
  buscarPorSucursal(sucursalId: string, productoId?: string, estado?: EstadoLote): Promise<Lote[]>;
  buscarLotesActivosPorProductoFEFO(productoId: string, sucursalId: string): Promise<Lote[]>;
  buscarProximosAVencer(sucursalId: string, diasLimite: number): Promise<Lote[]>;
  actualizar(lote: Lote): Promise<Lote>;
  actualizarMuchos(lotes: Lote[]): Promise<void>;
}

export const LOTE_REPOSITORY = Symbol('ILoteRepository');
