import { Model, Query } from '@nozbe/watermelondb';
import { field, text, children } from '@nozbe/watermelondb/decorators';
import type { Producto } from './Producto';

export class Categoria extends Model {
  static table = 'categorias';
  static associations = {
    productos: { type: 'has_many', foreignKey: 'categoria_id' },
  } as const;

  @field('negocio_id') negocioId?: string | null;
  @text('nombre') nombre!: string;
  @field('orden_visualizacion') ordenVisualizacion!: number;

  @children('productos') productos!: Query<Producto>;
}
