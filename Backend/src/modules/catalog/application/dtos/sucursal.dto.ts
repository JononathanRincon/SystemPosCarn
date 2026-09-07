import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateSucursalDto {
  @IsString({ message: 'El nombre de la sucursal debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la sucursal es requerido' })
  nombre!: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  direccion?: string;

  @IsOptional()
  @IsString({ message: 'La ciudad debe ser una cadena de texto' })
  ciudad?: string;

  @IsOptional()
  @IsString({ message: 'La zona horaria debe ser una cadena de texto' })
  zonaHoraria?: string;

  @IsOptional()
  @IsUUID('4', { message: 'El negocioId debe ser un UUID válido' })
  negocioId?: string;
}

export class UpdateSucursalDto {
  @IsOptional()
  @IsString({ message: 'El nombre de la sucursal debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre de la sucursal no puede estar vacío' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'La dirección debe ser una cadena de texto' })
  direccion?: string;

  @IsOptional()
  @IsString({ message: 'La ciudad debe ser una cadena de texto' })
  ciudad?: string;

  @IsOptional()
  @IsString({ message: 'La zona horaria debe ser una cadena de texto' })
  zonaHoraria?: string;
}
