import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'productos',
      columns: [
        { name: 'negocio_id', type: 'string' },
        { name: 'categoria_id', type: 'string', isIndexed: true },
        { name: 'nombre', type: 'string' },
        { name: 'codigo_barras', type: 'string', isOptional: true },
        { name: 'tipo_venta', type: 'string' }, // 'peso' | 'unidad'
        { name: 'unidad_medida', type: 'string' }, // 'kg' | 'g' | 'unidad'
        { name: 'precio', type: 'number' },
        { name: 'costo_promedio', type: 'number', isOptional: true },
        { name: 'foto_url', type: 'string', isOptional: true },
        { name: 'activo', type: 'boolean' },
      ],
    }),
    tableSchema({
      name: 'categorias',
      columns: [
        { name: 'negocio_id', type: 'string', isOptional: true },
        { name: 'nombre', type: 'string' },
        { name: 'orden_visualizacion', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'lotes',
      columns: [
        { name: 'producto_id', type: 'string', isIndexed: true },
        { name: 'sucursal_id', type: 'string' },
        { name: 'recepcion_id', type: 'string', isOptional: true },
        { name: 'codigo_lote', type: 'string' },
        { name: 'proveedor', type: 'string', isOptional: true },
        { name: 'cantidad_recibida', type: 'number', isOptional: true },
        { name: 'cantidad_disponible', type: 'number' },
        { name: 'costo_unitario', type: 'number', isOptional: true },
        { name: 'fecha_recepcion', type: 'number', isOptional: true }, // timestamp ms
        { name: 'fecha_vencimiento', type: 'number', isOptional: true }, // timestamp ms
        { name: 'temperatura_recepcion', type: 'number', isOptional: true },
        { name: 'estado', type: 'string' }, // 'activo' | 'agotado' | 'vencido' | 'retirado'
        { name: 'notas', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'ventas_outbox',
      columns: [
        { name: 'payload', type: 'string' }, // Serialized JSON matching CreateVentaDto
        { name: 'status', type: 'string', isIndexed: true }, // 'pending' | 'synced' | 'error'
        { name: 'created_at', type: 'number' }, // timestamp ms
        { name: 'synced_at', type: 'number', isOptional: true }, // timestamp ms
        { name: 'error_message', type: 'string', isOptional: true },
        { name: 'retry_count', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'turnos',
      columns: [
        { name: 'sucursal_id', type: 'string', isOptional: true },
        { name: 'dispositivo_id', type: 'string', isOptional: true },
        { name: 'usuario_id', type: 'string' },
        { name: 'estado', type: 'string' }, // 'abierta' | 'cerrada'
        { name: 'monto_apertura', type: 'number' },
        { name: 'fecha_apertura', type: 'number' }, // timestamp ms
        { name: 'fecha_cierre', type: 'number', isOptional: true }, // timestamp ms
        { name: 'total_efectivo_esperado', type: 'number', isOptional: true },
        { name: 'total_efectivo_contado', type: 'number', isOptional: true },
        { name: 'diferencia', type: 'number', isOptional: true },
      ],
    }),
  ],
});

export default schema;
