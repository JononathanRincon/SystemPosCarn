import { IsUUID, IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemRecepcionDto {
  @IsUUID('4', { message: 'El producto_id debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El producto_id es obligatorio' })
  producto_id!: string;

  @IsString({ message: 'El codigo_lote debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El codigo_lote es obligatorio' })
  codigo_lote!: string;

  @IsNumber({}, { message: 'La cantidad debe ser numérica' })
  @Min(0.001, { message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;

  @IsNumber({}, { message: 'El costo_unitario debe ser numérico' })
  @Min(0, { message: 'El costo_unitario no puede ser negativo' })
  costo_unitario!: number;

  @IsOptional()
  @IsString({ message: 'fecha_vencimiento debe ser una fecha ISO válida' })
  fecha_vencimiento?: string | null;

  @IsOptional()
  @IsNumber({}, { message: 'La temperatura_recepcion debe ser un número' })
  temperatura_recepcion?: number | null;

  @IsOptional()
  @IsString()
  notas?: string | null;
}

export class CreateRecepcionDto {
  @IsUUID('4', { message: 'El sucursal_id debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El sucursal_id es obligatorio' })
  sucursal_id!: string;

  @IsString({ message: 'El proveedor debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El proveedor es obligatorio' })
  proveedor!: string;

  @IsOptional()
  @IsNumber({}, { message: 'La temperatura_vehiculo debe ser un número' })
  temperatura_vehiculo?: number | null;

  @IsOptional()
  @IsString()
  numero_factura_remision?: string | null;

  @IsOptional()
  @IsString()
  observaciones?: string | null;

  @IsArray({ message: 'items debe ser un arreglo de items de recepción' })
  @ValidateNested({ each: true })
  @Type(() => ItemRecepcionDto)
  items!: ItemRecepcionDto[];
}

export interface RecepcionResponse {
  recepcion_id: string;
  alerta_cadena_frio: boolean;
  lotes_creados: number;
  mensaje: string;
}
