'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  Trash2,
  AlertCircle,
  Plus,
  Minus,
  Check,
  Flame,
  Utensils,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ProductoLocal, CategoriaLocal } from '@/lib/db/pos-database';
import {
  obtenerCategoriasLocales,
  obtenerProductosLocales,
  guardarCatalogoLocal,
} from '@/lib/db/repos/catalogo-repo';
import {
  CartItem,
  agregarAlCarrito,
  eliminarDelCarrito,
  actualizarCantidadCarrito,
  calcularTotalCarrito,
} from '@/lib/pos/pos-cart';
import { IndicadorBascula } from '@/components/pos/IndicadorBascula';
import { ModalCobro } from '@/components/pos/cobro/ModalCobro';
import { useScale } from '@/lib/hardware/use-scale';

// Catálogo maestro inicial de carnicería si la terminal aún no ha sincronizado
const CATALOGO_SEMILLA_CATEGORIAS: CategoriaLocal[] = [
  { id: 'cat-res', nombre: 'Res', ordenVisualizacion: 1 },
  { id: 'cat-cerdo', nombre: 'Cerdo', ordenVisualizacion: 2 },
  { id: 'cat-pollo', nombre: 'Pollo', ordenVisualizacion: 3 },
  { id: 'cat-visceras', nombre: 'Vísceras', ordenVisualizacion: 4 },
  { id: 'cat-embutidos', nombre: 'Embutidos', ordenVisualizacion: 5 },
  { id: 'cat-abarrotes', nombre: 'Abarrotes', ordenVisualizacion: 6 },
];

const CATALOGO_SEMILLA_PRODUCTOS: ProductoLocal[] = [
  // Res
  { id: 'res-1', negocioId: 'neg-1', categoriaId: 'cat-res', nombre: 'Bistec de Res Especial', tipoVenta: 'peso', precio: 195.0, unidadMedida: 'kg', activo: true },
  { id: 'res-2', negocioId: 'neg-1', categoriaId: 'cat-res', nombre: 'Arrachera Marinada', tipoVenta: 'peso', precio: 260.0, unidadMedida: 'kg', activo: true },
  { id: 'res-3', negocioId: 'neg-1', categoriaId: 'cat-res', nombre: 'Carne Molida de Res 90/10', tipoVenta: 'peso', precio: 165.0, unidadMedida: 'kg', activo: true },
  { id: 'res-4', negocioId: 'neg-1', categoriaId: 'cat-res', nombre: 'Costilla de Res para Asar', tipoVenta: 'peso', precio: 145.0, unidadMedida: 'kg', activo: true },
  { id: 'res-5', negocioId: 'neg-1', categoriaId: 'cat-res', nombre: 'T-Bone Steak Premium', tipoVenta: 'peso', precio: 280.0, unidadMedida: 'kg', activo: true },
  { id: 'res-6', negocioId: 'neg-1', categoriaId: 'cat-res', nombre: 'Chambarete de Res', tipoVenta: 'peso', precio: 130.0, unidadMedida: 'kg', activo: true },

  // Cerdo
  { id: 'cerdo-1', negocioId: 'neg-1', categoriaId: 'cat-cerdo', nombre: 'Chuleta de Cerdo Ahumada', tipoVenta: 'peso', precio: 125.0, unidadMedida: 'kg', activo: true },
  { id: 'cerdo-2', negocioId: 'neg-1', categoriaId: 'cat-cerdo', nombre: 'Lomo de Cerdo Fresco', tipoVenta: 'peso', precio: 135.0, unidadMedida: 'kg', activo: true },
  { id: 'cerdo-3', negocioId: 'neg-1', categoriaId: 'cat-cerdo', nombre: 'Costilla de Cerdo BBQ', tipoVenta: 'peso', precio: 140.0, unidadMedida: 'kg', activo: true },
  { id: 'cerdo-4', negocioId: 'neg-1', categoriaId: 'cat-cerdo', nombre: 'Pernil de Cerdo', tipoVenta: 'peso', precio: 115.0, unidadMedida: 'kg', activo: true },

  // Pollo
  { id: 'pollo-1', negocioId: 'neg-1', categoriaId: 'cat-pollo', nombre: 'Pechuga de Pollo Fresca', tipoVenta: 'peso', precio: 110.0, unidadMedida: 'kg', activo: true },
  { id: 'pollo-2', negocioId: 'neg-1', categoriaId: 'cat-pollo', nombre: 'Pierna y Muslo de Pollo', tipoVenta: 'peso', precio: 65.0, unidadMedida: 'kg', activo: true },
  { id: 'pollo-3', negocioId: 'neg-1', categoriaId: 'cat-pollo', nombre: 'Alas de Pollo Especial', tipoVenta: 'peso', precio: 95.0, unidadMedida: 'kg', activo: true },
  { id: 'pollo-4', negocioId: 'neg-1', categoriaId: 'cat-pollo', nombre: 'Pollo Entero Limpio', tipoVenta: 'peso', precio: 58.0, unidadMedida: 'kg', activo: true },

  // Vísceras
  { id: 'visc-1', negocioId: 'neg-1', categoriaId: 'cat-visceras', nombre: 'Hígado de Res', tipoVenta: 'peso', precio: 60.0, unidadMedida: 'kg', activo: true },
  { id: 'visc-2', negocioId: 'neg-1', categoriaId: 'cat-visceras', nombre: 'Mondongo / Panza de Res', tipoVenta: 'peso', precio: 75.0, unidadMedida: 'kg', activo: true },
  { id: 'visc-3', negocioId: 'neg-1', categoriaId: 'cat-visceras', nombre: 'Pajarilla / Bazo', tipoVenta: 'peso', precio: 45.0, unidadMedida: 'kg', activo: true },

  // Embutidos
  { id: 'emb-1', negocioId: 'neg-1', categoriaId: 'cat-embutidos', nombre: 'Chorizo Santarrosano', tipoVenta: 'peso', precio: 150.0, unidadMedida: 'kg', activo: true },
  { id: 'emb-2', negocioId: 'neg-1', categoriaId: 'cat-embutidos', nombre: 'Longaniza Casera', tipoVenta: 'peso', precio: 130.0, unidadMedida: 'kg', activo: true },
  { id: 'emb-3', negocioId: 'neg-1', categoriaId: 'cat-embutidos', nombre: 'Morcilla Especial', tipoVenta: 'peso', precio: 90.0, unidadMedida: 'kg', activo: true },

  // Abarrotes (Por Unidad)
  { id: 'aba-1', negocioId: 'neg-1', categoriaId: 'cat-abarrotes', nombre: 'Bolsa de Carbón Vegetal 3kg', tipoVenta: 'unidad', precio: 25.0, unidadMedida: 'pieza', activo: true },
  { id: 'aba-2', negocioId: 'neg-1', categoriaId: 'cat-abarrotes', nombre: 'Sal Marina Gruesa Parrillera', tipoVenta: 'unidad', precio: 12.0, unidadMedida: 'pieza', activo: true },
  { id: 'aba-3', negocioId: 'neg-1', categoriaId: 'cat-abarrotes', nombre: 'Salsa BBQ Ahumada', tipoVenta: 'unidad', precio: 18.0, unidadMedida: 'pieza', activo: true },
];

export default function VentaPage() {
  const [categorias, setCategorias] = useState<CategoriaLocal[]>([]);
  const [productos, setProductos] = useState<ProductoLocal[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [alertaBascula, setAlertaBascula] = useState<string | null>(null);
  const [modalCobroAbierto, setModalCobroAbierto] = useState<boolean>(false);

  const { weightKg, getLatestWeight } = useScale();

  // 1. Cargar catálogo desde IndexedDB (con siembra automática si está vacío)
  useEffect(() => {
    async function initCatalogo() {
      try {
        let cats = await obtenerCategoriasLocales();
        let prods = await obtenerProductosLocales();

        if (cats.length === 0 || prods.length === 0) {
          // Sembrar datos iniciales en IndexedDB
          await guardarCatalogoLocal(CATALOGO_SEMILLA_PRODUCTOS, CATALOGO_SEMILLA_CATEGORIAS);
          cats = await obtenerCategoriasLocales();
          prods = await obtenerProductosLocales();
        }

        setCategorias(cats);
        setProductos(prods);
      } catch (err) {
        console.error('Error cargando catálogo local:', err);
        setCategorias(CATALOGO_SEMILLA_CATEGORIAS);
        setProductos(CATALOGO_SEMILLA_PRODUCTOS);
      }
    }
    initCatalogo();
  }, []);

  // 2. Filtrado memoizado de productos
  const productosFiltrados = useMemo(() => {
    return productos.filter((p) => {
      if (!p.activo) return false;
      if (categoriaSeleccionada !== 'todas' && p.categoriaId !== categoriaSeleccionada) {
        return false;
      }
      if (busqueda.trim() !== '') {
        const query = busqueda.toLowerCase();
        return (
          p.nombre.toLowerCase().includes(query) ||
          (p.codigoBarras && p.codigoBarras.includes(query))
        );
      }
      return true;
    });
  }, [productos, categoriaSeleccionada, busqueda]);

  // 3. Manejo de Selección de Producto en 3 Toques
  const handleSeleccionarProducto = useCallback(
    (producto: ProductoLocal) => {
      setAlertaBascula(null);

      if (producto.tipoVenta === 'peso') {
        const pesoActual = getLatestWeight();

        // Validar Casos Límite 1 y 2
        if (pesoActual <= 0) {
          setAlertaBascula(`Coloque el producto "${producto.nombre}" en la báscula para capturar el peso.`);
          return;
        }

        const { nuevoCart, error } = agregarAlCarrito(cart, producto, pesoActual);
        if (error) {
          setAlertaBascula(error);
          return;
        }
        setCart(nuevoCart);
      } else {
        // Producto por unidad
        const { nuevoCart } = agregarAlCarrito(cart, producto);
        setCart(nuevoCart);
      }
    },
    [cart, getLatestWeight]
  );

  // 4. Modificar cantidad o remover
  const handleEliminarItem = useCallback((id: string) => {
    setCart((prev) => eliminarDelCarrito(prev, id));
  }, []);

  const handleIncrementarCantidad = useCallback((item: CartItem) => {
    const delta = item.tipoVenta === 'peso' ? 0.25 : 1;
    setCart((prev) => actualizarCantidadCarrito(prev, item.id, item.cantidad + delta));
  }, []);

  const handleDecrementarCantidad = useCallback((item: CartItem) => {
    const delta = item.tipoVenta === 'peso' ? 0.25 : 1;
    setCart((prev) => actualizarCantidadCarrito(prev, item.id, item.cantidad - delta));
  }, []);

  const handleLimpiarComanda = useCallback(() => {
    if (cart.length > 0) {
      if (confirm('¿Desea vaciar la comanda actual?')) {
        setCart([]);
        setAlertaBascula(null);
      }
    }
  }, [cart.length]);

  const totalComanda = useMemo(() => calcularTotalCarrito(cart), [cart]);

  // 5. Atajos de teclado ergonómicos: F1-F6 categorías, Enter para cobrar, Esc para limpiar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalCobroAbierto) return; // Si el modal está abierto, él maneja sus atajos

      // F1 - F6 para cambiar categorías
      if (e.key === 'F1') {
        e.preventDefault();
        setCategoriaSeleccionada('todas');
      } else if (e.key === 'F2' && categorias[0]) {
        e.preventDefault();
        setCategoriaSeleccionada(categorias[0].id);
      } else if (e.key === 'F3' && categorias[1]) {
        e.preventDefault();
        setCategoriaSeleccionada(categorias[1].id);
      } else if (e.key === 'F4' && categorias[2]) {
        e.preventDefault();
        setCategoriaSeleccionada(categorias[2].id);
      } else if (e.key === 'F5' && categorias[3]) {
        e.preventDefault();
        setCategoriaSeleccionada(categorias[3].id);
      } else if (e.key === 'F6' && categorias[4]) {
        e.preventDefault();
        setCategoriaSeleccionada(categorias[4].id);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (cart.length > 0 && !modalCobroAbierto) {
          e.preventDefault();
          setModalCobroAbierto(true);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleLimpiarComanda();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [categorias, cart.length, modalCobroAbierto, handleLimpiarComanda]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutro-950 text-white select-none">
      {/* ─── BARRA SUPERIOR DE MOSTRADOR CON BÁSCULA EN VIVO ─── */}
      <header className="px-4 py-2 border-b border-neutro-800 bg-neutro-900/80 backdrop-blur-sm z-10">
        <IndicadorBascula />
      </header>

      {/* ─── CUERPO PRINCIPAL DEL POS ─── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* PANEL IZQUIERDO: GRID TÁCTIL DE PRODUCTOS (Flex-1) */}
        <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden bg-neutro-900/30">
          {/* Barra de Búsqueda y Filtro Rápido */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-neutro-400"
                size={20}
              />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar corte cárnico o escanear código de barras..."
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-neutro-900 border border-neutro-800 text-white placeholder-neutro-500 focus:outline-none focus:border-carmin-500 focus:ring-1 focus:ring-carmin-500 text-sm transition-all"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutro-400 hover:text-white px-2 py-1"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Selector de Categorías Ergonómico (Botones >= 48px con atajos F1-F6) */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setCategoriaSeleccionada('todas')}
              className={cn(
                'min-h-touch px-4 py-2 rounded-2xl font-bold text-sm whitespace-nowrap border transition-all active:scale-95 flex items-center gap-2',
                categoriaSeleccionada === 'todas'
                  ? 'bg-carmin-600 border-carmin-500 text-white shadow-lg'
                  : 'bg-neutro-900 border-neutro-800 text-neutro-300 hover:bg-neutro-800'
              )}
            >
              <span>Todas</span>
              <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-neutro-400">F1</span>
            </button>

            {categorias.map((cat, idx) => {
              const isSelected = categoriaSeleccionada === cat.id;
              const atajo = idx < 5 ? `F${idx + 2}` : null;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaSeleccionada(cat.id)}
                  className={cn(
                    'min-h-touch px-4 py-2 rounded-2xl font-bold text-sm whitespace-nowrap border transition-all active:scale-95 flex items-center gap-2',
                    isSelected
                      ? 'bg-carmin-600 border-carmin-500 text-white shadow-lg'
                      : 'bg-neutro-900 border-neutro-800 text-neutro-300 hover:bg-neutro-800'
                  )}
                >
                  <span>{cat.nombre}</span>
                  {atajo && (
                    <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-neutro-400">
                      {atajo}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Banner de Alerta de Báscula (Casos Límite 1 y 2) */}
          {alertaBascula && (
            <div className="mb-3 p-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-between text-sm animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-amber-400 shrink-0" />
                <span className="font-semibold">{alertaBascula}</span>
              </div>
              <button
                onClick={() => setAlertaBascula(null)}
                className="text-amber-400 hover:text-white text-xs px-2 py-1 font-bold"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Grid Táctil de Cortes Cárnicos */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto pr-1 pb-4">
            {productosFiltrados.map((prod) => {
              const esPeso = prod.tipoVenta === 'peso';
              return (
                <button
                  key={prod.id}
                  onClick={() => handleSeleccionarProducto(prod)}
                  className="product-card group relative flex flex-col justify-between p-3.5 rounded-2xl bg-neutro-900 border border-neutro-800 hover:border-carmin-500/80 hover:bg-neutro-850 active:scale-[0.97] transition-all text-left shadow-sm min-h-touch-lg"
                >
                  {/* Badge Kg vs Und */}
                  <div className="flex items-center justify-between w-full mb-2">
                    <span
                      className={cn(
                        'text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider',
                        esPeso
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      )}
                    >
                      {esPeso ? 'BÁSCULA (KG)' : 'UNIDAD'}
                    </span>
                    <span className="text-lg">🥩</span>
                  </div>

                  {/* Nombre del corte cárnico */}
                  <div className="my-auto py-1">
                    <h3 className="font-bold text-white text-sm sm:text-base leading-snug line-clamp-2">
                      {prod.nombre}
                    </h3>
                  </div>

                  {/* Precio Unitario Grande */}
                  <div className="mt-2 pt-2 border-t border-neutro-800/80 flex items-baseline justify-between w-full">
                    <div className="text-xs text-neutro-400">
                      Precio /{prod.unidadMedida || (esPeso ? 'kg' : 'und')}:
                    </div>
                    <div className="text-base sm:text-lg font-extrabold text-carmin-400 font-mono">
                      ${prod.precio.toFixed(2)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── PANEL DERECHO: COMANDA LATERAL EN TIEMPO REAL ─── */}
        <aside className="w-full lg:w-96 xl:w-[420px] flex flex-col bg-neutro-950 border-t lg:border-t-0 lg:border-l border-neutro-800 shadow-2xl h-[42vh] lg:h-full">
          {/* Cabecera de la Comanda */}
          <div className="px-5 py-3 border-b border-neutro-800 flex items-center justify-between bg-neutro-900/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-carmin-600/20 text-carmin-400 flex items-center justify-center">
                <ShoppingCart size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-none">Comanda Actual</h2>
                <span className="text-[11px] text-neutro-400">
                  {cart.length} {cart.length === 1 ? 'línea' : 'líneas'} registrada(s)
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={handleLimpiarComanda}
                title="Vaciar comanda (Esc)"
                className="px-2.5 py-1.5 rounded-lg bg-neutro-800 hover:bg-red-950 text-neutro-400 hover:text-red-400 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Trash2 size={14} />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          {/* Lista Reactiva de Ítems */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutro-500">
                <div className="w-16 h-16 rounded-2xl bg-neutro-900 border border-neutro-800 flex items-center justify-center text-3xl mb-3">
                  🛒
                </div>
                <p className="text-sm font-semibold text-neutro-400">Comanda vacía</p>
                <p className="text-xs text-neutro-500 mt-1 max-w-[220px]">
                  Coloque un corte en la báscula y tóquelo en la pantalla para agregarlo
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const esPeso = item.tipoVenta === 'peso';
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-neutro-900/90 border border-neutro-800 flex flex-col gap-1.5 animate-in fade-in slide-in-from-right-4 duration-150"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="font-bold text-sm text-white leading-tight">
                        {item.nombre}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-base font-extrabold text-white">
                          ${item.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutro-800/60 text-xs">
                      {/* Detalle de cantidad y precio congelado */}
                      <div className="text-neutro-400 font-mono">
                        {esPeso ? (
                          <span>
                            <strong className="text-amber-400">{item.cantidad.toFixed(3)} kg</strong> x ${item.precioUnitario.toFixed(2)}
                          </span>
                        ) : (
                          <span>
                            <strong className="text-blue-400">{item.cantidad} {item.unidadMedida}</strong> x ${item.precioUnitario.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Botones de control de cantidad o eliminar */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDecrementarCantidad(item)}
                          className="w-7 h-7 rounded-lg bg-neutro-800 hover:bg-neutro-700 active:scale-95 flex items-center justify-center text-neutro-300"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus size={14} />
                        </button>

                        <button
                          onClick={() => handleIncrementarCantidad(item)}
                          className="w-7 h-7 rounded-lg bg-neutro-800 hover:bg-neutro-700 active:scale-95 flex items-center justify-center text-neutro-300"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus size={14} />
                        </button>

                        <button
                          onClick={() => handleEliminarItem(item.id)}
                          className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-red-900/50 active:scale-95 flex items-center justify-center text-neutral-400 hover:text-red-400 ml-1"
                          aria-label="Eliminar ítem"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer de la Comanda: Gran Total y Botón de Cobro */}
          <div className="p-4 border-t border-neutro-800 bg-neutro-950 space-y-3">
            {/* Display Gran Total en fuente de alto impacto >= 48px */}
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-baseline justify-between shadow-inner">
              <div className="flex flex-col">
                <span className="text-xs font-black tracking-wider uppercase text-neutral-400">
                  Gran Total
                </span>
                <span className="text-[11px] text-neutral-500">
                  {cart.length} productos
                </span>
              </div>
              <div className="text-4xl sm:text-5xl font-mono font-extrabold text-white tracking-tight">
                ${totalComanda.toFixed(2)}
              </div>
            </div>

            {/* Botón Principal de Cobro (>= 64px de altura) */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setModalCobroAbierto(true)}
              className={cn(
                'w-full py-4 px-6 rounded-2xl font-extrabold text-xl sm:text-2xl min-h-touch-lg shadow-2xl flex items-center justify-between transition-all duration-150',
                cart.length > 0
                  ? 'bg-carmin-600 hover:bg-carmin-500 active:scale-[0.98] text-white cursor-pointer'
                  : 'bg-neutro-900 text-neutro-600 cursor-not-allowed border border-neutro-800'
              )}
            >
              <div className="flex items-center gap-3">
                <span>COBRAR</span>
                <span className="text-xs font-semibold bg-black/30 px-2 py-0.5 rounded-md text-neutral-300">
                  Enter / Espacio
                </span>
              </div>
              <ArrowRight size={28} />
            </button>
          </div>
        </aside>
      </div>

      {/* Modal de Cobro Multimétodo */}
      <ModalCobro
        isOpen={modalCobroAbierto}
        onClose={() => setModalCobroAbierto(false)}
        cart={cart}
        total={totalComanda}
        onVentaExitosa={() => {
          setCart([]);
          setAlertaBascula(null);
        }}
      />
    </div>
  );
}
