import { describe, it, expect } from 'vitest';
import {
  calcularMargenBrutoPonderado,
  calcularBenchmarkingSucursales,
  calcularCascadaCaja,
  monetizarMermas,
  analizarSmartFEFO,
  evaluarCarteraFiada,
} from '@/lib/analytics/dashboard-data';

describe('Dashboard Analytics & Meat Financial Metrics', () => {
  describe('Cálculo de Margen Bruto Real Ponderado (US-17)', () => {
    it('debe calcular el margen bruto ponderado real considerando costo del lote vs precio de venta', () => {
      const items = [
        // 100 kg de Arrachera: Venta $260, Costo Lote $180 -> Ganancia $80/kg = $8,000
        { cantidad: 100, precioVenta: 260.0, costoLote: 180.0 },
        // 200 kg de Bistec: Venta $195, Costo Lote $150 -> Ganancia $45/kg = $9,000
        { cantidad: 200, precioVenta: 195.0, costoLote: 150.0 },
      ];
      // Total Venta = 26,000 + 39,000 = 65,000
      // Total Costo = 18,000 + 30,000 = 48,000
      // Ganancia = 17,000 -> Margen = (17,000 / 65,000) * 100 = 26.1538% -> 26.15%

      const margen = calcularMargenBrutoPonderado(items);
      expect(margen).toBe(26.15);
    });

    it('debe retornar 0 si no hay items o si la venta es 0', () => {
      expect(calcularMargenBrutoPonderado([])).toBe(0);
      expect(calcularMargenBrutoPonderado([{ cantidad: 0, precioVenta: 0, costoLote: 100 }])).toBe(0);
    });
  });

  describe('Benchmarking de Sucursales y Detección de Desposte Ineficiente', () => {
    it('debe alertar si una sucursal tiene un margen >= 5% por debajo del promedio de la cadena', () => {
      const sedes = [
        { sucursalId: 'sede-1', nombre: 'Sede Norte', ventas: 150000, margenPct: 28.0 },
        { sucursalId: 'sede-2', nombre: 'Sede Centro', ventas: 220000, margenPct: 29.0 },
        { sucursalId: 'sede-3', nombre: 'Sede Sur', ventas: 90000, margenPct: 21.0 }, // Promedio ~26.0%, Sur tiene -5.0%
      ];
      // Promedio = (28 + 29 + 21) / 3 = 26.0%
      // Sede Sur: 21.0 - 26.0 = -5.0% -> alertaDesposte: true

      const resultado = calcularBenchmarkingSucursales(sedes);
      expect(resultado.length).toBe(3);

      const sedeSur = resultado.find((s) => s.sucursalId === 'sede-3');
      expect(sedeSur).toBeDefined();
      expect(sedeSur!.desviacionPct).toBe(-5.0);
      expect(sedeSur!.alertaDesposte).toBe(true);

      const sedeCentro = resultado.find((s) => s.sucursalId === 'sede-2');
      expect(sedeCentro!.alertaDesposte).toBe(false);
    });
  });

  describe('Cascada de Flujo de Caja Real en Gaveta', () => {
    it('debe calcular el efectivo líquido neto deduciendo compras a camiones y gastos menores', () => {
      const params = {
        ventasEfectivo: 850000.0,
        inyeccionesBase: 200000.0,
        pagosMateriaPrimaCamion: 450000.0, // Pago de media res al camión
        gastosMenoresOperativos: 35000.0, // Bolsas, hielo, fletes
      };
      // Efectivo Líquido = 850,000 + 200,000 - 450,000 - 35,000 = 565,000

      const cascada = calcularCascadaCaja(params);
      expect(cascada.efectivoLiquidoReal).toBe(565000.0);
    });
  });

  describe('Monetización de Mermas y Pérdidas', () => {
    it('debe monetizar cada merma multiplicando kilos por costo unitario y agrupar por motivo', () => {
      const mermas = [
        {
          id: 'm-1',
          productoNombre: 'Costilla de Cerdo',
          kilos: 3.5,
          costoUnitario: 110.0,
          motivo: 'caducidad' as const,
          fecha: '2026-09-08',
        },
        {
          id: 'm-2',
          productoNombre: 'Canal de Res',
          kilos: 5.0,
          costoUnitario: 140.0,
          motivo: 'evaporacion_frio' as const,
          fecha: '2026-09-08',
        },
      ];
      // Costo m-1: 3.5 * 110 = 385.0
      // Costo m-2: 5.0 * 140 = 700.0
      // Total Pérdida: 1,085.0

      const res = monetizarMermas(mermas);
      expect(res.totalPerdidaMonetaria).toBe(1085.0);
      expect(res.kilosTotalesPerdidos).toBe(8.5);
      expect(res.distribucionPorMotivo.caducidad.costo).toBe(385.0);
      expect(res.distribucionPorMotivo.evaporacion_frio.costo).toBe(700.0);
    });
  });

  describe('Algoritmo Predictivo Smart FEFO (Prevención de Caducidad <= 48h)', () => {
    it('debe detectar lotes en riesgo de caducidad proyectando velocidad de venta vs tiempo restante', () => {
      const ahora = new Date('2026-09-08T10:00:00.000Z');
      const lotes = [
        {
          loteId: 'lote-1',
          productoNombre: 'Pechuga de Pollo',
          codigoLote: 'POL-001',
          cantidadDisponible: 50.0, // 50 kg disponibles
          fechaVencimiento: new Date('2026-09-09T10:00:00.000Z'), // Vence en 24h
          velocidadVentaDiariaKg: 20.0, // Vende 20 kg/día -> necesitaría 60 horas para agotar 50kg
        },
        {
          loteId: 'lote-2',
          productoNombre: 'Lomo de Cerdo',
          codigoLote: 'CER-002',
          cantidadDisponible: 10.0,
          fechaVencimiento: new Date('2026-09-09T10:00:00.000Z'), // Vence en 24h
          velocidadVentaDiariaKg: 30.0, // Vende 30 kg/día -> se agota en 8h (sin riesgo)
        },
      ];

      const resultado = analizarSmartFEFO(lotes, ahora);
      const lotePollo = resultado.find((l) => l.loteId === 'lote-1');
      const loteCerdo = resultado.find((l) => l.loteId === 'lote-2');

      expect(lotePollo!.horasRestantes).toBe(24);
      expect(lotePollo!.riesgoCaducidad).toBe(true);
      expect(lotePollo!.sugerenciaComercial).toContain('Riesgo crítico');

      expect(loteCerdo!.riesgoCaducidad).toBe(false);
    });
  });

  describe('Evaluación de Cartera Fiada y Alertas de Límite (80%)', () => {
    it('debe activar alerta si un cliente supera el 80% de su límite de crédito', () => {
      const clientes = [
        { clienteId: 'c-1', nombre: 'Restaurante Doña Rosa', saldoPendiente: 850.0, limiteCredito: 1000.0, diasMora: 0 },
        { clienteId: 'c-2', nombre: 'Asadero Central', saldoPendiente: 300.0, limiteCredito: 1000.0, diasMora: 5 },
      ];

      const evaluados = evaluarCarteraFiada(clientes);
      expect(evaluados[0].porcentajeUso).toBe(85);
      expect(evaluados[0].alertaLimite80Pct).toBe(true);
      expect(evaluados[0].enMora).toBe(false);

      expect(evaluados[1].porcentajeUso).toBe(30);
      expect(evaluados[1].alertaLimite80Pct).toBe(false);
      expect(evaluados[1].enMora).toBe(true);
    });
  });
});
