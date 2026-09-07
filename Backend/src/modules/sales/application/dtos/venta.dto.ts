import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDetalleVentaDto {
  @IsUUID('4', { message: 'productoId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'productoId es obligatorio' })
  productoId!: string;

  @IsNumber({}, { message: 'cantidad debe ser un número' })
  @Min(0.001, { message: 'cantidad debe ser mayor a 0' })
  cantidad!: number;

  @IsNumber({}, { message: 'precioUnitario debe ser un número' })
  @Min(0, { message: 'precioUnitario no puede ser negativo' })
  precioUnitario!: number;

  @IsOptional()
  @IsNumber({}, { message: 'subtotalLinea debe ser un número' })
  subtotalLinea?: number;

  @IsOptional()
  @IsNumber({}, { message: 'pesoBruto debe ser un número' })
  pesoBruto?: number;

  @IsOptional()
  @IsNumber({}, { message: 'pesoNeto debe ser un número' })
  pesoNeto?: number;
}

export class CreatePagoVentaDto {
  @IsString({ message: 'metodo de pago debe ser un texto' })
  @IsNotEmpty({ message: 'metodo de pago es obligatorio' })
  metodo!: string;

  @IsNumber({}, { message: 'monto debe ser un número' })
  @Min(0.01, { message: 'monto debe ser mayor a 0' })
  monto!: number;

  @IsOptional()
  @IsString({ message: 'referenciaTransaccion debe ser un texto' })
  referenciaTransaccion?: string;
}

export class CreateVentaDto {
  @IsUUID('4', { message: 'id debe ser un UUID válido generado en terminal' })
  @IsNotEmpty({ message: 'id es obligatorio para idempotencia' })
  id!: string;

  @IsUUID('4', { message: 'sucursalId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'sucursalId es obligatorio' })
  sucursalId!: string;

  @IsString({ message: 'dispositivoId debe ser un string válido' })
  @IsNotEmpty({ message: 'dispositivoId es obligatorio' })
  dispositivoId!: string;

  @IsUUID('4', { message: 'cajeroId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'cajeroId es obligatorio' })
  cajeroId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'clienteId debe ser un UUID válido' })
  clienteId?: string;

  @IsOptional()
  @IsNumber({}, { message: 'subtotal debe ser un número' })
  subtotal?: number;

  @IsOptional()
  @IsNumber({}, { message: 'descuento debe ser un número' })
  @Min(0, { message: 'descuento no puede ser negativo' })
  descuento?: number;

  @IsNumber({}, { message: 'total debe ser un número' })
  @Min(0, { message: 'total no puede ser negativo' })
  total!: number;

  @IsString({ message: 'metodoPago debe ser un texto' })
  @IsNotEmpty({ message: 'metodoPago es obligatorio' })
  metodoPago!: string;

  @IsString({ message: 'fechaHoraDispositivo debe ser una fecha ISO válida' })
  @IsNotEmpty({ message: 'fechaHoraDispositivo es obligatoria' })
  fechaHoraDispositivo!: string;

  @IsOptional()
  sincronizada?: boolean;

  @IsArray({ message: 'detalles debe ser un arreglo de items vendidos' })
  @ValidateNested({ each: true })
  @Type(() => CreateDetalleVentaDto)
  detalles!: CreateDetalleVentaDto[];

  @IsArray({ message: 'pagos debe ser un arreglo de formas de pago' })
  @ValidateNested({ each: true })
  @Type(() => CreatePagoVentaDto)
  pagos!: CreatePagoVentaDto[];
}

export class VoidVentaDto {
  @IsString({ message: 'motivo es obligatorio' })
  @IsNotEmpty({ message: 'motivo es obligatorio' })
  motivo!: string;

  @IsUUID('4', { message: 'usuarioId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'usuarioId es obligatorio' })
  usuarioId!: string;
}

export interface VentaResponseDto {
  id: string;
  sucursalId: string;
  dispositivoId: string;
  cajeroId: string;
  clienteId: string | null;
  subtotal: number;
  descuento: number;
  total: number;
  metodoPago: string;
  estado: string;
  fechaHoraDispositivo: Date;
  fechaHoraServidor: Date;
  sincronizada: boolean;
  detalles: {
    productoId: string;
    cantidad: number;
    precioUnitario: number;
    subtotalLinea: number;
    pesoBruto?: number | null;
    pesoNeto?: number | null;
  }[];
  pagos: {
    metodo: string;
    monto: number;
    referenciaTransaccion?: string | null;
  }[];
  saldoFaltante?: number;
}
