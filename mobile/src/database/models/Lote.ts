import { Model, Relation } from '@nozbe/watermelondb';
import { field, text, date, relation } from '@nozbe/watermelondb/decorators';
import type { Producto } from './Producto';

export class Lote extends Model {
  static table = 'lotes';
  static associations = {
    productos: { type: 'belongs_to', key: 'producto_id' },
  } as const;

  @field('producto_id') productoId!: string;
  @field('sucursal_id') sucursalId!: string;
  @field('recepcion_id') recepcionId?: string | null;
  @text('codigo_lote') codigoLote!: string;
  @field('proveedor') proveedor?: string | null;
  @field('cantidad_recibida') cantidadRecibida?: number | null;
  @field('cantidad_disponible') cantidadDisponible!: number;
  @field('costo_unitario') costoUnitario?: number | null;
  @date('fecha_recepcion') fechaRecepcion?: Date | null;
  @date('fecha_vencimiento') fechaVencimiento?: Date | null;
  @field('temperatura_recepcion') temperaturaRecepcion?: number | null;
  @field('estado') estado!: 'activo' | 'agotado' | 'vencido' | 'retirado';
  @field('notas') notas?: string | null;

  @relation('productos', 'producto_id') producto!: Relation<Producto>;
}
