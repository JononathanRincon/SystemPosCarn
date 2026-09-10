'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Check,
  X,
  AlertCircle,
  Scale,
  Hash,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api/api-client';

export interface ProductoAdmin {
  id: string;
  negocioId: string;
  categoriaId: string;
  nombre: string;
  codigoBarras: string | null;
  tipoVenta: 'peso' | 'unidad';
  unidadMedida: 'kg' | 'g' | 'unidad';
  precio: number;
  costoPromedio: number;
  fotoUrl: string | null;
  activo: boolean;
}

const CATEGORIAS_MOCK = [
  { id: 'todas', nombre: 'Todas las Categorías' },
  { id: 'res', nombre: 'Res' },
  { id: 'cerdo', nombre: 'Cerdo' },
  { id: 'pollo', nombre: 'Pollo' },
  { id: 'embutidos', nombre: 'Embutidos' },
  { id: 'abarrotes', nombre: 'Abarrotes' },
];

const PRODUCTOS_INICIALES: ProductoAdmin[] = [
  {
    id: 'prod-01',
    negocioId: 'neg-1',
    categoriaId: 'res',
    nombre: 'Lomo Fino de Res',
    codigoBarras: '770123450001',
    tipoVenta: 'peso',
    unidadMedida: 'kg',
    precio: 45000,
    costoPromedio: 32000,
    fotoUrl: null,
    activo: true,
  },
  {
    id: 'prod-02',
    negocioId: 'neg-1',
    categoriaId: 'res',
    nombre: 'Costilla de Res Especial',
    codigoBarras: '770123450002',
    tipoVenta: 'peso',
    unidadMedida: 'kg',
    precio: 24000,
    costoPromedio: 16000,
    fotoUrl: null,
    activo: true,
  },
  {
    id: 'prod-03',
    negocioId: 'neg-1',
    categoriaId: 'cerdo',
    nombre: 'Punta de Anca de Cerdo',
    codigoBarras: '770123450003',
    tipoVenta: 'peso',
    unidadMedida: 'kg',
    precio: 28000,
    costoPromedio: 19500,
    fotoUrl: null,
    activo: true,
  },
  {
    id: 'prod-04',
    negocioId: 'neg-1',
    categoriaId: 'pollo',
    nombre: 'Pechuga Campesina',
    codigoBarras: '770123450004',
    tipoVenta: 'peso',
    unidadMedida: 'kg',
    precio: 18500,
    costoPromedio: 13000,
    fotoUrl: null,
    activo: true,
  },
  {
    id: 'prod-05',
    negocioId: 'neg-1',
    categoriaId: 'embutidos',
    nombre: 'Chorizo Santarrosano (Paquete x6)',
    codigoBarras: '770123450005',
    tipoVenta: 'unidad',
    unidadMedida: 'unidad',
    precio: 16000,
    costoPromedio: 11000,
    fotoUrl: null,
    activo: true,
  },
];

export default function CatalogoPage() {
  const [productos, setProductos] = useState<ProductoAdmin[]>(PRODUCTOS_INICIALES);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState<string>('');
  const [cargando, setCargando] = useState<boolean>(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  // Estado para edición rápida de precio
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nuevoPrecio, setNuevoPrecio] = useState<string>('');

  // Estado para modal de nuevo producto
  const [modalAbierto, setModalAbierto] = useState<boolean>(false);
  const [formNuevo, setFormNuevo] = useState({
    nombre: '',
    categoriaId: 'res',
    tipoVenta: 'peso' as 'peso' | 'unidad',
    unidadMedida: 'kg' as 'kg' | 'unidad',
    precio: '',
    costoPromedio: '',
    codigoBarras: '',
  });

  const cargarProductos = async () => {
    setCargando(true);
    try {
      const data = await apiClient.get<ProductoAdmin[]>('/products');
      if (Array.isArray(data) && data.length > 0) {
        setProductos(data);
      }
    } catch {
      // Modo offline/resiliente: mantiene catálogo inicial
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, []);

  const handleGuardarPrecio = async (id: string) => {
    const precioNumerico = parseFloat(nuevoPrecio);
    if (isNaN(precioNumerico) || precioNumerico <= 0) {
      setMensaje({ tipo: 'error', texto: 'El precio debe ser un número mayor a 0' });
      return;
    }

    try {
      await apiClient.patch(`/products/${id}/price`, { precio: precioNumerico });
      setProductos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, precio: precioNumerico } : p))
      );
      setMensaje({ tipo: 'exito', texto: 'Precio actualizado y sincronizado exitosamente' });
    } catch {
      // Actualización local resiliente
      setProductos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, precio: precioNumerico } : p))
      );
      setMensaje({ tipo: 'exito', texto: 'Precio actualizado localmente' });
    } finally {
      setEditandoId(null);
      setNuevoPrecio('');
      setTimeout(() => setMensaje(null), 3500);
    }
  };

  const handleCrearProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNuevo.nombre.trim() || !formNuevo.precio) {
      setMensaje({ tipo: 'error', texto: 'Nombre y precio son obligatorios' });
      return;
    }

    const nuevo: ProductoAdmin = {
      id: `prod-${Date.now()}`,
      negocioId: 'neg-1',
      categoriaId: formNuevo.categoriaId,
      nombre: formNuevo.nombre.trim(),
      codigoBarras: formNuevo.codigoBarras.trim() || null,
      tipoVenta: formNuevo.tipoVenta,
      unidadMedida: formNuevo.tipoVenta === 'peso' ? 'kg' : 'unidad',
      precio: parseFloat(formNuevo.precio),
      costoPromedio: parseFloat(formNuevo.costoPromedio) || 0,
      fotoUrl: null,
      activo: true,
    };

    try {
      await apiClient.post('/products', nuevo);
      setProductos((prev) => [nuevo, ...prev]);
      setMensaje({ tipo: 'exito', texto: `Producto ${nuevo.nombre} creado con éxito` });
    } catch {
      setProductos((prev) => [nuevo, ...prev]);
      setMensaje({ tipo: 'exito', texto: `Producto ${nuevo.nombre} agregado localmente` });
    } finally {
      setModalAbierto(false);
      setFormNuevo({
        nombre: '',
        categoriaId: 'res',
        tipoVenta: 'peso',
        unidadMedida: 'kg',
        precio: '',
        costoPromedio: '',
        codigoBarras: '',
      });
      setTimeout(() => setMensaje(null), 3500);
    }
  };

  const productosFiltrados = productos.filter((p) => {
    const coincideCategoria =
      categoriaSeleccionada === 'todas' || p.categoriaId === categoriaSeleccionada;
    const coincideBusqueda =
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.codigoBarras && p.codigoBarras.includes(busqueda));
    return coincideCategoria && coincideBusqueda;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-neutro-200">
        <div>
          <h1 className="text-2xl font-bold text-neutro-900 flex items-center gap-2">
            <Package className="text-carmin-500" />
            Catálogo y Listas de Precios
          </h1>
          <p className="text-sm text-neutro-500 mt-1">
            Gestión de cortes cárnicos, precios por kilogramo o unidad y distribución a cajas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={cargarProductos}
            disabled={cargando}
            className="p-2.5 rounded-xl border border-neutro-300 text-neutro-700 hover:bg-neutro-50 transition-colors"
            title="Recargar catálogo"
          >
            <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setModalAbierto(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-carmin-600 hover:bg-carmin-700 text-white font-medium rounded-xl shadow transition-colors"
          >
            <Plus size={18} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Alertas */}
      {mensaje && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            mensaje.tipo === 'exito'
              ? 'bg-verde-50 text-verde-800 border border-verde-200'
              : 'bg-carmin-50 text-carmin-800 border border-carmin-200'
          }`}
        >
          <AlertCircle size={20} />
          <span className="text-sm font-medium">{mensaje.texto}</span>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-neutro-200 shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-80 relative">
          <Search size={18} className="absolute left-3 text-neutro-400" />
          <input
            type="text"
            placeholder="Buscar corte o código de barras..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-neutro-300 text-sm focus:outline-none focus:ring-2 focus:ring-carmin-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {CATEGORIAS_MOCK.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoriaSeleccionada(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                categoriaSeleccionada === cat.id
                  ? 'bg-carmin-600 text-white'
                  : 'bg-neutro-100 text-neutro-600 hover:bg-neutro-200'
              }`}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="bg-white rounded-2xl border border-neutro-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutro-50 border-b border-neutro-200 text-xs font-semibold text-neutro-600 uppercase tracking-wider">
                <th className="p-4">Producto Cárnico</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Tipo de Venta</th>
                <th className="p-4">Costo Base</th>
                <th className="p-4">Precio de Venta</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutro-100 text-sm">
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutro-400">
                    No se encontraron productos en esta categoría o búsqueda
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((prod) => (
                  <tr key={prod.id} className="hover:bg-neutro-50 transition-colors">
                    <td className="p-4 font-medium text-neutro-900">
                      <div>{prod.nombre}</div>
                      {prod.codigoBarras && (
                        <span className="text-xs text-neutro-400 flex items-center gap-1 mt-0.5">
                          <Hash size={12} />
                          {prod.codigoBarras}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-neutro-600 capitalize">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutro-100 text-xs font-medium">
                        <Tag size={12} />
                        {prod.categoriaId}
                      </span>
                    </td>
                    <td className="p-4">
                      {prod.tipoVenta === 'peso' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          <Scale size={13} />
                          Por Peso ({prod.unidadMedida})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                          <Package size={13} />
                          Por Unidad
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-neutro-500">
                      ${prod.costoPromedio.toLocaleString()}
                    </td>
                    <td className="p-4">
                      {editandoId === prod.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={nuevoPrecio}
                            onChange={(e) => setNuevoPrecio(e.target.value)}
                            className="w-24 px-2 py-1 border border-carmin-400 rounded text-sm focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleGuardarPrecio(prod.id)}
                            className="p-1 text-verde-600 hover:bg-verde-50 rounded"
                            title="Guardar"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditandoId(null)}
                            className="p-1 text-neutro-400 hover:bg-neutro-100 rounded"
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-bold text-neutro-900">
                          ${prod.precio.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-neutro-400">
                            /{prod.unidadMedida}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          prod.activo ? 'bg-verde-500' : 'bg-neutro-300'
                        }`}
                        title={prod.activo ? 'Activo' : 'Inactivo'}
                      />
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          setEditandoId(prod.id);
                          setNuevoPrecio(prod.precio.toString());
                        }}
                        className="p-1.5 text-neutro-500 hover:text-carmin-600 hover:bg-neutro-100 rounded-lg transition-colors"
                        title="Modificar precio"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Producto */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-neutro-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutro-100">
              <h3 className="text-lg font-bold text-neutro-900 flex items-center gap-2">
                <Plus className="text-carmin-500" />
                Registrar Nuevo Producto Cárnico
              </h3>
              <button
                onClick={() => setModalAbierto(false)}
                className="p-1 rounded-lg text-neutro-400 hover:bg-neutro-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCrearProducto} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutro-700 uppercase mb-1">
                  Nombre del Corte / Producto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pecho de Res, Tocino Ahumado"
                  value={formNuevo.nombre}
                  onChange={(e) => setFormNuevo({ ...formNuevo, nombre: e.target.value })}
                  className="w-full px-3.5 py-2 border border-neutro-300 rounded-xl text-sm focus:ring-2 focus:ring-carmin-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutro-700 uppercase mb-1">
                    Categoría *
                  </label>
                  <select
                    value={formNuevo.categoriaId}
                    onChange={(e) => setFormNuevo({ ...formNuevo, categoriaId: e.target.value })}
                    className="w-full px-3.5 py-2 border border-neutro-300 rounded-xl text-sm focus:ring-2 focus:ring-carmin-500 focus:outline-none"
                  >
                    <option value="res">Res</option>
                    <option value="cerdo">Cerdo</option>
                    <option value="pollo">Pollo</option>
                    <option value="embutidos">Embutidos</option>
                    <option value="abarrotes">Abarrotes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutro-700 uppercase mb-1">
                    Tipo de Venta *
                  </label>
                  <select
                    value={formNuevo.tipoVenta}
                    onChange={(e) =>
                      setFormNuevo({
                        ...formNuevo,
                        tipoVenta: e.target.value as 'peso' | 'unidad',
                      })
                    }
                    className="w-full px-3.5 py-2 border border-neutro-300 rounded-xl text-sm focus:ring-2 focus:ring-carmin-500 focus:outline-none"
                  >
                    <option value="peso">Por Peso (Báscula kg)</option>
                    <option value="unidad">Por Unidad Empacada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutro-700 uppercase mb-1">
                    Precio Venta ($ COP) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ej. 32000"
                    value={formNuevo.precio}
                    onChange={(e) => setFormNuevo({ ...formNuevo, precio: e.target.value })}
                    className="w-full px-3.5 py-2 border border-neutro-300 rounded-xl text-sm focus:ring-2 focus:ring-carmin-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutro-700 uppercase mb-1">
                    Costo Promedio ($ COP)
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 24000"
                    value={formNuevo.costoPromedio}
                    onChange={(e) => setFormNuevo({ ...formNuevo, costoPromedio: e.target.value })}
                    className="w-full px-3.5 py-2 border border-neutro-300 rounded-xl text-sm focus:ring-2 focus:ring-carmin-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutro-700 uppercase mb-1">
                  Código de Barras (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Escanee o ingrese código EAN"
                  value={formNuevo.codigoBarras}
                  onChange={(e) => setFormNuevo({ ...formNuevo, codigoBarras: e.target.value })}
                  className="w-full px-3.5 py-2 border border-neutro-300 rounded-xl text-sm focus:ring-2 focus:ring-carmin-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-neutro-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 text-sm text-neutro-600 hover:bg-neutro-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-carmin-600 hover:bg-carmin-700 text-white font-medium rounded-xl shadow transition-colors"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
