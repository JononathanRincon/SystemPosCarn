'use client';

import { ShoppingCart, Search, Scale } from 'lucide-react';

export default function VentaPage() {
  return (
    <div className="flex h-full">
      {/* Panel Izquierdo — Grid de Productos */}
      <div className="flex-1 flex flex-col bg-neutro-800 p-4">
        {/* Barra de búsqueda */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-neutro-400"
              size={22}
            />
            <input
              type="text"
              placeholder="Buscar producto o escanear código..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-neutro-700 text-white 
                         placeholder-neutro-400 border border-neutro-600
                         focus:outline-none focus:border-carmin-500 focus:ring-1 focus:ring-carmin-500
                         text-pos-sm"
            />
          </div>
          <button
            className="btn-pos bg-ambar-500 text-white hover:bg-ambar-600"
            aria-label="Leer báscula"
          >
            <Scale size={24} />
          </button>
        </div>

        {/* Tabs de Categorías */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {['Todas', 'Res', 'Cerdo', 'Pollo', 'Embutidos', 'Otros'].map(
            (cat) => (
              <button
                key={cat}
                className="px-4 py-2 rounded-xl bg-neutro-700 text-neutro-300 
                           hover:bg-carmin-500 hover:text-white
                           transition-colors text-sm font-medium whitespace-nowrap
                           min-h-touch"
              >
                {cat}
              </button>
            )
          )}
        </div>

        {/* Grid de Productos Placeholder */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto">
          {Array.from({ length: 8 }).map((_, i) => (
            <button
              key={i}
              className="product-card bg-neutro-700 border-neutro-600 
                         hover:border-carmin-400 text-white"
            >
              <div className="w-12 h-12 bg-neutro-600 rounded-xl mb-2 flex items-center justify-center text-2xl">
                🥩
              </div>
              <span className="text-sm font-medium text-neutro-300">
                Producto {i + 1}
              </span>
              <span className="text-pos-base font-bold text-carmin-400 mt-1">
                —
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Panel Derecho — Comanda */}
      <div className="w-80 lg:w-96 flex flex-col bg-neutro-900 border-l border-neutro-700">
        {/* Header Comanda */}
        <div className="flex items-center gap-3 p-4 border-b border-neutro-700">
          <ShoppingCart className="text-carmin-400" size={24} />
          <h2 className="text-lg font-bold text-white">Comanda</h2>
          <span className="ml-auto bg-carmin-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            0
          </span>
        </div>

        {/* Lista de Items — Vacío */}
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-neutro-500 text-center">
            Seleccione productos del catálogo para comenzar la venta
          </p>
        </div>

        {/* Footer — Totales y Cobrar */}
        <div className="p-4 border-t border-neutro-700 space-y-3">
          <div className="flex justify-between text-neutro-300">
            <span>Subtotal</span>
            <span className="font-medium">$0.00</span>
          </div>
          <div className="flex justify-between text-white text-pos-lg font-bold">
            <span>Total</span>
            <span>$0.00</span>
          </div>
          <button
            className="btn-pos-primary w-full text-pos-lg"
            disabled
          >
            Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}
