import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OpenCashShiftDto {
  @IsUUID('4', { message: 'sucursalId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'sucursalId es obligatorio' })
  sucursalId!: string;

  @IsString({ message: 'dispositivoId debe ser un string válido' })
  @IsNotEmpty({ message: 'dispositivoId es obligatorio' })
  dispositivoId!: string;

  @IsUUID('4', { message: 'usuarioId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'usuarioId es obligatorio' })
  usuarioId!: string;

  @IsNumber({}, { message: 'montoApertura debe ser un número' })
  @Min(0, { message: 'montoApertura no puede ser negativo' })
  montoApertura!: number;
}

export class CloseCashShiftDto {
  @IsUUID('4', { message: 'corteId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'corteId es obligatorio' })
  corteId!: string;

  @IsNumber({}, { message: 'totalEfectivoContado debe ser un número' })
  @Min(0, { message: 'totalEfectivoContado no puede ser negativo' })
  totalEfectivoContado!: number;

  @IsOptional()
  totalesPorMetodoPago?: Record<string, number>;

  @IsOptional()
  @IsString({ message: 'observaciones debe ser un texto' })
  observaciones?: string;
}

export class CurrentCashShiftQueryDto {
  @IsNotEmpty({ message: 'dispositivoId es obligatorio' })
  @IsString({ message: 'dispositivoId debe ser un string válido' })
  dispositivoId!: string;
}

export interface CashShiftResponseDto {
  corteId: string;
  sucursalId: string;
  dispositivoId: string | null;
  usuarioId: string;
  estado: string;
  fechaApertura: Date;
  fechaCierre?: Date | null;
  montoApertura: number;
  ventasAcumuladas: number;
  totalIngresosExtra?: number;
  totalEgresos?: number;
  efectivoEsperado: number;
  totalEfectivoContado?: number;
  diferencia?: number;
  totalesPorMetodoPago?: Record<string, number>;
  observaciones?: string | null;
}
