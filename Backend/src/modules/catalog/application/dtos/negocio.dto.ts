import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';
import { PlanNegocio } from '../../domain/entities/negocio.entity';

export class CreateNegocioDto {
  @IsString({ message: 'El nombre comercial debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre comercial es requerido' })
  nombreComercial!: string;

  @IsString({ message: 'La razón social debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La razón social es requerida' })
  razonSocial!: string;

  @IsString({ message: 'El NIT/RUT debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El NIT/RUT es requerido' })
  nitRut!: string;

  @IsOptional()
  @IsIn(['basico', 'pro', 'enterprise'], { message: 'El plan debe ser basico, pro o enterprise' })
  plan?: PlanNegocio;
}

export class UpdateNegocioDto {
  @IsOptional()
  @IsString({ message: 'El nombre comercial debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre comercial no puede estar vacío' })
  nombreComercial?: string;

  @IsOptional()
  @IsString({ message: 'La razón social debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La razón social no puede estar vacía' })
  razonSocial?: string;

  @IsOptional()
  @IsIn(['basico', 'pro', 'enterprise'], { message: 'El plan debe ser basico, pro o enterprise' })
  plan?: PlanNegocio;
}
