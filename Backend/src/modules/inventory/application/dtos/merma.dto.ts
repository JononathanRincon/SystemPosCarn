import { IsUUID, IsNumber, IsString, IsNotEmpty, IsOptional, IsEnum, Min } from 'class-validator';
import { MotivoMerma, MOTIVOS_MERMA_VALIDOS } from '../../domain/entities/merma.entity';

export class CreateMermaDto {
  @IsUUID('4', { message: 'El producto_id debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El producto_id es obligatorio' })
  producto_id!: string;

  @IsUUID('4', { message: 'El sucursal_id debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El sucursal_id es obligatorio' })
  sucursal_id!: string;

  @IsUUID('4', { message: 'El dispositivo_id debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El dispositivo_id es obligatorio' })
  dispositivo_id!: string;

  @IsNumber({}, { message: 'La cantidad debe ser numérica' })
  @Min(0.001, { message: 'La cantidad debe ser mayor a cero' })
  cantidad!: number;

  @IsEnum(MOTIVOS_MERMA_VALIDOS, {
    message: `El motivo debe ser uno de: ${MOTIVOS_MERMA_VALIDOS.join(', ')}`,
  })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  motivo!: MotivoMerma;

  @IsOptional()
  @IsUUID('4', { message: 'El lote_id debe ser un UUID válido' })
  lote_id?: string | null;

  @IsOptional()
  @IsString({ message: 'foto_evidencia_url debe ser una cadena de texto' })
  foto_evidencia_url?: string | null;

  @IsOptional()
  @IsString({ message: 'notas debe ser una cadena de texto' })
  notas?: string | null;
}

export interface MermaResultDto {
  id: string;
  producto_id: string;
  sucursal_id: string;
  lote_id: string | null;
  cantidad: number;
  motivo: MotivoMerma;
  descuento_lote_aplicado: boolean;
  nuevo_stock_sucursal: number;
  mensaje: string;
}
