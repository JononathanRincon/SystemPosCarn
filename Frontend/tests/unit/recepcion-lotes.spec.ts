import { describe, it, expect } from 'vitest';
import {
  validarRecepcionCamion,
  obtenerSemaforoFEFO,
  RecepcionMercanciaInput,
} from '@/lib/inventory/recepcion-service';

describe('Recepción de Camiones Frigoríficos y Control de Lotes', () => {
  const recepcionValida: RecepcionMercanciaInput = {
    proveedorNombre: 'Frigorífico Guadalupe S.A.',
    numeroGuiaRemision: 'GUIA-2026-9871',
    sucursalId: 'suc-central',
    temperaturaRecepcionCelsius: 3.2, // Cadena de frío adecuada (<= 4.0 °C)
    items: [
      {
        productoId: 'res-1',
        productoNombre: 'Media Res de Primera',
        codigoLote: 'L-GUA-20260908-01',
        cantidadKg: 185.45,
        costoUnitarioKg: 145.0,
        subtotal: 26890.25,
        fechaVencimiento: '2026-09-22T00:00:00.000Z',
      },
      {
        productoId: 'cerdo-1',
        productoNombre: 'Canal de Cerdo',
        codigoLote: 'L-CER-20260908-02',
        cantidadKg: 85.2,
        costoUnitarioKg: 98.0,
        subtotal: 8349.6,
        fechaVencimiento: '2026-09-18T00:00:00.000Z',
      },
    ],
  };

  it('debe validar exitosamente un embarque con temperatura adecuada y calcular costo total', () => {
    const resultado = validarRecepcionCamion(recepcionValida);

    expect(resultado.esValida).toBe(true);
    expect(resultado.alertaTemperatura).toBe(false);
    expect(resultado.mensajeAlertaTemperatura).toBeUndefined();
    expect(resultado.kilosTotalesEmbarque).toBe(270.65);
    // Costo: (185.45 * 145) + (85.2 * 98) = 26890.25 + 8349.6 = 35239.85
    expect(resultado.costoTotalEmbarque).toBe(35239.85);
  });

  it('debe activar alerta sanitaria si la temperatura de recepción es mayor a 4.0°C (EARS-LOTE-05)', () => {
    const recepcionCaliente: RecepcionMercanciaInput = {
      ...recepcionValida,
      temperaturaRecepcionCelsius: 6.8, // Ruptura de frío
    };

    const resultado = validarRecepcionCamion(recepcionCaliente);
    expect(resultado.alertaTemperatura).toBe(true);
    expect(resultado.mensajeAlertaTemperatura).toContain('ALERTA SANITARIA');
    expect(resultado.mensajeAlertaTemperatura).toContain('6.8°C > 4.0°C');
  });

  it('debe rechazar el envío si falta fecha de caducidad o código de lote (EARS-LOTE-01)', () => {
    const recepcionIncompleta: RecepcionMercanciaInput = {
      ...recepcionValida,
      items: [
        {
          productoId: 'res-1',
          productoNombre: 'Media Res',
          codigoLote: '', // Faltante
          cantidadKg: 100.0,
          costoUnitarioKg: 140.0,
          subtotal: 14000.0,
          fechaVencimiento: '', // Faltante
        },
      ],
    };

    const resultado = validarRecepcionCamion(recepcionIncompleta);
    expect(resultado.esValida).toBe(false);
    expect(resultado.errores.some((e) => e.includes('código de lote'))).toBe(true);
    expect(resultado.errores.some((e) => e.includes('fecha de caducidad'))).toBe(true);
  });

  describe('Semáforo FEFO de Lotes Activos (EARS-LOTE-03)', () => {
    const ahora = new Date('2026-09-08T12:00:00.000Z');

    it('debe asignar "verde" a lotes con más de 3 días de vida útil', () => {
      const fechaVenc = new Date('2026-09-15T12:00:00.000Z'); // 7 días
      expect(obtenerSemaforoFEFO(fechaVenc, 50.0, ahora)).toBe('verde');
    });

    it('debe asignar "ambar" a lotes próximos a vencer dentro de los próximos 3 días (EARS-LOTE-03)', () => {
      const fechaVenc = new Date('2026-09-10T12:00:00.000Z'); // 2 días
      expect(obtenerSemaforoFEFO(fechaVenc, 25.0, ahora)).toBe('ambar');
    });

    it('debe asignar "rojo" a lotes vencidos o con cantidad 0', () => {
      const fechaAyer = new Date('2026-09-07T12:00:00.000Z'); // Ayer
      expect(obtenerSemaforoFEFO(fechaAyer, 20.0, ahora)).toBe('rojo');

      const fechaFutura = new Date('2026-09-20T12:00:00.000Z');
      expect(obtenerSemaforoFEFO(fechaFutura, 0.0, ahora)).toBe('rojo');
    });
  });
});
