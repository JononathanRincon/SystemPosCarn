'use client';

import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingDown,
  Trash2,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { obtenerSemaforoFEFO } from '@/lib/inventory/recepcion-service';

interface LoteTabla {
  id: string;
  codigoLote: string;
  productoNombre: string;
  categoria: string;
  proveedor: string;
  cantidadInicialKg: number;
  cantidadDisponibleKg: number;
  costoUnitarioKg: number;
  fechaIngreso: string;
  fechaVencimiento: string;
}

const LOTES_MOCK: LoteTabla[] = [
  {
    id: 'l-1',
    codigoLote: 'L-RES-260901-01',
    productoNombre: 'Arrachera Marinada Especial',
    categoria: 'Res',
    proveedor: 'Frigorífico Guadalupe S.A.',
    cantidadInicialKg: 120.0,
    cantidadDisponibleKg: 28.5,
    costoUnitarioKg: 175.0,
    fechaIngreso: '2026-09-01',
    fechaVencimiento: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0], // Ámbar (2 días)
  },
  {
    id: 'l-2',
    codigoLote: 'L-POL-260905-02',
    productoNombre: 'Pechuga de Pollo Fresca',
    categoria: 'Pollo',
    proveedor: 'Avícola Santa Inés',
    cantidadInicialKg: 80.0,
    cantidadDisponibleKg: 15.0,
    costoUnitarioKg: 80.0,
    fechaIngreso: '2026-09-05',
    fechaVencimiento: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString().split('T')[0], // Ámbar (1 día)
  },
  {
    id: 'l-3',
    codigoLote: 'L-CER-260828-01',
    productoNombre: 'Costilla de Cerdo BBQ',
    categoria: 'Cerdo',
    proveedor: 'Porcícola El Trébol',
    cantidadInicialKg: 60.0,
    cantidadDisponibleKg: 4.5,
    costoUnitarioKg: 95.0,
    fechaIngreso: '2026-08-28',
    fechaVencimiento: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString().split('T')[0], // Rojo (Vencido ayer)
  },
  {
    id: 'l-4',
    codigoLote: 'L-RES-260907-03',
    productoNombre: 'Bistec de Res Especial',
    categoria: 'Res',
    proveedor: 'Frigorífico Central del Valle',
    cantidadInicialKg: 180.0,
    cantidadDisponibleKg: 145.0,
    costoUnitarioKg: 145.0,
    fechaIngreso: '2026-09-07',
    fechaVencimiento: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString().split('T')[0], // Verde (10 días)
  },
  {
    id: 'l-5',
    codigoLote: 'L-EMB-260906-01',
    productoNombre: 'Chorizo Santarrosano Artesanal',
    categoria: 'Embutidos',
    proveedor: 'Embutidos La Casona',
    cantidadInicialKg: 50.0,
    cantidadDisponibleKg: 38.0,
    costoUnitarioKg: 90.0,
    fechaIngreso: '2026-09-06',
    fechaVencimiento: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0], // Verde (15 días)
  },
];

export default function MonitorLotesPage() {
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'verde' | 'ambar' | 'rojo'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [lotes, setLotes] = useState<LoteTabla[]>(LOTES_MOCK);

  const lotesConSemaforo = useMemo(() => {
    return lotes.map((lote) => {
      const semaforo = obtenerSemaforoFEFO(lote.fechaVencimiento, lote.cantidadDisponibleKg);
      return {
        ...lote,
        semaforo,
      };
    });
  }, [lotes]);

  const lotesFiltrados = useMemo(() => {
    return lotesConSemaforo.filter((lote) => {
      if (filtroEstado !== 'todos' && lote.semaforo !== filtroEstado) return false;
      if (filtroCategoria !== 'todas' && lote.categoria !== filtroCategoria) return false;
      if (busqueda.trim() !== '') {
        const q = busqueda.toLowerCase();
        return (
          lote.codigoLote.toLowerCase().includes(q) ||
          lote.productoNombre.toLowerCase().includes(q) ||
          lote.proveedor.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [lotesConSemaforo, filtroEstado, filtroCategoria, busqueda]);

  // Contadores para badges
  const conteos = useMemo(() => {
    let verdes = 0;
    let ambars = 0;
    let rojos = 0;
    lotesConSemaforo.forEach((l) => {
      if (l.semaforo === 'verde') verdes++;
      else if (l.semaforo === 'ambar') ambars++;
      else if (l.semaforo === 'rojo') rojos++;
    });
    return { verdes, ambars, rojos, total: lotesConSemaforo.length };
  }, [lotesConSemaforo]);

  const handleDarDeBajaMerma = (loteId: string, productoNombre: string, kilos: number) => {
    if (confirm(`¿Registrar merma inmediata para ${kilos} kg de "${productoNombre}"?`)) {
      setLotes((prev) =>
        prev.map((l) => (l.id === loteId ? { ...l, cantidadDisponibleKg: 0 } : l))
      );
      alert(`Se dio de baja el lote. Se generó registro de merma por caducidad.`);
    }
  };

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-150">
      {/* Cabecera */}
      <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-carmin-100 text-carmin-700">
              Trazabilidad FEFO Cárnica
            </span>
            <span className="text-xs text-neutro-400">EARS-LOTE-03 / US-16</span>
          </div>
          <h1 className="text-3xl font-extrabold text-neutro-900 tracking-tight mt-1 flex items-center gap-3">
            <Layers className="text-carmin-600" size={32} />
            Monitor de Lotes Activos y Caducidad
          </h1>
          <p className="text-sm text-neutro-500">
            Control de inventario por lote, días de vida útil y semáforo de alerta preventiva.
          </p>
        </div>

        {/* Semáforo Cards */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFiltroEstado('todos')}
            className={cn(
              'px-3 py-2 rounded-2xl border text-xs font-bold transition-all',
              filtroEstado === 'todos'
                ? 'bg-neutro-900 text-white border-neutro-900'
                : 'bg-white text-neutro-700 border-neutro-200 hover:bg-neutro-50'
            )}
          >
            Todos ({conteos.total})
          </button>

          <button
            onClick={() => setFiltroEstado('verde')}
            className={cn(
              'px-3 py-2 rounded-2xl border text-xs font-bold transition-all flex items-center gap-1.5',
              filtroEstado === 'verde'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            )}
          >
            <CheckCircle2 size={15} />
            Vigentes ({conteos.verdes})
          </button>

          <button
            onClick={() => setFiltroEstado('ambar')}
            className={cn(
              'px-3 py-2 rounded-2xl border text-xs font-bold transition-all flex items-center gap-1.5',
              filtroEstado === 'ambar'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            )}
          >
            <AlertTriangle size={15} />
            Por Vencer &le; 3d ({conteos.ambars})
          </button>

          <button
            onClick={() => setFiltroEstado('rojo')}
            className={cn(
              'px-3 py-2 rounded-2xl border text-xs font-bold transition-all flex items-center gap-1.5',
              filtroEstado === 'rojo'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            )}
          >
            <XCircle size={15} />
            Vencidos / Agotados ({conteos.rojos})
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-3xl border border-neutro-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 relative w-full">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutro-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código de lote, corte cárnico o proveedor..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutro-50 border border-neutro-200 text-sm focus:outline-none focus:border-carmin-500"
          />
        </div>

        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="w-full sm:w-48 p-2.5 rounded-xl bg-neutro-50 border border-neutro-200 text-sm font-semibold focus:outline-none cursor-pointer"
        >
          <option value="todas">Todas las Especies</option>
          <option value="Res">Res</option>
          <option value="Cerdo">Cerdo</option>
          <option value="Pollo">Pollo</option>
          <option value="Embutidos">Embutidos</option>
        </select>
      </div>

      {/* Tabla de Lotes Activos */}
      <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutro-50 border-b border-neutro-200 text-neutro-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Estado FEFO</th>
                <th className="p-3">Código Lote</th>
                <th className="p-3">Corte Cárnico</th>
                <th className="p-3">Proveedor</th>
                <th className="p-3 text-right">Disponible / Inicial</th>
                <th className="p-3 text-right">Costo / kg</th>
                <th className="p-3">Fecha Vencimiento</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutro-100">
              {lotesFiltrados.map((lote) => (
                <tr key={lote.id} className="hover:bg-neutro-50/50">
                  <td className="p-3">
                    {lote.semaforo === 'verde' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Vigente
                      </span>
                    )}
                    {lote.semaforo === 'ambar' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold text-[11px] animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Próximo (&le; 3d)
                      </span>
                    )}
                    {lote.semaforo === 'rojo' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold text-[11px]">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {lote.cantidadDisponibleKg <= 0 ? 'Agotado' : 'Vencido'}
                      </span>
                    )}
                  </td>

                  <td className="p-3 font-mono font-bold text-neutro-900">{lote.codigoLote}</td>
                  <td className="p-3 font-bold text-neutro-900">{lote.productoNombre}</td>
                  <td className="p-3 text-neutro-600">{lote.proveedor}</td>

                  <td className="p-3 text-right font-mono">
                    <span className="font-extrabold text-neutro-900">{lote.cantidadDisponibleKg.toFixed(3)}</span>
                    <span className="text-neutro-400"> / {lote.cantidadInicialKg.toFixed(1)} kg</span>
                  </td>

                  <td className="p-3 text-right font-mono font-bold text-neutro-700">
                    ${lote.costoUnitarioKg.toFixed(2)}
                  </td>

                  <td className="p-3">
                    <span className="font-semibold text-neutro-800">{lote.fechaVencimiento}</span>
                  </td>

                  <td className="p-3 text-center">
                    {lote.semaforo === 'rojo' && lote.cantidadDisponibleKg > 0 ? (
                      <button
                        onClick={() => handleDarDeBajaMerma(lote.id, lote.productoNombre, lote.cantidadDisponibleKg)}
                        className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[11px] flex items-center gap-1 mx-auto transition-colors"
                        title="Registrar merma por vencimiento"
                      >
                        <Trash2 size={13} />
                        Baja Merma
                      </button>
                    ) : (
                      <span className="text-neutro-400 text-[11px]">Activo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
