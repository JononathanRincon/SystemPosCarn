import { Database } from '@nozbe/watermelondb';
import { getDatabase } from '../database';
import { getApiBaseUrl } from '../config/api';
import { AuthService } from './AuthService';
import { Categoria } from '../database/models/Categoria';
import { Producto } from '../database/models/Producto';

export interface CatalogSyncReport {
  success: boolean;
  categoriasActualizadas: number;
  productosActualizados: number;
  error?: string;
}

export class CatalogSync {
  /**
   * Descarga el catálogo maestro inicial (productos y categorías) desde el Backend NestJS
   * y los almacena / actualiza en WatermelonDB (SQLite local) para soporte 100% offline.
   */
  public static async descargarCatalogoInicial(
    dbOverride?: Database,
    fetchFn: typeof fetch = fetch
  ): Promise<CatalogSyncReport> {
    const db = dbOverride || getDatabase();
    const baseUrl = getApiBaseUrl();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = AuthService.getSessionToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // 1. Descarga concurrente de productos y categorías
      const [prodsRes, catsRes] = await Promise.all([
        fetchFn(`${baseUrl}/catalog/products`, { headers }),
        fetchFn(`${baseUrl}/catalog/categories`, { headers }),
      ]);

      const prodsData = prodsRes.ok ? await prodsRes.json() : [];
      const catsData = catsRes.ok ? await catsRes.json() : [];

      const listaProductos: any[] = Array.isArray(prodsData)
        ? prodsData
        : prodsData?.items || prodsData?.data || [];
      const listaCategorias: any[] = Array.isArray(catsData)
        ? catsData
        : catsData?.items || catsData?.data || [];

      // 2. Persistencia atómica en WatermelonDB
      await db.write(async () => {
        const catCollection = db.get<Categoria>('categorias');
        const prodCollection = db.get<Producto>('productos');

        // Upsert Categorías
        for (const cat of listaCategorias) {
          const catId = cat.id || `cat-${Math.random().toString(36).slice(2, 7)}`;
          try {
            const existing = await catCollection.find(catId);
            await existing.update((c) => {
              c.nombre = cat.nombre || c.nombre;
              c.ordenVisualizacion = cat.ordenVisualizacion ?? cat.orden_visualizacion ?? c.ordenVisualizacion;
              c.negocioId = cat.negocioId || cat.negocio_id || c.negocioId;
            });
          } catch {
            await catCollection.create((c) => {
              c._raw.id = catId;
              c.nombre = cat.nombre || 'Sin categoría';
              c.ordenVisualizacion = cat.ordenVisualizacion ?? cat.orden_visualizacion ?? 1;
              c.negocioId = cat.negocioId || cat.negocio_id || 'neg-default';
            });
          }
        }

        // Upsert Productos
        for (const prod of listaProductos) {
          const prodId = prod.id || `prod-${Math.random().toString(36).slice(2, 7)}`;
          try {
            const existing = await prodCollection.find(prodId);
            await existing.update((p) => {
              p.nombre = prod.nombre || p.nombre;
              p.precio = Number(prod.precio ?? p.precio);
              p.tipoVenta = prod.tipoVenta || prod.tipo_venta || p.tipoVenta;
              p.unidadMedida = prod.unidadMedida || prod.unidad_medida || p.unidadMedida;
              p.activo = prod.activo !== undefined ? Boolean(prod.activo) : p.activo;
              p.categoriaId = prod.categoriaId || prod.categoria_id || p.categoriaId;
            });
          } catch {
            await prodCollection.create((p) => {
              p._raw.id = prodId;
              p.nombre = prod.nombre || 'Producto';
              p.precio = Number(prod.precio ?? 0);
              p.tipoVenta = prod.tipoVenta || prod.tipo_venta || 'peso';
              p.unidadMedida = prod.unidadMedida || prod.unidad_medida || 'kg';
              p.activo = prod.activo !== undefined ? Boolean(prod.activo) : true;
              p.categoriaId = prod.categoriaId || prod.categoria_id || 'cat-general';
              p.negocioId = prod.negocioId || prod.negocio_id || 'neg-default';
            });
          }
        }
      });

      return {
        success: true,
        categoriasActualizadas: listaCategorias.length,
        productosActualizados: listaProductos.length,
      };
    } catch (err: any) {
      return {
        success: false,
        categoriasActualizadas: 0,
        productosActualizados: 0,
        error: err?.message || 'Error descargando catálogo del servidor',
      };
    }
  }
}
