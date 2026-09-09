/**
 * Módulo de Analítica Financiera y Cárnica para Dashboards Ejecutivos
 * Cumple con requisitos US-13, US-14, US-17, EARS-DASH-01, EARS-DASH-02, EARS-DASH-03
 */

export interface MetricasDueño {
  ventasHoy: number;
  ventasAyer: number;
  deltaVentasPct: number;
  margenBrutoPonderadoPct: number;
  kilosTotalesDespachados: {
    total: number;
    res: number;
    cerdo: number;
    pollo: number;
    embutidos: number;
    otros: number;
  };
  ticketPromedio: number;
  transaccionesCount: number;
  syncTimestamp: string; // ISO string obligatorio (EARS-DASH-01)
  desglosePagos: {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    creditoFiado: number;
  };
  sucursalesBenchmarking: SucursalBenchmark[];
  topCortesMargen: TopCorte[];
}

export interface SucursalBenchmark {
  sucursalId: string;
  nombre: string;
  ventas: number;
  margenPct: number;
  desviacionPct: number;
  alertaDesposte: boolean; // Alerta si margenPct <= promedio - 5.0%
}

export interface TopCorte {
  productoId: string;
  nombre: string;
  kilosVendidos: number;
  precioVentaPromedio: number;
  costoLotePromedio: number;
  margenMonetario: number;
  margenPct: number;
}

export interface FlujoCajaCascada {
  ventasEfectivo: number;
  inyeccionesBase: number;
  pagosMateriaPrimaCamion: number;
  gastosMenoresOperativos: number;
  efectivoLiquidoReal: number; // ventas + inyecciones - pagosMateriaPrima - gastosMenores
}

export interface MermaMonetizadaItem {
  id: string;
  productoNombre: string;
  kilos: number;
  costoUnitario: number;
  costoTotalPerdida: number; // kilos * costoUnitario
  motivo: 'caducidad' | 'evaporacion_frio' | 'desposte_hueso_grasa' | 'dano_manipulacion';
  fecha: string;
}

export interface LoteSmartFEFO {
  loteId: string;
  productoNombre: string;
  codigoLote: string;
  cantidadDisponible: number;
  fechaVencimiento: string;
  horasRestantes: number;
  velocidadVentaDiariaKg: number;
  horasParaAgotar: number;
  riesgoCaducidad: boolean;
  sugerenciaComercial?: string;
}

export interface CarteraClienteFiado {
  clienteId: string;
  nombre: string;
  saldoPendiente: number;
  limiteCredito: number;
  porcentajeUso: number;
  enMora: boolean;
  diasMora: number;
  alertaLimite80Pct: boolean;
}

/**
 * Calcula el Margen Bruto Ponderado Real (%) a partir de ventas efectivas
 * y costo de compra por lote (US-17).
 * Margen % = ((Venta Total - Costo Total) / Venta Total) * 100
 */
export function calcularMargenBrutoPonderado(
  items: Array<{ cantidad: number; precioVenta: number; costoLote: number }>
): number {
  if (!items || items.length === 0) return 0;

  const totalVenta = items.reduce((acc, i) => acc + i.cantidad * i.precioVenta, 0);
  const totalCosto = items.reduce((acc, i) => acc + i.cantidad * i.costoLote, 0);

  if (totalVenta <= 0) return 0;
  const margen = ((totalVenta - totalCosto) / totalVenta) * 100;
  return Math.round(margen * 100) / 100;
}

/**
 * Evalúa las sucursales comparándolas con el promedio de la cadena.
 * Si una sede está >= 5% por debajo del promedio, se marca alerta de desposte/merma oculta.
 */
export function calcularBenchmarkingSucursales(
  sedes: Array<{ sucursalId: string; nombre: string; ventas: number; margenPct: number }>
): SucursalBenchmark[] {
  if (sedes.length === 0) return [];

  const promedioMargen =
    sedes.reduce((acc, s) => acc + s.margenPct, 0) / sedes.length;

  return sedes.map((sede) => {
    const desviacion = Math.round((sede.margenPct - promedioMargen) * 100) / 100;
    const alertaDesposte = desviacion <= -5.0; // 5% o más por debajo del promedio
    return {
      ...sede,
      desviacionPct: desviacion,
      alertaDesposte,
    };
  });
}

/**
 * Calcula el Flujo de Cascada de Efectivo Líquido Real en Gaveta:
 * Ventas en Efectivo (+) + Inyecciones (+) - Compras Materia Prima (-) - Gastos Menores (-)
 */
export function calcularCascadaCaja(params: {
  ventasEfectivo: number;
  inyeccionesBase: number;
  pagosMateriaPrimaCamion: number;
  gastosMenoresOperativos: number;
}): FlujoCajaCascada {
  const {
    ventasEfectivo,
    inyeccionesBase,
    pagosMateriaPrimaCamion,
    gastosMenoresOperativos,
  } = params;

  const efectivoLiquidoReal = Math.round(
    (ventasEfectivo + inyeccionesBase - pagosMateriaPrimaCamion - gastosMenoresOperativos) * 100
  ) / 100;

  return {
    ventasEfectivo,
    inyeccionesBase,
    pagosMateriaPrimaCamion,
    gastosMenoresOperativos,
    efectivoLiquidoReal,
  };
}

/**
 * Monetiza el costo de las mermas registradas: kilos * costo unitario.
 */
export function monetizarMermas(
  mermas: Array<{
    id: string;
    productoNombre: string;
    kilos: number;
    costoUnitario: number;
    motivo: 'caducidad' | 'evaporacion_frio' | 'desposte_hueso_grasa' | 'dano_manipulacion';
    fecha: string;
  }>
): {
  items: MermaMonetizadaItem[];
  totalPerdidaMonetaria: number;
  kilosTotalesPerdidos: number;
  distribucionPorMotivo: Record<string, { kilos: number; costo: number }>;
} {
  let totalPerdidaMonetaria = 0;
  let kilosTotalesPerdidos = 0;
  const distribucion: Record<string, { kilos: number; costo: number }> = {
    caducidad: { kilos: 0, costo: 0 },
    evaporacion_frio: { kilos: 0, costo: 0 },
    desposte_hueso_grasa: { kilos: 0, costo: 0 },
    dano_manipulacion: { kilos: 0, costo: 0 },
  };

  const items: MermaMonetizadaItem[] = mermas.map((m) => {
    const costoTotalPerdida = Math.round(m.kilos * m.costoUnitario * 100) / 100;
    totalPerdidaMonetaria += costoTotalPerdida;
    kilosTotalesPerdidos += m.kilos;

    if (distribucion[m.motivo]) {
      distribucion[m.motivo].kilos += m.kilos;
      distribucion[m.motivo].costo += costoTotalPerdida;
    }

    return {
      ...m,
      costoTotalPerdida,
    };
  });

  return {
    items,
    totalPerdidaMonetaria: Math.round(totalPerdidaMonetaria * 100) / 100,
    kilosTotalesPerdidos: Math.round(kilosTotalesPerdidos * 1000) / 1000,
    distribucionPorMotivo: distribucion,
  };
}

/**
 * Algoritmo Predictivo Smart FEFO para Alerta de Lotes Próximos a Vencer (<= 48h).
 * Proyecta si con la velocidad de venta diaria se agotará o habrá excedente caducado.
 */
export function analizarSmartFEFO(
  lotes: Array<{
    loteId: string;
    productoNombre: string;
    codigoLote: string;
    cantidadDisponible: number;
    fechaVencimiento: string | Date;
    velocidadVentaDiariaKg: number;
  }>,
  ahora: Date = new Date()
): LoteSmartFEFO[] {
  return lotes
    .map((lote) => {
      const fechaVenc =
        lote.fechaVencimiento instanceof Date
          ? lote.fechaVencimiento
          : new Date(lote.fechaVencimiento);

      const diffMs = fechaVenc.getTime() - ahora.getTime();
      const horasRestantes = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));

      // Horas estimadas para agotar según velocidad diaria
      // velocidadVentaDiariaKg = kg/24h -> kg/h = velocidad / 24
      const kgPorHora = lote.velocidadVentaDiariaKg > 0 ? lote.velocidadVentaDiariaKg / 24 : 0.1;
      const horasParaAgotar = Math.round(lote.cantidadDisponible / kgPorHora);

      // Si vence en <= 48h y las horas para agotar superan las horas restantes -> riesgo
      const riesgoCaducidad = horasRestantes <= 48 && horasParaAgotar > horasRestantes;

      let sugerenciaComercial: string | undefined;
      if (riesgoCaducidad) {
        sugerenciaComercial =
          horasRestantes <= 24
            ? 'Riesgo crítico: Procesar inmediatamente para carne molida / embutidos o aplicar 30% descuento en mostrador'
            : 'Riesgo moderado: Promocionar en mostrador con descuento sugerido del 15% o exhibición destacada';
      }

      return {
        loteId: lote.loteId,
        productoNombre: lote.productoNombre,
        codigoLote: lote.codigoLote,
        cantidadDisponible: lote.cantidadDisponible,
        fechaVencimiento: fechaVenc.toISOString(),
        horasRestantes,
        velocidadVentaDiariaKg: lote.velocidadVentaDiariaKg,
        horasParaAgotar,
        riesgoCaducidad,
        sugerenciaComercial,
      };
    })
    .sort((a, b) => a.horasRestantes - b.horasRestantes);
}

/**
 * Valida el estado de cartera fiada y emite alertas si el cliente excede el 80% de su límite.
 */
export function evaluarCarteraFiada(
  clientes: Array<{
    clienteId: string;
    nombre: string;
    saldoPendiente: number;
    limiteCredito: number;
    diasMora: number;
  }>
): CarteraClienteFiado[] {
  return clientes.map((c) => {
    const porcentajeUso =
      c.limiteCredito > 0 ? Math.round((c.saldoPendiente / c.limiteCredito) * 100) : 100;
    const alertaLimite80Pct = porcentajeUso >= 80;
    const enMora = c.diasMora > 0;

    return {
      ...c,
      porcentajeUso,
      enMora,
      alertaLimite80Pct,
    };
  });
}
