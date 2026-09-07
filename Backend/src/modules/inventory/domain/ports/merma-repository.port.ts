import { Merma } from '../entities/merma.entity';

export interface IMermaRepository {
  crear(merma: Merma): Promise<Merma>;
  buscarPorId(id: string): Promise<Merma | null>;
  buscarPorSucursal(sucursalId: string, limit?: number, offset?: number): Promise<Merma[]>;
  buscarPorLote(loteId: string): Promise<Merma[]>;
}

export const MERMA_REPOSITORY = Symbol('IMermaRepository');
