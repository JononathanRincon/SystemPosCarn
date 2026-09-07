import { IsNotEmpty, IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateCategoriaDto {
  @IsString({ message: 'El nombre de la categoría debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la categoría es requerido' })
  nombre!: string;

  @IsOptional()
  @IsInt({ message: 'El orden de visualización debe ser un número entero' })
  @Min(0, { message: 'El orden de visualización no puede ser negativo' })
  ordenVisualizacion?: number;
}

export class UpdateCategoriaDto {
  @IsOptional()
  @IsString({ message: 'El nombre de la categoría debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la categoría no puede estar vacío' })
  nombre?: string;

  @IsOptional()
  @IsInt({ message: 'El orden de visualización debe ser un número entero' })
  @Min(0, { message: 'El orden de visualización no puede ser negativo' })
  ordenVisualizacion?: number;
}
