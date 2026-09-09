'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  Delete,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { CartItem, PagoVentaInput, validarPagosVenta, procesarVentaLocal } from '@/lib/pos/pos-cart';
import { TicketData, printTicketInBrowser } from '@/lib/hardware/escpos-printer';

interface ModalCobroProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  total: number;
  onVentaExitosa: () => void;
}

export function ModalCobro({
  isOpen,
  onClose,
  cart,
  total,
  onVentaExitosa,
}: ModalCobroProps) {
  const [metodoActual, setMetodoActual] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');
  const [montoInput, setMontoInput] = useState<string>('');
  const [pagos, setPagos] = useState<PagoVentaInput[]>([]);
  const [imprimirTicket, setImprimirTicket] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [ventaCompletada, setVentaCompletada] = useState<{
    ventaId: string;
    cambio: number;
    pagos: PagoVentaInput[];
  } | null>(null);

  // Inicializar con el total exacto cuando se abre
  useEffect(() => {
    if (isOpen) {
      setMetodoActual('efectivo');
      setMontoInput(total.toString());
      setPagos([]);
      setVentaCompletada(null);
      setIsProcessing(false);
    }
  }, [isOpen, total]);

  // Si no hay pagos agregados en la lista de pagos mixtos, considerar montoInput para el método actual
  const pagosEfectivos: PagoVentaInput[] =
    pagos.length > 0
      ? pagos
      : montoInput && parseFloat(montoInput) > 0
      ? [{ metodo: metodoActual, monto: parseFloat(montoInput) }]
      : [];

  const validacion = validarPagosVenta(total, pagosEfectivos);

  // Manejo de teclado numérico táctil
  const handleDigit = (digit: string) => {
    if (digit === '.' && montoInput.includes('.')) return;
    setMontoInput((prev) => (prev === '0' && digit !== '.' ? digit : prev + digit));
  };

  const handleDeleteDigit = () => {
    setMontoInput((prev) => prev.slice(0, -1) || '');
  };

  const handleClearMonto = () => {
    setMontoInput('');
  };

  const handleDenominacion = (valor: number) => {
    setMontoInput(valor.toString());
  };

  const handleAgregarPagoParcial = () => {
    const monto = parseFloat(montoInput);
    if (!monto || monto <= 0) return;

    setPagos((prev) => [...prev, { metodo: metodoActual, monto }]);
    const restante = Math.max(0, total - ([...pagos, { metodo: metodoActual, monto }].reduce((a, b) => a + b.monto, 0)));
    setMontoInput(restante > 0 ? restante.toString() : '');
  };

  const handleEliminarPagoParcial = (index: number) => {
    setPagos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirmarVenta = useCallback(async () => {
    if (!validacion.esValido || isProcessing) return;

    try {
      setIsProcessing(true);
      const resultado = await procesarVentaLocal({
        cart,
        pagos: pagosEfectivos,
        cajeroId: 'cajero-pos-01',
      });

      // Si solicitó impresión, generar ticket
      if (imprimirTicket) {
        const ticketData: TicketData = {
          negocioNombre: 'Carnicería El Buen Corte',
          negocioNit: '900.123.456-7',
          sucursalNombre: 'Sucursal Principal Mostrador',
          direccion: 'Av. Central # 14-25',
          telefono: '310 987 6543',
          ventaId: resultado.ventaId,
          fecha: new Date(),
          cajeroNombre: 'Cajero Mostrador 1',
          items: cart.map((i) => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            unidadMedida: i.unidadMedida,
            precioUnitario: i.precioUnitario,
            subtotal: i.subtotal,
          })),
          total,
          pagos: pagosEfectivos,
          cambio: resultado.cambio,
        };
        printTicketInBrowser(ticketData);
      }

      setVentaCompletada({
        ventaId: resultado.ventaId,
        cambio: resultado.cambio,
        pagos: pagosEfectivos,
      });

      // Notificar al padre y limpiar comanda
      onVentaExitosa();
    } catch (err) {
      alert(`Error al procesar cobro: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [validacion.esValido, isProcessing, cart, pagosEfectivos, total, imprimirTicket, onVentaExitosa]);

  // Atajos de teclado en el modal: Enter para confirmar, Esc para cerrar
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (ventaCompletada) {
          onClose();
        } else if (validacion.esValido) {
          handleConfirmarVenta();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, validacion.esValido, ventaCompletada, onClose, handleConfirmarVenta]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
      <div className="bg-neutro-900 border border-neutro-700 rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutro-800 bg-neutro-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-carmin-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              💰
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Cobro de Venta</h2>
              <p className="text-xs text-neutro-400">
                {cart.length} {cart.length === 1 ? 'producto' : 'productos'} en la comanda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-neutro-800 text-neutro-400 hover:text-white hover:bg-neutro-700 transition-colors"
            aria-label="Cerrar modal de cobro"
          >
            <X size={24} />
          </button>
        </div>

        {ventaCompletada ? (
          /* Pantalla de Venta Exitosa */
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-6 flex-1">
            <div className="w-24 h-24 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center">
              <CheckCircle2 size={64} />
            </div>

            <div>
              <h3 className="text-3xl font-extrabold text-white">¡Venta Exitosa!</h3>
              <p className="text-neutro-400 mt-1">Ticket #{ventaCompletada.ventaId.slice(0, 16)} guardado localmente</p>
            </div>

            <div className="bg-neutro-950 border border-neutro-800 p-6 rounded-2xl w-full max-w-md space-y-3">
              <div className="flex justify-between text-neutro-400 text-lg">
                <span>Total Cobrado:</span>
                <span className="font-bold text-white">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutro-400 text-lg">
                <span>Total Recibido:</span>
                <span className="font-bold text-white">${validacion.totalPagado.toFixed(2)}</span>
              </div>
              <div className="pt-2 border-t border-neutro-800 flex justify-between items-center text-emerald-400">
                <span className="text-xl font-bold">Cambio / Devuelta:</span>
                <span className="text-4xl font-extrabold tracking-tight">
                  ${ventaCompletada.cambio.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="btn-pos-primary w-full max-w-md text-xl py-4 min-h-touch-lg shadow-lg"
            >
              Nueva Venta (Enter)
            </button>
          </div>
        ) : (
          /* Pantalla Principal de Cobro */
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto">
            {/* Columna Izquierda: Métodos de pago y teclado (7 cols) */}
            <div className="md:col-span-7 p-6 border-r border-neutro-800 flex flex-col justify-between space-y-4">
              {/* Selector de Método de Pago */}
              <div>
                <label className="text-xs font-semibold uppercase text-neutro-400 tracking-wider mb-2 block">
                  Método de Pago
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoActual('efectivo')}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-2xl border min-h-touch transition-all',
                      metodoActual === 'efectivo'
                        ? 'bg-carmin-600 border-carmin-500 text-white shadow-lg'
                        : 'bg-neutro-800 border-neutro-700 text-neutro-300 hover:bg-neutro-700'
                    )}
                  >
                    <Banknote size={26} className="mb-1" />
                    <span className="text-sm font-bold">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoActual('tarjeta')}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-2xl border min-h-touch transition-all',
                      metodoActual === 'tarjeta'
                        ? 'bg-carmin-600 border-carmin-500 text-white shadow-lg'
                        : 'bg-neutro-800 border-neutro-700 text-neutro-300 hover:bg-neutro-700'
                    )}
                  >
                    <CreditCard size={26} className="mb-1" />
                    <span className="text-sm font-bold">Tarjeta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoActual('transferencia')}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-2xl border min-h-touch transition-all',
                      metodoActual === 'transferencia'
                        ? 'bg-carmin-600 border-carmin-500 text-white shadow-lg'
                        : 'bg-neutro-800 border-neutro-700 text-neutro-300 hover:bg-neutro-700'
                    )}
                  >
                    <Smartphone size={26} className="mb-1" />
                    <span className="text-sm font-bold">Transferencia</span>
                  </button>
                </div>
              </div>

              {/* Botones de Denominación Rápida */}
              <div>
                <label className="text-xs font-semibold uppercase text-neutro-400 tracking-wider mb-2 block">
                  Billetes Rápidos / Exacto
                </label>
                <div className="grid grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDenominacion(total)}
                    className="p-2.5 rounded-xl bg-neutro-800 border border-neutro-700 text-amber-400 font-bold hover:bg-neutro-700 active:scale-95 text-xs transition-all"
                  >
                    Exacto
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDenominacion(10000)}
                    className="p-2.5 rounded-xl bg-neutro-800 border border-neutro-700 text-white font-bold hover:bg-neutro-700 active:scale-95 text-xs transition-all"
                  >
                    $10k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDenominacion(20000)}
                    className="p-2.5 rounded-xl bg-neutro-800 border border-neutro-700 text-white font-bold hover:bg-neutro-700 active:scale-95 text-xs transition-all"
                  >
                    $20k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDenominacion(50000)}
                    className="p-2.5 rounded-xl bg-neutro-800 border border-neutro-700 text-white font-bold hover:bg-neutro-700 active:scale-95 text-xs transition-all"
                  >
                    $50k
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDenominacion(100000)}
                    className="p-2.5 rounded-xl bg-neutro-800 border border-neutro-700 text-white font-bold hover:bg-neutro-700 active:scale-95 text-xs transition-all"
                  >
                    $100k
                  </button>
                </div>
              </div>

              {/* Input Display de Monto */}
              <div className="bg-neutro-950 p-4 rounded-2xl border border-neutro-700 flex items-center justify-between">
                <span className="text-neutro-400 text-sm font-medium">Monto a abonar ({metodoActual}):</span>
                <div className="text-right">
                  <span className="text-3xl font-mono font-extrabold text-white">
                    ${montoInput || '0.00'}
                  </span>
                </div>
              </div>

              {/* Teclado Numérico Táctil */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigit(digit)}
                    className="min-h-touch bg-neutro-800 hover:bg-neutro-700 active:bg-carmin-700 text-white font-bold text-2xl rounded-xl transition-all active:scale-95"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleDeleteDigit}
                  className="min-h-touch bg-neutro-800 hover:bg-neutro-700 active:scale-95 text-neutro-300 font-bold rounded-xl flex items-center justify-center transition-all"
                  aria-label="Borrar dígito"
                >
                  <Delete size={26} />
                </button>
              </div>

              {/* Botón para pagos mixtos */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearMonto}
                  className="px-4 py-2.5 rounded-xl bg-neutro-800 text-neutro-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Limpiar monto
                </button>
                <button
                  type="button"
                  onClick={handleAgregarPagoParcial}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <Plus size={18} />
                  Agregar como pago mixto
                </button>
              </div>
            </div>

            {/* Columna Derecha: Resumen de Totales y Devuelta (5 cols) */}
            <div className="md:col-span-5 p-6 bg-neutro-950 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Gran Total */}
                <div className="p-4 rounded-2xl bg-carmin-950/40 border border-carmin-800/60 text-center">
                  <span className="text-xs uppercase font-bold text-carmin-300 tracking-wider">Total a Cobrar</span>
                  <div className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight mt-1">
                    ${total.toFixed(2)}
                  </div>
                </div>

                {/* Pagos parciales registrados si aplica */}
                {pagos.length > 0 && (
                  <div className="bg-neutro-900 border border-neutro-800 rounded-xl p-3 space-y-2">
                    <span className="text-xs font-semibold text-neutro-400 uppercase tracking-wider block">
                      Pagos Mixtos Registrados:
                    </span>
                    {pagos.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-neutro-800 last:border-none">
                        <span className="text-white capitalize">{p.metodo}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-emerald-400 font-bold">${p.monto.toFixed(2)}</span>
                          <button
                            onClick={() => handleEliminarPagoParcial(idx)}
                            className="text-neutral-500 hover:text-red-400 p-1"
                            aria-label="Eliminar pago parcial"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Resumen de Pago y Cambio */}
                <div className="space-y-2 bg-neutro-900 border border-neutro-800 p-4 rounded-2xl">
                  <div className="flex justify-between text-neutro-300 text-sm">
                    <span>Monto Recibido:</span>
                    <span className="font-mono font-bold text-white">${validacion.totalPagado.toFixed(2)}</span>
                  </div>

                  {!validacion.esValido && validacion.faltante > 0 ? (
                    <div className="pt-2 border-t border-neutro-800 flex justify-between items-center text-amber-400">
                      <span className="text-sm font-bold">Faltante:</span>
                      <span className="text-2xl font-mono font-extrabold">${validacion.faltante.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-neutro-800 flex justify-between items-center text-emerald-400">
                      <span className="text-sm font-bold">Cambio / Devuelta:</span>
                      <span className="text-3xl font-mono font-extrabold tracking-tight">
                        ${validacion.cambio.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Opción de impresión de ticket */}
                <label className="flex items-center gap-3 px-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={imprimirTicket}
                    onChange={(e) => setImprimirTicket(e.target.checked)}
                    className="w-5 h-5 rounded bg-neutro-800 border-neutro-600 text-carmin-600 focus:ring-carmin-500"
                  />
                  <span className="text-sm text-neutro-300 flex items-center gap-2 font-medium">
                    <Printer size={18} className="text-neutro-400" />
                    Imprimir ticket térmico al cobrar
                  </span>
                </label>
              </div>

              {/* Botón Principal de Confirmación */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={!validacion.esValido || isProcessing}
                  onClick={handleConfirmarVenta}
                  className={cn(
                    'w-full py-4 px-6 rounded-2xl font-extrabold text-xl min-h-touch-lg shadow-xl flex items-center justify-center gap-3 transition-all duration-150',
                    validacion.esValido && !isProcessing
                      ? 'bg-carmin-600 hover:bg-carmin-500 active:scale-[0.98] text-white cursor-pointer'
                      : 'bg-neutro-800 text-neutro-500 cursor-not-allowed border border-neutro-700'
                  )}
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando venta...</span>
                    </div>
                  ) : (
                    <>
                      <span>CONFIRMAR VENTA</span>
                      <span className="text-xs bg-black/30 px-2.5 py-1 rounded-lg">Enter</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
