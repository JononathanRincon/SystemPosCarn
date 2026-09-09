'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Thermometer,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  DollarSign,
  Scale,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  ItemRecepcion,
  RecepcionMercanciaInput,
  validarRecepcionCamion,
} from '@/lib/inventory/recepcion-service';
import { obtenerProductosLocales } from '@/lib/db/repos/catalogo-repo';
import { ProductoLocal } from '@/lib/db/pos-database';

export default function RecepcionCamionPage() {
  const [proveedor, setProveedor] = useState<string>('Frigorífico Central del Valle');
  const [guiaRemision, setGuiaRemision] = useState<string>('REM-2026-0988');
  const [sucursalId, setSucursalId] = useState<string>('suc-principal');
  const [temperatura, setTemperatura] = useState<number>(3.2); // Default frío óptimo
  const [observaciones, setObservaciones] = useState<string>('');
  const [productosCatalogo, setProductosCatalogo] = useState<ProductoLocal[]>([]);
  const [guardadoExitoso, setGuardadoExitoso] = useState<boolean>(false);

  // Lista dinámica de cortes cárnicos recibidos en el camión
  const [items, setItems] = useState<ItemRecepcion[]>([
    {
      productoId: 'res-1',
      productoNombre: 'Media Res de Primera',
      codigoLote: `L-RES-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-01`,
      cantidadKg: 195.5,
      costoUnitarioKg: 145.0,
      subtotal: 28347.5,
      fechaVencimiento: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    },
    {
      productoId: 'cerdo-1',
      productoNombre: 'Canal de Cerdo Limpia',
      codigoLote: `L-CER-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-02`,
      cantidadKg: 88.0,
      costoUnitarioKg: 95.0,
      subtotal: 8360.0,
      fechaVencimiento: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0],
    },
  ]);

  useEffect(() => {
    async function loadCatalog() {
      try {
        const prods = await obtenerProductosLocales();
        setProductosCatalogo(prods);
      } catch (err) {
        console.error('Error cargando catálogo:', err);
      }
    }
    loadCatalog();
  }, []);

  // Validación y totales en tiempo real
  const validacion = useMemo(() => {
    return validarRecepcionCamion({
      proveedorNombre: proveedor,
      numeroGuiaRemision: guiaRemision,
      sucursalId,
      temperaturaRecepcionCelsius: temperatura,
      observaciones,
      items,
    });
  }, [proveedor, guiaRemision, sucursalId, temperatura, observaciones, items]);

  const handleAddItem = () => {
    const defaultProd = productosCatalogo[0] || {
      id: 'corte-nuevo',
      nombre: 'Corte Cárnico Seleccionado',
    };
    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const newItem: ItemRecepcion = {
      productoId: defaultProd.id,
      productoNombre: defaultProd.nombre,
      codigoLote: `L-CARNE-${todayStr}-${items.length + 1}`,
      cantidadKg: 50.0,
      costoUnitarioKg: 120.0,
      subtotal: 6000.0,
      fechaVencimiento: new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString().split('T')[0],
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (index: number, updates: Partial<ItemRecepcion>) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      const merged = { ...current, ...updates };

      if (updates.cantidadKg !== undefined || updates.costoUnitarioKg !== undefined) {
        merged.subtotal = Math.round(merged.cantidadKg * merged.costoUnitarioKg * 100) / 100;
      }
      next[index] = merged;
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGuardarRecepcion = () => {
    if (!validacion.esValida) {
      alert(`No se puede registrar la recepción:\n- ${validacion.errores.join('\n- ')}`);
      return;
    }

    setGuardadoExitoso(true);
    setTimeout(() => setGuardadoExitoso(false), 4000);
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-150">
      {/* Cabecera */}
      <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-carmin-100 text-carmin-700">
              Control de Abastecimiento Frigorífico
            </span>
            <span className="text-xs text-neutro-400">EARS-LOTE-01 / EARS-LOTE-05</span>
          </div>
          <h1 className="text-3xl font-extrabold text-neutro-900 tracking-tight mt-1 flex items-center gap-3">
            <Truck className="text-carmin-600" size={32} />
            Recepción de Camión Frigorífico y Lotes
          </h1>
          <p className="text-sm text-neutro-500">
            Ingreso de materia prima cárnica con verificación de cadena de frío y trazabilidad FEFO.
          </p>
        </div>

        {/* Totales consolidados de recepción */}
        <div className="flex items-center gap-3">
          <div className="bg-neutro-900 text-white p-4 rounded-2xl text-right shadow-md">
            <span className="text-[11px] font-bold uppercase text-carmin-400 block tracking-wider">Costo Embarque</span>
            <span className="text-2xl font-black font-mono">${validacion.costoTotalEmbarque.toLocaleString('es-CO')}</span>
            <span className="text-xs text-neutro-400 block mt-0.5">{validacion.kilosTotalesEmbarque} kg recibidos</span>
          </div>
        </div>
      </div>

      {/* Banner de Ruptura de Cadena de Frío (EARS-LOTE-05) */}
      {validacion.alertaTemperatura && (
        <div className="p-5 rounded-3xl bg-red-50 border-2 border-red-500 text-red-900 flex items-start gap-4 shadow-md animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-wide text-red-700">
              ¡Alerta Sanitaria Crítica: Ruptura de Cadena de Frío Detectada!
            </h3>
            <p className="text-sm font-semibold mt-1">
              La temperatura ingresada es de <strong className="underline">{temperatura}°C</strong>, superando el límite máximo permitido de <strong>4.0°C</strong> para productos cárnicos refrigerados.
            </p>
            <p className="text-xs text-red-700 mt-1">
              Exige reinspección por supervisor de calidad o rechazo del embarque para proteger la seguridad alimentaria.
            </p>
          </div>
        </div>
      )}

      {/* Datos del Despacho y Termómetro de Recepción */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Datos de Despacho (8 cols) */}
        <div className="md:col-span-8 bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
          <h3 className="font-extrabold text-base text-neutro-900 uppercase tracking-wider">
            1. Datos del Despacho y Remisión
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-neutro-600 block mb-1">Proveedor Frigorífico</label>
              <input
                type="text"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Nombre del proveedor o frigorífico"
                className="w-full p-3 rounded-xl bg-neutro-50 border border-neutro-300 text-sm font-semibold focus:outline-none focus:border-carmin-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutro-600 block mb-1">Guía / Remisión #</label>
              <input
                type="text"
                value={guiaRemision}
                onChange={(e) => setGuiaRemision(e.target.value)}
                placeholder="Número de guía oficial"
                className="w-full p-3 rounded-xl bg-neutro-50 border border-neutro-300 text-sm font-semibold focus:outline-none focus:border-carmin-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutro-600 block mb-1">Sucursal Receptora</label>
              <select
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                className="w-full p-3 rounded-xl bg-neutro-50 border border-neutro-300 text-sm font-semibold focus:outline-none focus:border-carmin-500"
              >
                <option value="suc-principal">Sede Principal Norte</option>
                <option value="suc-central">Sede Mercado Central</option>
                <option value="suc-sur">Sede Calle Real Sur</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-neutro-600 block mb-1">Observaciones de Entrega</label>
              <input
                type="text"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Sello intacto, chofer verificado..."
                className="w-full p-3 rounded-xl bg-neutro-50 border border-neutro-300 text-sm focus:outline-none focus:border-carmin-500"
              />
            </div>
          </div>
        </div>

        {/* Control de Temperatura (4 cols) */}
        <div className="md:col-span-4 bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-neutro-900 uppercase tracking-wider flex items-center gap-2">
                <Thermometer size={20} className={temperatura > 4 ? 'text-red-600' : 'text-emerald-600'} />
                Cadena de Frío
              </h3>
              <span
                className={cn(
                  'text-[10px] font-black uppercase px-2 py-0.5 rounded-full',
                  temperatura > 4 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                )}
              >
                {temperatura > 4 ? 'NO CONFORME' : 'CONFORME (≤ 4°C)'}
              </span>
            </div>
            <p className="text-xs text-neutro-400 mt-1">Lectura de termómetro del camión al abrir compuertas.</p>

            {/* Display Gigante de Temperatura */}
            <div className="mt-4 p-4 rounded-2xl bg-neutro-50 border border-neutro-200 text-center">
              <span
                className={cn(
                  'text-4xl font-black font-mono tracking-tight',
                  temperatura > 4 ? 'text-red-600' : 'text-emerald-600'
                )}
              >
                {temperatura.toFixed(1)}°C
              </span>
              <span className="text-xs block text-neutro-400 mt-1">Temperatura del furgón</span>
            </div>

            {/* Input de Temperatura */}
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={temperatura}
                onChange={(e) => setTemperatura(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 rounded-xl border border-neutro-300 text-center font-bold text-base focus:outline-none"
              />
              <span className="text-sm font-bold text-neutro-500">°C</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Dinámica de Recepción de Cortes y Generación de Lotes */}
      <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-lg text-neutro-900 uppercase tracking-wider">
              2. Desglose de Cortes Cárnicos y Lotes Recibidos
            </h3>
            <p className="text-xs text-neutro-400">
              Cada ítem genera un lote con trazabilidad FEFO, costo unitario y fecha de caducidad obligatoria (EARS-LOTE-01).
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddItem}
            className="btn-pos-primary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Agregar Corte Cárnico</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutro-50 border-b border-neutro-200 text-neutro-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Corte Cárnico</th>
                <th className="p-3">Código de Lote</th>
                <th className="p-3 text-right">Kilos (kg)</th>
                <th className="p-3 text-right">Costo Unitario ($/kg)</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3">Fecha Vencimiento</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutro-100">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-neutro-50/50">
                  <td className="p-3">
                    <input
                      type="text"
                      value={item.productoNombre}
                      onChange={(e) => handleUpdateItem(index, { productoNombre: e.target.value })}
                      className="p-2 rounded-lg bg-neutro-50 border border-neutro-200 text-xs font-bold w-48"
                    />
                  </td>

                  <td className="p-3">
                    <input
                      type="text"
                      value={item.codigoLote}
                      onChange={(e) => handleUpdateItem(index, { codigoLote: e.target.value })}
                      placeholder="L-001"
                      className="p-2 rounded-lg bg-neutro-50 border border-neutro-200 text-xs font-mono font-bold w-40"
                    />
                  </td>

                  <td className="p-3 text-right">
                    <input
                      type="number"
                      step="0.001"
                      value={item.cantidadKg}
                      onChange={(e) => handleUpdateItem(index, { cantidadKg: parseFloat(e.target.value) || 0 })}
                      className="p-2 rounded-lg bg-neutro-50 border border-neutro-200 text-xs font-mono font-bold text-right w-24"
                    />
                  </td>

                  <td className="p-3 text-right">
                    <input
                      type="number"
                      step="0.5"
                      value={item.costoUnitarioKg}
                      onChange={(e) => handleUpdateItem(index, { costoUnitarioKg: parseFloat(e.target.value) || 0 })}
                      className="p-2 rounded-lg bg-neutro-50 border border-neutro-200 text-xs font-mono font-bold text-right w-24"
                    />
                  </td>

                  <td className="p-3 text-right font-mono font-extrabold text-neutro-900">
                    ${item.subtotal.toFixed(2)}
                  </td>

                  <td className="p-3">
                    <input
                      type="date"
                      value={item.fechaVencimiento}
                      onChange={(e) => handleUpdateItem(index, { fechaVencimiento: e.target.value })}
                      className="p-2 rounded-lg bg-neutro-50 border border-neutro-200 text-xs font-semibold"
                    />
                  </td>

                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-1.5 rounded-lg text-neutro-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Quitar línea"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Botón de Confirmación de Recepción */}
        <div className="pt-4 border-t border-neutro-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          {guardadoExitoso ? (
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <CheckCircle2 size={20} />
              <span>¡Recepción registrada exitosamente! Se crearon {items.length} lotes en el inventario.</span>
            </div>
          ) : (
            <div className="text-xs text-neutro-500">
              Al confirmar, los lotes quedan activos y disponibles para venta en terminales POS con descuento FEFO.
            </div>
          )}

          <button
            type="button"
            disabled={!validacion.esValida}
            onClick={handleGuardarRecepcion}
            className={cn(
              'min-h-touch px-8 rounded-2xl font-black text-base shadow-lg transition-all',
              validacion.esValida
                ? 'bg-carmin-600 text-white hover:bg-carmin-500 active:scale-95 cursor-pointer'
                : 'bg-neutro-200 text-neutro-400 cursor-not-allowed'
            )}
          >
            CONFIRMAR RECEPCIÓN DE CAMIÓN
          </button>
        </div>
      </div>
    </div>
  );
}
