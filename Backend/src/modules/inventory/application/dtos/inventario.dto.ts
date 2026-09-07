import { IsUUID, IsNumber, Min } from 'class-validator';

export class UpdateStockMinimoDto {
  @IsUUID('4', { message: 'El producto_id debe ser un UUID válido' })
  producto_id!: string;

  @IsUUID('4', { message: 'El sucursal_id debe ser un UUID válido' })
  sucursal_id!: string;

  @IsNumber({}, { message: 'La cantidad_minima_alerta debe ser un número' })
  @Min(0, { message: 'La cantidad_minima_alerta no puede ser negativa' })
  cantidad_minima_alerta!: number;
}

export interface AlertaStockDto {
  producto_id: string;
  nombre?: string;
  sucursal_id: string;
  stock_actual: number;
  stock_minimo: number;
  estado_alerta: 'critico' | 'bajo';
}
