import { Model, Relation, Query } from '@nozbe/watermelondb';
import { field, text, relation, children } from '@nozbe/watermelondb/decorators';
import type { Categoria } from './Categoria';
import type { Lote } from './Lote';

export class Producto extends Model {
  static table = 'productos';
  static associations = {
    categorias: { type: 'belongs_to', key: 'categoria_id' },
    lotes: { type: 'has_many', foreignKey: 'producto_id' },
  } as const;

  @field('negocio_id') negocioId!: string;
  @field('categoria_id') categoriaId!: string;
  @text('nombre') nombre!: string;
  @field('codigo_barras') codigoBarras?: string | null;
  @field('tipo_venta') tipoVenta!: 'peso' | 'unidad';
  @field('unidad_medida') unidadMedida!: 'kg' | 'g' | 'unidad';
  @field('precio') precio!: number;
  @field('costo_promedio') costoPromedio?: number | null;
  @field('foto_url') fotoUrl?: string | null;
  @field('activo') activo!: boolean;

  @relation('categorias', 'categoria_id') categoria!: Relation<Categoria>;
  @children('lotes') lotes!: Query<Lote>;
}
