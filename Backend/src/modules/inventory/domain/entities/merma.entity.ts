export type MotivoMerma = 'corte_proceso' | 'vencimiento' | 'dano' | 'robo' | 'otro';

export interface MermaProps {
  id: string;
  productoId: string;
  sucursalId: string;
  usuarioId: string;
  dispositivoId: string;
  cantidad: number;
  motivo: MotivoMerma;
  loteId?: string | null;
  fotoEvidenciaUrl?: string | null;
  fechaHoraDispositivo?: Date;
  notas?: string | null;
}

export interface MermaResponseDto {
  id: string;
  productoId: string;
  sucursalId: string;
  loteId: string | null;
  dispositivoId: string;
  cantidad: number;
  motivo: MotivoMerma;
  usuarioId: string;
  fotoEvidenciaUrl: string | null;
  fechaHoraDispositivo: Date;
  notas: string | null;
}

export const MOTIVOS_MERMA_VALIDOS: MotivoMerma[] = [
  'corte_proceso',
  'vencimiento',
  'dano',
  'robo',
  'otro',
];

export class Merma {
  private readonly _id: string;
  private readonly _productoId: string;
  private readonly _sucursalId: string;
  private readonly _usuarioId: string;
  private readonly _dispositivoId: string;
  private readonly _cantidad: number;
  private readonly _motivo: MotivoMerma;
  private readonly _loteId: string | null;
  private readonly _fotoEvidenciaUrl: string | null;
  private readonly _fechaHoraDispositivo: Date;
  private readonly _notas: string | null;

  constructor(props: MermaProps) {
    if (!props.id) throw new Error('El ID de merma es obligatorio');
    if (!props.productoId) throw new Error('El productoId es obligatorio');
    if (!props.sucursalId) throw new Error('El sucursalId es obligatorio');
    if (!props.usuarioId) throw new Error('El usuarioId es obligatorio');
    if (!props.dispositivoId) throw new Error('El dispositivoId es obligatorio');

    if (props.cantidad === undefined || props.cantidad === null || props.cantidad <= 0) {
      throw new Error('La cantidad de merma debe ser estrictamente mayor a cero');
    }

    if (!props.motivo || !MOTIVOS_MERMA_VALIDOS.includes(props.motivo)) {
      throw new Error(
        `El motivo de merma es obligatorio y debe ser uno de: ${MOTIVOS_MERMA_VALIDOS.join(', ')}`,
      );
    }

    this._id = props.id;
    this._productoId = props.productoId;
    this._sucursalId = props.sucursalId;
    this._usuarioId = props.usuarioId;
    this._dispositivoId = props.dispositivoId;
    this._cantidad = Number(props.cantidad.toFixed(3));
    this._motivo = props.motivo;
    this._loteId = props.loteId || null;
    this._fotoEvidenciaUrl = props.fotoEvidenciaUrl?.trim() || null;
    this._fechaHoraDispositivo = props.fechaHoraDispositivo || new Date();
    this._notas = props.notas?.trim() || null;
  }

  get id(): string { return this._id; }
  get productoId(): string { return this._productoId; }
  get sucursalId(): string { return this._sucursalId; }
  get usuarioId(): string { return this._usuarioId; }
  get dispositivoId(): string { return this._dispositivoId; }
  get cantidad(): number { return this._cantidad; }
  get motivo(): MotivoMerma { return this._motivo; }
  get loteId(): string | null { return this._loteId; }
  get fotoEvidenciaUrl(): string | null { return this._fotoEvidenciaUrl; }
  get fechaHoraDispositivo(): Date { return this._fechaHoraDispositivo; }
  get notas(): string | null { return this._notas; }

  public toResponseDto(): MermaResponseDto {
    return {
      id: this._id,
      productoId: this._productoId,
      sucursalId: this._sucursalId,
      loteId: this._loteId,
      dispositivoId: this._dispositivoId,
      cantidad: this._cantidad,
      motivo: this._motivo,
      usuarioId: this._usuarioId,
      fotoEvidenciaUrl: this._fotoEvidenciaUrl,
      fechaHoraDispositivo: this._fechaHoraDispositivo,
      notas: this._notas,
    };
  }
}
