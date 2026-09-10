'use client';

import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  User,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '@/lib/api/api-client';

export interface DispositivoPOS {
  id: string;
  nombreAlias: string;
  sucursalId: string;
  modelo: string;
  sistemaOperativo: string;
  ultimoLatido: string;
  activo: boolean;
  ventasPendientesSync?: number;
  cajeroTurnoActivo?: string | null;
}

const TERMINALES_INICIALES: DispositivoPOS[] = [
  {
    id: 'caja-mostrador-01',
    nombreAlias: 'Tablet Mostrador 01',
    sucursalId: 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
    modelo: 'Samsung Galaxy Tab A8',
    sistemaOperativo: 'Android 13',
    ultimoLatido: new Date().toISOString(),
    activo: true,
    ventasPendientesSync: 0,
    cajeroTurnoActivo: 'Carlos Morales (Cajero)',
  },
  {
    id: 'caja-mostrador-02',
    nombreAlias: 'Tablet Mostrador 02',
    sucursalId: 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
    modelo: 'iPad 10.2"',
    sistemaOperativo: 'iPadOS 16',
    ultimoLatido: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    activo: true,
    ventasPendientesSync: 4,
    cajeroTurnoActivo: 'María Rojas (Auxiliar)',
  },
  {
    id: 'pc-caja-central',
    nombreAlias: 'PC Mostrador Principal',
    sucursalId: 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
    modelo: 'All-in-One Touch',
    sistemaOperativo: 'Windows 11 POS',
    ultimoLatido: new Date().toISOString(),
    activo: true,
    ventasPendientesSync: 0,
    cajeroTurnoActivo: 'Pedro Dueño (Admin)',
  },
];

export default function TerminalesPage() {
  const [terminales, setTerminales] = useState<DispositivoPOS[]>(TERMINALES_INICIALES);
  const [cargando, setCargando] = useState<boolean>(false);
  const [confirmarRevocacion, setConfirmarRevocacion] = useState<DispositivoPOS | null>(null);
  const [notificacion, setNotificacion] = useState<string | null>(null);

  const cargarTerminales = async () => {
    setCargando(true);
    try {
      const data = await apiClient.get<DispositivoPOS[]>('/devices');
      if (Array.isArray(data) && data.length > 0) {
        setTerminales(data);
      }
    } catch {
      // Mantiene datos locales
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTerminales();
  }, []);

  const handleRevocar = async (id: string) => {
    try {
      await apiClient.patch(`/devices/${id}/revoke`);
      setTerminales((prev) =>
        prev.map((t) => (t.id === id ? { ...t, activo: false } : t))
      );
      setNotificacion(`Acceso revocado exitosamente para ${confirmarRevocacion?.nombreAlias}`);
    } catch {
      setTerminales((prev) =>
        prev.map((t) => (t.id === id ? { ...t, activo: false } : t))
      );
      setNotificacion(`Terminal revocada localmente`);
    } finally {
      setConfirmarRevocacion(null);
      setTimeout(() => setNotificacion(null), 3500);
    }
  };

  const getIconoDispositivo = (os: string) => {
    const lower = os.toLowerCase();
    if (lower.includes('android') || lower.includes('ipad')) {
      return <Tablet className="text-carmin-500" size={24} />;
    }
    if (lower.includes('phone') || lower.includes('ios')) {
      return <Smartphone className="text-carmin-500" size={24} />;
    }
    return <Monitor className="text-carmin-500" size={24} />;
  };

  const calcularTiempoTranscurrido = (isoDate: string) => {
    const diffMin = Math.round((Date.now() - new Date(isoDate).getTime()) / 60000);
    if (diffMin < 2) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    return `Hace ${Math.round(diffMin / 60)} horas`;
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-neutro-200">
        <div>
          <h1 className="text-2xl font-bold text-neutro-900 flex items-center gap-2">
            <Smartphone className="text-carmin-500" />
            Gestión y Auditoría de Terminales POS
          </h1>
          <p className="text-sm text-neutro-500 mt-1">
            Supervisión en tiempo real de tablets, celulares y computadores de mostrador
          </p>
        </div>

        <button
          onClick={cargarTerminales}
          disabled={cargando}
          className="flex items-center gap-2 px-4 py-2.5 bg-neutro-100 hover:bg-neutro-200 text-neutro-700 font-medium rounded-xl transition-colors"
        >
          <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
          Actualizar Estado
        </button>
      </div>

      {/* Alerta de feedback */}
      {notificacion && (
        <div className="p-4 rounded-xl bg-verde-50 border border-verde-200 text-verde-800 text-sm font-medium flex items-center gap-2">
          <CheckCircle size={18} />
          {notificacion}
        </div>
      )}

      {/* Grid de Dispositivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {terminales.map((term) => {
          const tienePendientes = (term.ventasPendientesSync || 0) > 0;
          return (
            <div
              key={term.id}
              className={`bg-white rounded-2xl border p-6 shadow-sm flex flex-col justify-between transition-all ${
                !term.activo
                  ? 'border-neutro-300 opacity-60 bg-neutro-50'
                  : tienePendientes
                  ? 'border-amber-300 ring-1 ring-amber-200'
                  : 'border-neutro-200 hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-carmin-50 rounded-xl">
                    {getIconoDispositivo(term.sistemaOperativo)}
                  </div>
                  {/* Badge de estado */}
                  <div>
                    {!term.activo ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutro-200 text-neutro-700">
                        <XCircle size={13} />
                        Revocada
                      </span>
                    ) : tienePendientes ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        <AlertTriangle size={13} />
                        {term.ventasPendientesSync} offline
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-verde-100 text-verde-800">
                        <CheckCircle size={13} />
                        Sincronizada
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-neutro-900">{term.nombreAlias}</h3>
                <p className="text-xs text-neutro-500 font-medium mt-0.5">
                  {term.modelo} • {term.sistemaOperativo}
                </p>

                <div className="mt-5 space-y-2.5 text-xs text-neutro-600 border-t border-neutro-100 pt-4">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-neutro-400" />
                    <span>
                      Turno:{' '}
                      <strong className="text-neutro-800">
                        {term.cajeroTurnoActivo || 'Sin turno abierto'}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-neutro-400" />
                    <span>
                      Último latido:{' '}
                      <strong className="text-neutro-800">
                        {calcularTiempoTranscurrido(term.ultimoLatido)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-neutro-100 flex justify-end">
                {term.activo ? (
                  <button
                    onClick={() => setConfirmarRevocacion(term)}
                    className="text-xs font-semibold text-carmin-600 hover:text-carmin-700 hover:underline flex items-center gap-1"
                  >
                    <ShieldAlert size={14} />
                    Revocar Acceso
                  </button>
                ) : (
                  <span className="text-xs text-neutro-400 italic">Dispositivo desvinculado</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Confirmar Revocación */}
      {confirmarRevocacion && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-neutro-200">
            <div className="w-12 h-12 rounded-full bg-carmin-100 text-carmin-600 flex items-center justify-center mb-4">
              <ShieldAlert size={24} />
            </div>
            <h3 className="text-lg font-bold text-neutro-900">
              ¿Revocar acceso a esta terminal?
            </h3>
            <p className="text-sm text-neutro-500 mt-2">
              Se desactivará el token de{' '}
              <strong>{confirmarRevocacion.nombreAlias}</strong>. El cajero no podrá
              seguir sincronizando ventas hasta que sea re-vinculado.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmarRevocacion(null)}
                className="px-4 py-2 text-sm text-neutro-600 hover:bg-neutro-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRevocar(confirmarRevocacion.id)}
                className="px-4 py-2 text-sm bg-carmin-600 hover:bg-carmin-700 text-white font-medium rounded-xl shadow"
              >
                Confirmar Revocación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
