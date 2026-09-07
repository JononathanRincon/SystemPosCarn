import { getDB } from '@/lib/db/pos-database';
import type { POSDatabase, ProductoLocal, CategoriaLocal } from '@/lib/db/pos-database';

/**
 * Repositorio de operaciones de catálogo local (productos y categorías).
 * Provee inserción en lote y consultas reactivas para el grid táctil del POS.
 */

/**
 * Guarda o actualiza el catálogo local completo recibido desde el backend
 * vía /catalog/sync. Usa bulkPut para upsert atómico.
 *
 * @param productos - Array de productos sincronizados.
 * @param categorias - Array de categorías sincronizadas.
 * @param dbOverride - Instancia de BD opcional (para testing).
 */
export async function guardarCatalogoLocal(
  productos: ProductoLocal[],
  categorias: CategoriaLocal[],
  dbOverride?: POSDatabase
): Promise<void> {
  const db = dbOverride ?? getDB();

  await db.transaction('rw', [db.productos, db.categorias], async () => {
    await db.categorias.bulkPut(categorias);
    await db.productos.bulkPut(productos);
  });
}

/**
 * Obtiene productos locales, opcionalmente filtrados por categoría.
 * Solo devuelve productos activos, ordenados por nombre.
 *
 * @param categoriaId - ID de categoría para filtrar. Si es undefined, devuelve todos.
 * @param dbOverride - Instancia de BD opcional (para testing).
 * @returns Promise con array de productos activos.
 */
export async function obtenerProductosLocales(
  categoriaId?: string,
  dbOverride?: POSDatabase
): Promise<ProductoLocal[]> {
  const db = dbOverride ?? getDB();

  if (categoriaId) {
    const all = await db.productos
      .where('categoriaId')
      .equals(categoriaId)
      .toArray();
    return all
      .filter((p) => p.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  const all = await db.productos.toArray();
  return all
    .filter((p) => p.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Obtiene todas las categorías ordenadas por su campo de visualización.
 *
 * @param dbOverride - Instancia de BD opcional (para testing).
 */
export async function obtenerCategoriasLocales(
  dbOverride?: POSDatabase
): Promise<CategoriaLocal[]> {
  const db = dbOverride ?? getDB();
  return db.categorias.orderBy('ordenVisualizacion').toArray();
}
