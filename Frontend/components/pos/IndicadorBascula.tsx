'use client';

import React, { useState } from 'react';
import {
  Scale,
  RotateCcw,
  Sliders,
  AlertTriangle,
  Radio,
  Usb,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useScale } from '@/lib/hardware/use-scale';

export function IndicadorBascula() {
  const {
    weightKg,
    isStable,
    isConnected,
    isMock,
    isSignalLost,
    connectWebSerial,
    connectMock,
    zero,
    tare,
    setSimulatedWeight,
  } = useScale();

  const [showSimControls, setShowSimControls] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between bg-neutro-950 border border-neutro-800 rounded-2xl px-4 py-2.5 gap-3 shadow-md">
      {/* Visualizador de Peso en Vivo */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
              isSignalLost
                ? 'bg-red-500/20 text-red-400 animate-pulse'
                : isStable
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400 animate-pulse'
            )}
          >
            <Scale size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase text-neutro-400">
                Báscula de Mostrador
              </span>
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                  isSignalLost
                    ? 'bg-red-500/30 text-red-400'
                    : isStable
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                )}
              >
                {isSignalLost ? 'SIN SEÑAL' : isStable ? 'ESTABLE' : 'MOVIMIENTO'}
              </span>
            </div>

            {/* Display Gigante de Peso */}
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={cn(
                  'font-mono text-3xl sm:text-4xl font-extrabold tracking-tight',
                  isSignalLost
                    ? 'text-red-400'
                    : weightKg > 0
                    ? 'text-white'
                    : 'text-neutro-400'
                )}
              >
                {weightKg.toFixed(3)}
              </span>
              <span className="text-sm font-bold text-neutro-400">kg</span>
            </div>
          </div>
        </div>

        {/* Alerta de Caso Límite 1: Pérdida de Señal */}
        {isSignalLost && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs font-semibold animate-pulse">
            <AlertTriangle size={16} />
            <span>Pérdida de señal serial con la báscula</span>
          </div>
        )}
      </div>

      {/* Controles de Báscula (Cero, Tara, Hardware) */}
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Botón TARA */}
        <button
          type="button"
          onClick={() => tare()}
          title="Tarar peso actual (recipiente)"
          className="min-h-touch px-4 rounded-xl bg-neutro-800 hover:bg-neutro-700 active:scale-95 text-xs font-bold text-white border border-neutro-700 transition-all flex items-center gap-1.5"
        >
          <Sliders size={16} className="text-amber-400" />
          <span>TARA</span>
        </button>

        {/* Botón CERO */}
        <button
          type="button"
          onClick={() => zero()}
          title="Restablecer platillo a 0.000 kg"
          className="min-h-touch px-4 rounded-xl bg-neutro-800 hover:bg-neutro-700 active:scale-95 text-xs font-bold text-white border border-neutro-700 transition-all flex items-center gap-1.5"
        >
          <RotateCcw size={16} className="text-carmin-400" />
          <span>CERO</span>
        </button>

        {/* Conectar Web Serial o Simulador */}
        {isMock ? (
          <button
            type="button"
            onClick={async () => {
              const ok = await connectWebSerial();
              if (!ok) {
                alert('No se pudo conectar a la báscula serial. Asegúrese de que el navegador soporte Web Serial y que el cable USB/Serial esté conectado.');
              }
            }}
            className="min-h-touch px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-medium text-neutral-300 transition-all flex items-center gap-1.5"
            title="Conectar báscula física USB / Web Serial"
          >
            <Usb size={16} className="text-blue-400" />
            <span className="hidden md:inline">Báscula USB</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => connectMock()}
            className="min-h-touch px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-medium text-neutral-300 transition-all flex items-center gap-1.5"
            title="Cambiar a modo Simulador"
          >
            <Radio size={16} className="text-emerald-400" />
            <span className="hidden md:inline">Modo Simulador</span>
          </button>
        )}

        {/* Botón para desplegar pesos rápidos de simulación */}
        {isMock && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSimControls(!showSimControls)}
              className="min-h-touch px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1"
            >
              <span>+ Pesar</span>
            </button>

            {showSimControls && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-neutro-900 border border-neutro-700 rounded-2xl p-2 shadow-2xl z-40 space-y-1">
                <div className="text-[10px] font-bold text-neutro-400 px-2 py-1 uppercase">
                  Simular peso en platillo:
                </div>
                {[0.5, 1.0, 1.25, 1.75, 2.5, 3.0].map((kg) => (
                  <button
                    key={kg}
                    type="button"
                    onClick={() => {
                      setSimulatedWeight(kg, true);
                      setShowSimControls(false);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-carmin-600 transition-colors flex justify-between"
                  >
                    <span>{kg.toFixed(3)} kg</span>
                    <span className="text-neutro-400">Pesar</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedWeight(0.0, true);
                    setShowSimControls(false);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:bg-neutro-800 transition-colors"
                >
                  Vaciar platillo (0.000 kg)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
