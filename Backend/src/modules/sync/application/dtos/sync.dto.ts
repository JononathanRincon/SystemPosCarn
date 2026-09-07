import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateVentaDto } from '../../../sales/application/dtos/venta.dto';

export class SyncSaleItemDto extends CreateVentaDto {}

export class SyncSalesBatchDto {
  @IsString({ message: 'dispositivoId debe ser un texto' })
  @IsNotEmpty({ message: 'dispositivoId es obligatorio' })
  dispositivoId!: string;

  @IsArray({ message: 'ventas debe ser una lista de ventas offline' })
  @ValidateNested({ each: true })
  @Type(() => SyncSaleItemDto)
  ventas!: SyncSaleItemDto[];
}

export interface SyncResponseDto {
  procesadas: number;
  duplicadasIgnoradas: number;
  errores: string[];
}
