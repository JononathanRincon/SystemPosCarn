/**
 * Servicio de Recepción de Mercancía de Camiones Frigoríficos y Gestión de Lotes
 * Cumple con requisitos EARS-LOTE-01, EARS-LOTE-03, EARS-LOTE-05 y US-15.
 */

export interface ItemRecepcion {
  productoId: string;
  productoNombre: string;
  codigoLote: string;
  cantidadKg: number; // decimal(10,3)
  costoUnitarioKg: number;
  subtotal: number;
  fechaVencimiento: string; // ISO string obligatoria
}

export interface RecepcionMercanciaInput {
  proveedorNombre: string;
  numeroGuiaRemision: string;
  sucursalId: string;
  temperaturaRecepcionCelsius: number;
  observaciones?: string;
  items: ItemRecepcion[];
}

export interface ValidacionRecepcionResult {
  esValida: boolean;
  alertaTemperatura: boolean;
  mensajeAlertaTemperatura?: string;
  costoTotalEmbarque: number;
  kilosTotalesEmbarque: number;
  errores: string[];
}

/**
 * Valida la recepción de un camión frigorífico y calcula los totales consolidados.
 */
export function validarRecepcionCamion(
  recepcion: RecepcionMercanciaInput
): ValidacionRecepcionResult {
  const errores: string[] = [];

  if (!recepcion.proveedorNombre || recepcion.proveedorNombre.trim() === '') {
    errores.push('El nombre del proveedor es obligatorio.');
  }

  if (!recepcion.numeroGuiaRemision || recepcion.numeroGuiaRemision.trim() === '') {
    errores.push('El número de guía o remisión es obligatorio.');
  }

  if (!recepcion.items || recepcion.items.length === 0) {
    errores.push('Debe registrar al menos un corte cárnico en el embarque.');
  }

  let costoTotalEmbarque = 0;
  let kilosTotalesEmbarque = 0;

  recepcion.items.forEach((item, index) => {
    const idx = index + 1;
    if (!item.productoId) {
      errores.push(`Línea ${idx}: Debe seleccionar un producto.`);
    }

    if (!item.codigoLote || item.codigoLote.trim() === '') {
      errores.push(`Línea ${idx} (${item.productoNombre || 'Producto'}): El código de lote es obligatorio (EARS-LOTE-01).`);
    }

    if (!item.fechaVencimiento || item.fechaVencimiento.trim() === '') {
      errores.push(`Línea ${idx} (${item.productoNombre || 'Producto'}): La fecha de caducidad es obligatoria (EARS-LOTE-01).`);
    } else {
      const fecha = new Date(item.fechaVencimiento);
      if (isNaN(fecha.getTime())) {
        errores.push(`Línea ${idx}: Fecha de caducidad inválida.`);
      }
    }

    if (!item.cantidadKg || item.cantidadKg <= 0) {
      errores.push(`Línea ${idx}: La cantidad en kilogramos debe ser mayor a 0.000 kg.`);
    }

    if (!item.costoUnitarioKg || item.costoUnitarioKg < 0) {
      errores.push(`Línea ${idx}: El costo unitario no puede ser negativo.`);
    }

    const subtotalCalculado = Math.round(item.cantidadKg * item.costoUnitarioKg * 100) / 100;
    costoTotalEmbarque += subtotalCalculado;
    kilosTotalesEmbarque += item.cantidadKg;
  });

  // Control estricto de frío (EARS-LOTE-05):
  // La carne refrigerada debe recibirse a <= 4.0 °C
  const alertaTemperatura = recepcion.temperaturaRecepcionCelsius > 4.0;
  const mensajeAlertaTemperatura = alertaTemperatura
    ? `¡ALERTA SANITARIA: Ruptura de cadena de frío detectada (${recepcion.temperaturaRecepcionCelsius}°C > 4.0°C)! Exige verificación antes de aceptar el camión.`
    : undefined;

  return {
    esValida: errores.length === 0,
    alertaTemperatura,
    mensajeAlertaTemperatura,
    costoTotalEmbarque: Math.round(costoTotalEmbarque * 100) / 100,
    kilosTotalesEmbarque: Math.round(kilosTotalesEmbarque * 1000) / 1000,
    errores,
  };
}

/**
 * Determina el estado del semáforo FEFO para un lote (EARS-LOTE-03).
 * - 'verde': Vigente con más de 3 días de vida útil.
 * - 'ambar': Próximo a vencer (<= 3 días calendario).
 * - 'rojo': Vencido o cantidad disponible en 0.
 */
export function obtenerSemaforoFEFO(
  fechaVencimiento: string | Date,
  cantidadDisponible: number,
  ahora: Date = new Date()
): 'verde' | 'ambar' | 'rojo' {
  if (cantidadDisponible <= 0) return 'rojo';

  const fechaVenc =
    fechaVencimiento instanceof Date ? fechaVencimiento : new Date(fechaVencimiento);
  const diffMs = fechaVenc.getTime() - ahora.getTime();
  const diasRestantes = diffMs / (1000 * 60 * 60 * 24);

  if (diasRestantes < 0) return 'rojo'; // Ya vencido
  if (diasRestantes <= 3) return 'ambar'; // Próximo a vencer (<= 3 días)
  return 'verde'; // En fecha
}
