import { CorteCaja } from '../entities/corte-caja.entity';

export const CORTE_CAJA_REPOSITORY = Symbol('CORTE_CAJA_REPOSITORY');

export interface ICorteCajaRepository {
  crear(corte: CorteCaja): Promise<CorteCaja>;
  buscarPorId(id: string): Promise<CorteCaja | null>;
  buscarTurnoAbiertoPorDispositivo(dispositivoId: string): Promise<CorteCaja | null>;
  buscarUltimoPorDispositivo(dispositivoId: string): Promise<CorteCaja | null>;
  buscarPorSucursal(sucursalId: string): Promise<CorteCaja[]>;
  actualizar(corte: CorteCaja): Promise<CorteCaja>;
}
