import { BarChart3, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutro-900">Dashboard</h1>
        <p className="text-neutro-500 mt-1">
          Resumen operativo y financiero de tu negocio
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutro-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-carmin-100 rounded-xl flex items-center justify-center">
              <DollarSign className="text-carmin-500" size={22} />
            </div>
            <div>
              <p className="text-sm text-neutro-500">Ventas del Día</p>
              <p className="text-xl font-bold text-neutro-900">—</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutro-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-green-600" size={22} />
            </div>
            <div>
              <p className="text-sm text-neutro-500">Margen Bruto</p>
              <p className="text-xl font-bold text-neutro-900">—</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutro-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="text-blue-600" size={22} />
            </div>
            <div>
              <p className="text-sm text-neutro-500">Transacciones</p>
              <p className="text-xl font-bold text-neutro-900">—</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutro-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ambar-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="text-ambar-500" size={22} />
            </div>
            <div>
              <p className="text-sm text-neutro-500">Alertas Lotes</p>
              <p className="text-xl font-bold text-neutro-900">—</p>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder para gráficos futuros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutro-200 min-h-[300px] flex items-center justify-center">
          <p className="text-neutro-400 text-lg">
            📊 Gráfico de ventas por período — Próximamente
          </p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutro-200 min-h-[300px] flex items-center justify-center">
          <p className="text-neutro-400 text-lg">
            🍩 Distribución de pagos — Próximamente
          </p>
        </div>
      </div>
    </div>
  );
}
