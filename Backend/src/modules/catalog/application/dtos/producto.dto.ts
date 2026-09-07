import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsNumber,
  IsPositive,
  Min,
  IsBoolean,
} from 'class-validator';
import { TipoVenta, UnidadMedida } from '../../domain/entities/producto.entity';

export class CreateProductoDto {
  @IsUUID('4', { message: 'El categoriaId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El categoriaId es requerido' })
  categoriaId!: string;

  @IsString({ message: 'El nombre del producto debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del producto es requerido' })
  nombre!: string;

  @IsOptional()
  @IsString({ message: 'El código de barras debe ser una cadena de texto' })
  codigoBarras?: string;

  @IsIn(['peso', 'unidad'], { message: "El tipo de venta debe ser 'peso' o 'unidad'" })
  @IsNotEmpty({ message: 'El tipo de venta es requerido' })
  tipoVenta!: TipoVenta;

  @IsIn(['kg', 'g', 'unidad'], { message: "La unidad de medida debe ser 'kg', 'g' o 'unidad'" })
  @IsNotEmpty({ message: 'La unidad de medida es requerida' })
  unidadMedida!: UnidadMedida;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser un número con máximo 2 decimales' })
  @IsPositive({ message: 'El precio debe ser un número estrictamente positivo' })
  precio!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El costo promedio debe ser un número con máximo 2 decimales' })
  @Min(0, { message: 'El costo promedio no puede ser negativo' })
  costoPromedio?: number;

  @IsOptional()
  @IsString({ message: 'La URL de la foto debe ser una cadena de texto' })
  fotoUrl?: string;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser un booleano' })
  activo?: boolean;
}

export class UpdateProductoDto {
  @IsOptional()
  @IsUUID('4', { message: 'El categoriaId debe ser un UUID válido' })
  categoriaId?: string;

  @IsOptional()
  @IsString({ message: 'El nombre del producto debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del producto no puede estar vacío' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'El código de barras debe ser una cadena de texto' })
  codigoBarras?: string;

  @IsOptional()
  @IsIn(['peso', 'unidad'], { message: "El tipo de venta debe ser 'peso' o 'unidad'" })
  tipoVenta?: TipoVenta;

  @IsOptional()
  @IsIn(['kg', 'g', 'unidad'], { message: "La unidad de medida debe ser 'kg', 'g' o 'unidad'" })
  unidadMedida?: UnidadMedida;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser un número con máximo 2 decimales' })
  @IsPositive({ message: 'El precio debe ser un número estrictamente positivo' })
  precio?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El costo promedio debe ser un número con máximo 2 decimales' })
  @Min(0, { message: 'El costo promedio no puede ser negativo' })
  costoPromedio?: number;

  @IsOptional()
  @IsString({ message: 'La URL de la foto debe ser una cadena de texto' })
  fotoUrl?: string;

  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser un booleano' })
  activo?: boolean;
}

export class FilterProductosDto {
  @IsOptional()
  @IsUUID('4', { message: 'El categoriaId debe ser un UUID válido' })
  categoriaId?: string;

  @IsOptional()
  @IsBoolean({ message: 'El filtro activo debe ser booleano' })
  activo?: boolean;
}
