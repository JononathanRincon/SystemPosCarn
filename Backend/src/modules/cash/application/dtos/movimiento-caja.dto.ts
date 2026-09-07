import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { TipoMovimientoCaja, CategoriaMovimientoCaja } from '../../domain/entities/movimiento-caja.entity';

export class RegistrarMovimientoCajaDto {
  @IsUUID('4', { message: 'corteId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'corteId es obligatorio' })
  corteId!: string;

  @IsOptional()
  @IsString({ message: 'dispositivoId debe ser un string válido' })
  dispositivoId?: string;

  @IsUUID('4', { message: 'sucursalId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'sucursalId es obligatorio' })
  sucursalId!: string;

  @IsUUID('4', { message: 'usuarioId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'usuarioId es obligatorio' })
  usuarioId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'autorizadoPorId debe ser un UUID válido' })
  autorizadoPorId?: string;

  @IsNotEmpty({ message: 'tipo es obligatorio' })
  @IsEnum(['ingreso', 'egreso'], { message: 'tipo debe ser ingreso o egreso' })
  tipo!: TipoMovimientoCaja;

  @IsNotEmpty({ message: 'categoria es obligatoria' })
  @IsEnum(
    [
      'compra_materia_prima',
      'flete_transporte',
      'insumos_empaque',
      'hielo_refrigeracion',
      'servicios_mantenimiento',
      'anticipo_nomina',
      'inyeccion_base',
      'abono_fiado',
      'sangria_seguridad',
      'otro',
    ],
    { message: 'categoria debe ser una de las categorías válidas de carnicería' },
  )
  categoria!: CategoriaMovimientoCaja;

  @IsNumber({}, { message: 'monto debe ser un número' })
  @Min(0.01, { message: 'monto debe ser mayor a 0' })
  monto!: number;

  @IsOptional()
  @IsString({ message: 'beneficiarioProveedor debe ser un texto' })
  beneficiarioProveedor?: string;

  @IsOptional()
  @IsString({ message: 'comprobante debe ser un texto' })
  comprobante?: string;

  @IsNotEmpty({ message: 'descripcion es obligatoria' })
  @IsString({ message: 'descripcion debe ser un texto' })
  descripcion!: string;

  @IsOptional()
  fechaHoraDispositivo?: Date;
}

export interface MovimientoCajaResponseDto {
  id: string;
  corteId: string;
  sucursalId: string;
  dispositivoId: string | null;
  usuarioId: string;
  autorizadoPorId: string | null;
  tipo: TipoMovimientoCaja;
  categoria: CategoriaMovimientoCaja;
  monto: number;
  beneficiarioProveedor: string | null;
  comprobante: string | null;
  descripcion: string;
  fechaHoraDispositivo: Date;
  fechaHoraServidor: Date;
  sincronizado: boolean;
}

export interface ResumenMovimientosTurnoDto {
  corteId: string;
  montoApertura: number;
  ventasEfectivo: number;
  totalIngresosExtra: number;
  totalEgresos: number;
  saldoDisponible: number;
  efectivoEsperado: number;
  movimientos: MovimientoCajaResponseDto[];
}