import { IsUUID, IsString, IsOptional, IsEnum } from 'class-validator';
import { EstadoLote } from '../../domain/entities/lote.entity';

export class QueryLotesDto {
  @IsUUID('4', { message: 'El sucursal_id debe ser un UUID válido' })
  sucursal_id!: string;

  @IsOptional()
  @IsUUID('4', { message: 'El producto_id debe ser un UUID válido' })
  producto_id?: string;

  @IsOptional()
  @IsEnum(['activo', 'agotado', 'vencido', 'retirado'], {
    message: 'El estado debe ser: activo, agotado, vencido o retirado',
  })
  estado?: EstadoLote;
}

export interface LoteDetalleDto {
  id: string;
  producto_id: string;
  sucursal_id: string;
  recepcion_id: string | null;
  codigo_lote: string;
  proveedor: string;
  cantidad_recibida: number;
  cantidad_disponible: number;
  costo_unitario: number;
  fecha_recepcion: string;
  fecha_vencimiento: string | null;
  dias_para_vencer: number | null;
  temperatura_recepcion: number | null;
  estado: EstadoLote;
  alerta_cadena_frio: boolean;
  proximo_a_vencer: boolean;
}
