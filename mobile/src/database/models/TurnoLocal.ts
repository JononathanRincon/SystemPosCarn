import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export class TurnoLocal extends Model {
  static table = 'turnos';

  @field('sucursal_id') sucursalId?: string | null;
  @field('dispositivo_id') dispositivoId?: string | null;
  @field('usuario_id') usuarioId!: string;
  @field('estado') estado!: 'abierta' | 'cerrada';
  @field('monto_apertura') montoApertura!: number;
  @readonly @date('fecha_apertura') fechaApertura!: Date;
  @date('fecha_cierre') fechaCierre?: Date | null;
  @field('total_efectivo_esperado') totalEfectivoEsperado?: number | null;
  @field('total_efectivo_contado') totalEfectivoContado?: number | null;
  @field('diferencia') diferencia?: number | null;
}
