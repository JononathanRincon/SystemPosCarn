'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Scale,
  Receipt,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Store,
  ShieldAlert,
  Flame,
  Clock,
  UserCheck,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronRight,
  PieChart,
  Activity,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  MetricasDueño,
  calcularMargenBrutoPonderado,
  calcularBenchmarkingSucursales,
  calcularCascadaCaja,
  monetizarMermas,
  analizarSmartFEFO,
  evaluarCarteraFiada,
} from '@/lib/analytics/dashboard-data';

// Datos consolidados de muestra sincronizados (EARS-DASH-01)
const DATOS_DUEÑO_MOCK: MetricasDueño = {
  ventasHoy: 1245080.0,
  ventasAyer: 1120000.0,
  deltaVentasPct: 11.17,
  margenBrutoPonderadoPct: 27.84, // Calculado por US-17
  kilosTotalesDespachados: {
    total: 3840.5,
    res: 1950.0,
    cerdo: 980.5,
    pollo: 620.0,
    embutidos: 210.0,
    otros: 80.0,
  },
  ticketPromedio: 85280.0,
  transaccionesCount: 146,
  syncTimestamp: new Date().toISOString(),
  desglosePagos: {
    efectivo: 745000.0,
    tarjeta: 310080.0,
    transferencia: 140000.0,
    creditoFiado: 50000.0,
  },
  sucursalesBenchmarking: calcularBenchmarkingSucursales([
    { sucursalId: 'suc-1', nombre: 'Sede Principal Norte', ventas: 540000.0, margenPct: 29.5 },
    { sucursalId: 'suc-2', nombre: 'Sede Mercado Central', ventas: 480000.0, margenPct: 28.2 },
    { sucursalId: 'suc-3', nombre: 'Sede Calle Real Sur', ventas: 225080.0, margenPct: 21.8 }, // Alerta desposte (< -5%)
  ]),
  topCortesMargen: [
    { productoId: 'res-2', nombre: 'Arrachera Marinada Especial', kilosVendidos: 450.0, precioVentaPromedio: 260.0, costoLotePromedio: 175.0, margenMonetario: 38250.0, margenPct: 32.69 },
    { productoId: 'res-5', nombre: 'T-Bone Steak Premium', kilosVendidos: 280.0, precioVentaPromedio: 280.0, costoLotePromedio: 195.0, margenMonetario: 23800.0, margenPct: 30.36 },
    { productoId: 'cerdo-1', nombre: 'Chuleta de Cerdo Ahumada', kilosVendidos: 520.0, precioVentaPromedio: 125.0, costoLotePromedio: 88.0, margenMonetario: 19240.0, margenPct: 29.6 },
    { productoId: 'res-1', nombre: 'Bistec de Res Especial', kilosVendidos: 820.0, precioVentaPromedio: 195.0, costoLotePromedio: 152.0, margenMonetario: 35260.0, margenPct: 22.05 },
    { productoId: 'emb-1', nombre: 'Chorizo Santarrosano Artesanal', kilosVendidos: 190.0, precioVentaPromedio: 150.0, costoLotePromedio: 92.0, margenMonetario: 11020.0, margenPct: 38.67 },
  ],
};

const CASCADA_CAJA_MOCK = calcularCascadaCaja({
  ventasEfectivo: 745000.0,
  inyeccionesBase: 300000.0, // Fondo base en efectivo
  pagosMateriaPrimaCamion: 420000.0, // Compra de ganado/canales pagado desde gaveta
  gastosMenoresOperativos: 65000.0, // Hielo, fletes, bolsas
});

const MERMAS_MOCK = monetizarMermas([
  { id: 'm-1', productoNombre: 'Lomo de Cerdo', kilos: 4.5, costoUnitario: 95.0, motivo: 'caducidad', fecha: '2026-09-08' },
  { id: 'm-2', productoNombre: 'Media Res Refrigerada', kilos: 12.0, costoUnitario: 145.0, motivo: 'evaporacion_frio', fecha: '2026-09-08' },
  { id: 'm-3', productoNombre: 'Canal de Res (Grasa y Hueso sobrante)', kilos: 28.5, costoUnitario: 45.0, motivo: 'desposte_hueso_grasa', fecha: '2026-09-08' },
  { id: 'm-4', productoNombre: 'Pechuga Pollo', kilos: 2.0, costoUnitario: 80.0, motivo: 'dano_manipulacion', fecha: '2026-09-08' },
]);

const SMART_FEFO_MOCK = analizarSmartFEFO([
  {
    loteId: 'lote-pol-01',
    productoNombre: 'Pechuga de Pollo Fresca',
    codigoLote: 'L-POL-260907',
    cantidadDisponible: 65.5,
    fechaVencimiento: new Date(Date.now() + 26 * 3600 * 1000), // Vence en 26h
    velocidadVentaDiariaKg: 25.0, // Necesita ~63 horas para agotar 65kg -> RIESGO
  },
  {
    loteId: 'lote-vis-02',
    productoNombre: 'Hígado de Res',
    codigoLote: 'L-VIS-260906',
    cantidadDisponible: 18.0,
    fechaVencimiento: new Date(Date.now() + 20 * 3600 * 1000), // Vence en 20h
    velocidadVentaDiariaKg: 12.0, // RIESGO CRÍTICO
  },
  {
    loteId: 'lote-res-03',
    productoNombre: 'Arrachera Marinada',
    codigoLote: 'L-ARR-260905',
    cantidadDisponible: 22.0,
    fechaVencimiento: new Date(Date.now() + 44 * 3600 * 1000), // Vence en 44h
    velocidadVentaDiariaKg: 40.0, // Se agota en ~13h -> SIN RIESGO
  },
]);

const CLIENTES_FIADO_MOCK = evaluarCarteraFiada([
  { clienteId: 'cl-1', nombre: 'Restaurante Sabor Criollo', saldoPendiente: 1850000.0, limiteCredito: 2000000.0, diasMora: 0 }, // 92.5% -> Alerta 80%
  { clienteId: 'cl-2', nombre: 'Asadero Central El Brasero', saldoPendiente: 2400000.0, limiteCredito: 2500000.0, diasMora: 12 }, // Mora y 96%
  { clienteId: 'cl-3', nombre: 'Piqueteadero Las Brisas', saldoPendiente: 450000.0, limiteCredito: 1500000.0, diasMora: 0 },
]);

export default function DashboardAdminPage() {
  const [activeTab, setActiveTab] = useState<'ejecutivo' | 'flujo_mermas' | 'smart_fefo'>('ejecutivo');
  const [filtroSucursal, setFiltroSucursal] = useState<string>('todas');

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-150">
      {/* ─── CABECERA DEL DASHBOARD ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-carmin-100 text-carmin-700">
              Panel Directivo Cárnico
            </span>
            <span className="text-xs text-neutro-400 flex items-center gap-1">
              <Clock size={14} />
              Última Sync: {new Date(DATOS_DUEÑO_MOCK.syncTimestamp).toLocaleTimeString('es-CO')}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-neutro-900 tracking-tight mt-1">
            Dashboard Financiero y Operativo
          </h1>
          <p className="text-sm text-neutro-500">
            Control de márgenes reales, desposte, mermas monetizadas y proyección FEFO multi-sucursal.
          </p>
        </div>

        {/* Filtro de Sucursal */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-neutro-100 px-3 py-2 rounded-2xl border border-neutro-200">
            <Store size={18} className="text-neutro-500" />
            <select
              value={filtroSucursal}
              onChange={(e) => setFiltroSucursal(e.target.value)}
              className="bg-transparent text-sm font-semibold text-neutro-800 focus:outline-none cursor-pointer"
            >
              <option value="todas">Consolidado (Todas las Sedes)</option>
              <option value="suc-1">Sede Principal Norte</option>
              <option value="suc-2">Sede Mercado Central</option>
              <option value="suc-3">Sede Calle Real Sur</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── PESTAÑAS ANALÍTICAS SUPERIORES ─── */}
      <div className="flex gap-2 border-b border-neutro-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ejecutivo')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all min-h-touch whitespace-nowrap',
            activeTab === 'ejecutivo'
              ? 'bg-carmin-600 text-white shadow-md'
              : 'bg-white text-neutro-600 hover:bg-neutro-100 border border-neutro-200'
          )}
        >
          <TrendingUp size={18} />
          <span>1. Resumen Ejecutivo & Rentabilidad</span>
        </button>

        <button
          onClick={() => setActiveTab('flujo_mermas')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all min-h-touch whitespace-nowrap',
            activeTab === 'flujo_mermas'
              ? 'bg-carmin-600 text-white shadow-md'
              : 'bg-white text-neutro-600 hover:bg-neutro-100 border border-neutro-200'
          )}
        >
          <Layers size={18} />
          <span>2. Flujo de Caja & Radar de Mermas</span>
        </button>

        <button
          onClick={() => setActiveTab('smart_fefo')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all min-h-touch whitespace-nowrap',
            activeTab === 'smart_fefo'
              ? 'bg-carmin-600 text-white shadow-md'
              : 'bg-white text-neutro-600 hover:bg-neutro-100 border border-neutro-200'
          )}
        >
          <Activity size={18} />
          <span>3. Operación de Sede & Smart FEFO</span>
        </button>
      </div>

      {/* ─── CONTENIDO TAB 1: RESUMEN EJECUTIVO & RENTABILIDAD (DUEÑO) ─── */}
      {activeTab === 'ejecutivo' && (
        <div className="space-y-6">
          {/* 4 KPI Cards Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ventas del Día */}
            <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutro-400">Ventas del Día</span>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign size={22} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-neutro-900 tracking-tight">
                  ${DATOS_DUEÑO_MOCK.ventasHoy.toLocaleString('es-CO')}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-emerald-600">
                  <ArrowUpRight size={16} />
                  <span>+{DATOS_DUEÑO_MOCK.deltaVentasPct}% vs. Ayer</span>
                </div>
              </div>
            </div>

            {/* Margen Bruto Real Ponderado (US-17) */}
            <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutro-400">Margen Bruto Real</span>
                <div className="w-10 h-10 rounded-2xl bg-carmin-50 text-carmin-600 flex items-center justify-center">
                  <TrendingUp size={22} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-carmin-600 tracking-tight">
                  {DATOS_DUEÑO_MOCK.margenBrutoPonderadoPct}%
                </div>
                <div className="flex items-center gap-1 mt-2 text-xs text-neutro-500 font-medium">
                  <span>Ponderado con costo real de lotes</span>
                </div>
              </div>
            </div>

            {/* Kilos Despachados */}
            <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutro-400">Volumen Despachado</span>
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Scale size={22} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-neutro-900 tracking-tight">
                  {DATOS_DUEÑO_MOCK.kilosTotalesDespachados.total.toLocaleString('es-CO')} <span className="text-lg font-bold text-neutro-400">kg</span>
                </div>
                <div className="text-xs text-neutro-500 mt-2 flex gap-2">
                  <span>Res: <strong>{DATOS_DUEÑO_MOCK.kilosTotalesDespachados.res}kg</strong></span>
                  <span>Cerdo: <strong>{DATOS_DUEÑO_MOCK.kilosTotalesDespachados.cerdo}kg</strong></span>
                </div>
              </div>
            </div>

            {/* Ticket Promedio & Conteo */}
            <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutro-400">Transacciones</span>
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Receipt size={22} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-neutro-900 tracking-tight">
                  {DATOS_DUEÑO_MOCK.transaccionesCount} <span className="text-lg font-bold text-neutro-400">tickets</span>
                </div>
                <div className="text-xs text-neutro-500 mt-2 font-medium">
                  Promedio: <strong>${DATOS_DUEÑO_MOCK.ticketPromedio.toLocaleString('es-CO')} / ticket</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Grillas Secundarias: Desglose de Medios de Pago + Benchmarking Sucursales */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Desglose de Pagos (5 cols) */}
            <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
              <h3 className="font-extrabold text-lg text-neutro-900 flex items-center gap-2">
                <PieChart size={20} className="text-carmin-600" />
                Desglose por Medio de Pago
              </h3>
              <p className="text-xs text-neutro-400">Distribución del ingreso diario en todas las terminales.</p>

              <div className="space-y-3 pt-2">
                {[
                  { label: 'Efectivo en Caja', icon: Banknote, monto: DATOS_DUEÑO_MOCK.desglosePagos.efectivo, color: 'bg-emerald-500' },
                  { label: 'Tarjetas Débito/Crédito', icon: CreditCard, monto: DATOS_DUEÑO_MOCK.desglosePagos.tarjeta, color: 'bg-blue-500' },
                  { label: 'Transferencias (Nequi/Daviplata)', icon: Smartphone, monto: DATOS_DUEÑO_MOCK.desglosePagos.transferencia, color: 'bg-purple-500' },
                  { label: 'Venta a Crédito / Fiado', icon: UserCheck, monto: DATOS_DUEÑO_MOCK.desglosePagos.creditoFiado, color: 'bg-amber-500' },
                ].map((item) => {
                  const pct = Math.round((item.monto / DATOS_DUEÑO_MOCK.ventasHoy) * 100);
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-neutro-700">
                        <span className="flex items-center gap-1.5">
                          <item.icon size={15} className="text-neutro-500" />
                          {item.label}
                        </span>
                        <span>${item.monto.toLocaleString('es-CO')} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-neutro-100 overflow-hidden">
                        <div className={cn('h-full rounded-full', item.color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Benchmarking de Sucursales y Detección de Desposte (7 cols) */}
            <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg text-neutro-900 flex items-center gap-2">
                    <Store size={20} className="text-carmin-600" />
                    Comparativo y Auditoría de Sucursales
                  </h3>
                  <p className="text-xs text-neutro-400">Monitoreo de desviación de margen para detectar desposte deficiente o robo.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutro-50 border-b border-neutro-200 text-neutro-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 rounded-l-xl">Sucursal</th>
                      <th className="p-3 text-right">Venta del Día</th>
                      <th className="p-3 text-right">Margen Real</th>
                      <th className="p-3 text-right">Desviación</th>
                      <th className="p-3 text-center rounded-r-xl">Estado Auditoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutro-100">
                    {DATOS_DUEÑO_MOCK.sucursalesBenchmarking.map((s) => (
                      <tr key={s.sucursalId} className="hover:bg-neutro-50/50">
                        <td className="p-3 font-bold text-neutro-900">{s.nombre}</td>
                        <td className="p-3 text-right font-mono font-semibold">${s.ventas.toLocaleString('es-CO')}</td>
                        <td className="p-3 text-right font-mono font-bold text-neutro-800">{s.margenPct}%</td>
                        <td className={cn('p-3 text-right font-mono font-bold', s.desviacionPct < 0 ? 'text-carmin-600' : 'text-emerald-600')}>
                          {s.desviacionPct > 0 ? `+${s.desviacionPct}%` : `${s.desviacionPct}%`}
                        </td>
                        <td className="p-3 text-center">
                          {s.alertaDesposte ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-extrabold text-[11px] animate-pulse">
                              <ShieldAlert size={14} />
                              Desposte Ineficiente (&lt; -5%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-[11px]">
                              Operación Óptima
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Top Cortes Cárnicos por Margen Neto */}
          <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-lg text-neutro-900">
              Top Cortes Cárnicos por Margen Neto Real
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutro-50 border-b border-neutro-200 text-neutro-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Corte Cárnico</th>
                    <th className="p-3 text-right">Kilos Vendidos</th>
                    <th className="p-3 text-right">Precio Venta Promedio</th>
                    <th className="p-3 text-right">Costo Lote Real</th>
                    <th className="p-3 text-right">Ganancia Neta</th>
                    <th className="p-3 text-right">Margen %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutro-100">
                  {DATOS_DUEÑO_MOCK.topCortesMargen.map((c) => (
                    <tr key={c.productoId} className="hover:bg-neutro-50/50">
                      <td className="p-3 font-bold text-neutro-900">{c.nombre}</td>
                      <td className="p-3 text-right font-mono">{c.kilosVendidos} kg</td>
                      <td className="p-3 text-right font-mono">${c.precioVentaPromedio.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono text-neutro-500">${c.costoLotePromedio.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono font-extrabold text-emerald-600">
                        +${c.margenMonetario.toLocaleString('es-CO')}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-carmin-600">{c.margenPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTENIDO TAB 2: FLUJO DE CAJA & CONTROL DE MERMAS ─── */}
      {activeTab === 'flujo_mermas' && (
        <div className="space-y-6">
          {/* Cascada de Efectivo Líquido Real en Gaveta */}
          <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-xl text-neutro-900">
                Cascada de Flujo de Caja Neta Real (Efectivo Físico)
              </h3>
              <p className="text-xs text-neutro-400">
                Conciliación del efectivo generado en mostrador descontando compras de canales/ganado al camión y egresos menores.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
              {/* Ventas en Efectivo */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">1. Ventas Efectivo (+)</span>
                <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
                  +${CASCADA_CAJA_MOCK.ventasEfectivo.toLocaleString('es-CO')}
                </span>
                <span className="text-[11px] text-emerald-600">Ingreso bruto por mostrador</span>
              </div>

              {/* Inyecciones / Base */}
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider block">2. Fondo Base (+)</span>
                <span className="text-2xl font-black text-blue-700 font-mono mt-1 block">
                  +${CASCADA_CAJA_MOCK.inyeccionesBase.toLocaleString('es-CO')}
                </span>
                <span className="text-[11px] text-blue-600">Base apertura de gaveta</span>
              </div>

              {/* Pago Materia Prima al Camión */}
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
                <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">3. Compra Ganado / Camión (-)</span>
                <span className="text-2xl font-black text-red-700 font-mono mt-1 block">
                  -${CASCADA_CAJA_MOCK.pagosMateriaPrimaCamion.toLocaleString('es-CO')}
                </span>
                <span className="text-[11px] text-red-600">Pago en efectivo a frigoríficos</span>
              </div>

              {/* Gastos Menores */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">4. Gastos Menores (-)</span>
                <span className="text-2xl font-black text-amber-700 font-mono mt-1 block">
                  -${CASCADA_CAJA_MOCK.gastosMenoresOperativos.toLocaleString('es-CO')}
                </span>
                <span className="text-[11px] text-amber-600">Hielo, fletes, bolsas</span>
              </div>

              {/* Efectivo Líquido Real */}
              <div className="p-4 rounded-2xl bg-neutro-900 border border-neutro-800 text-white shadow-lg">
                <span className="text-xs font-extrabold uppercase tracking-wider text-carmin-400 block">Efectivo Líquido (=)</span>
                <span className="text-2xl font-black text-white font-mono mt-1 block">
                  ${CASCADA_CAJA_MOCK.efectivoLiquidoReal.toLocaleString('es-CO')}
                </span>
                <span className="text-[11px] text-neutro-400">Total a encontrar en gaveta</span>
              </div>
            </div>
          </div>

          {/* Radar Financiero de Mermas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
              <h3 className="font-extrabold text-lg text-neutro-900">
                Monetización de Mermas
              </h3>
              <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-center">
                <span className="text-xs font-bold text-red-700 uppercase tracking-wider block">Costo Total Perdido</span>
                <span className="text-4xl font-black text-red-700 font-mono mt-1 block">
                  ${MERMAS_MOCK.totalPerdidaMonetaria.toLocaleString('es-CO')}
                </span>
                <span className="text-xs text-red-600 font-semibold mt-1 block">
                  Equivalente a {MERMAS_MOCK.kilosTotalesPerdidos} kg de carne
                </span>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-semibold text-neutro-700">
                  <span>Evaporación en Cuarto Frío:</span>
                  <span className="font-mono text-red-600 font-bold">${MERMAS_MOCK.distribucionPorMotivo.evaporacion_frio.costo.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-neutro-700">
                  <span>Merma de Desposte / Hueso:</span>
                  <span className="font-mono text-red-600 font-bold">${MERMAS_MOCK.distribucionPorMotivo.desposte_hueso_grasa.costo.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-neutro-700">
                  <span>Caducidad en Vitrina:</span>
                  <span className="font-mono text-red-600 font-bold">${MERMAS_MOCK.distribucionPorMotivo.caducidad.costo.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
              <h3 className="font-extrabold text-lg text-neutro-900">
                Detalle de Registros de Merma del Día
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutro-50 border-b border-neutro-200 text-neutro-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Corte Cárnico</th>
                      <th className="p-3">Motivo</th>
                      <th className="p-3 text-right">Kilos</th>
                      <th className="p-3 text-right">Costo Unitario</th>
                      <th className="p-3 text-right">Pérdida Monetaria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutro-100">
                    {MERMAS_MOCK.items.map((item) => (
                      <tr key={item.id} className="hover:bg-neutro-50/50">
                        <td className="p-3 font-bold text-neutro-900">{item.productoNombre}</td>
                        <td className="p-3 text-neutro-600 capitalize">{item.motivo.replace(/_/g, ' ')}</td>
                        <td className="p-3 text-right font-mono">{item.kilos} kg</td>
                        <td className="p-3 text-right font-mono">${item.costoUnitario.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-bold text-red-600">-${item.costoTotalPerdida.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTENIDO TAB 3: OPERACIÓN DE SEDE & SMART FEFO (GERENTE) ─── */}
      {activeTab === 'smart_fefo' && (
        <div className="space-y-6">
          {/* Smart FEFO Predictivo */}
          <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-xl text-neutro-900 flex items-center gap-2">
                  <Flame size={22} className="text-carmin-600" />
                  Smart FEFO: Prevención Predictiva de Caducidad (&le; 48h)
                </h3>
                <p className="text-xs text-neutro-400">
                  Cruce de tiempo restante de vida útil vs. velocidad de venta para evitar mermas por vencimiento.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SMART_FEFO_MOCK.map((lote) => (
                <div
                  key={lote.loteId}
                  className={cn(
                    'p-5 rounded-3xl border flex flex-col justify-between space-y-3 transition-all',
                    lote.riesgoCaducidad
                      ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                      : 'bg-neutro-50 border-neutro-200'
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/10 font-bold uppercase">
                        {lote.codigoLote}
                      </span>
                      <h4 className="font-extrabold text-base text-neutro-900 mt-1">{lote.productoNombre}</h4>
                    </div>
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded-full font-bold',
                        lote.horasRestantes <= 24 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      Vence en {lote.horasRestantes}h
                    </span>
                  </div>

                  <div className="bg-white/80 p-3 rounded-2xl border border-black/5 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-neutro-500">Saldo en nevera:</span>
                      <span className="font-mono font-bold">{lote.cantidadDisponible} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutro-500">Velocidad de venta:</span>
                      <span className="font-mono font-bold">{lote.velocidadVentaDiariaKg} kg/día</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutro-500">Tiempo para agotar:</span>
                      <span className="font-mono font-bold text-amber-700">~{lote.horasParaAgotar} horas</span>
                    </div>
                  </div>

                  {lote.sugerenciaComercial && (
                    <div className="p-3 rounded-xl bg-amber-200/50 border border-amber-300 text-[11px] font-semibold text-amber-900 flex items-start gap-1.5">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-700" />
                      <span>{lote.sugerenciaComercial}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Monitor de Cartera Fiada */}
          <div className="bg-white p-6 rounded-3xl border border-neutro-200 shadow-sm space-y-4">
            <h3 className="font-extrabold text-lg text-neutro-900 flex items-center gap-2">
              <UserCheck size={20} className="text-carmin-600" />
              Monitor de Cartera Fiada y Riesgo de Crédito
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutro-50 border-b border-neutro-200 text-neutro-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Cliente / Negocio</th>
                    <th className="p-3 text-right">Saldo Pendiente</th>
                    <th className="p-3 text-right">Límite Aprobado</th>
                    <th className="p-3 text-center">Uso de Cupo</th>
                    <th className="p-3 text-center">Estado Mora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutro-100">
                  {CLIENTES_FIADO_MOCK.map((c) => (
                    <tr key={c.clienteId} className="hover:bg-neutro-50/50">
                      <td className="p-3 font-bold text-neutro-900">{c.nombre}</td>
                      <td className="p-3 text-right font-mono font-bold text-carmin-600">
                        ${c.saldoPendiente.toLocaleString('es-CO')}
                      </td>
                      <td className="p-3 text-right font-mono text-neutro-500">
                        ${c.limiteCredito.toLocaleString('es-CO')}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[11px] font-bold',
                            c.alertaLimite80Pct ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {c.porcentajeUso}% cupo {c.alertaLimite80Pct ? '(Crítico >80%)' : ''}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {c.enMora ? (
                          <span className="text-red-600 font-bold">En Mora ({c.diasMora} días)</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold">Al día</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
