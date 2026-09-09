/**
 * Lógica del Carrito y Ventas del POS
 * Cumple con EARS-VENTA-01 a EARS-VENTA-04, US-02, US-03, US-04 y Casos Límite 1 y 2.
 */

import { ProductoLocal } from '@/lib/db/pos-database';
import { encolarVentaOutbox } from '@/lib/db/repos/venta-outbox-repo';

export interface CartItem {
  id: string; // Identificador único de línea en el carrito
  productoId: string;
  nombre: string;
  tipoVenta: 'peso' | 'unidad';
  cantidad: number; // Kilogramos a 3 decimales o piezas enteras
  unidadMedida: string;
  precioUnitario: number;
  subtotal: number; // Redondeado a 2 decimales monetarios
}

export interface PagoVentaInput {
  metodo: 'efectivo' | 'tarjeta' | 'transferencia';
  monto: number;
}

export interface ValidacionPagoResult {
  esValido: boolean;
  total: number;
  totalPagado: number;
  faltante: number;
  cambio: number;
  mensajeError?: string;
}

/**
 * Calcula el subtotal exacto de una línea redondeando a 2 decimales monetarios.
 * EARS-VENTA-01: cantidad * precio unitario -> 2 decimales.
 */
export function calcularSubtotalLinea(cantidad: number, precioUnitario: number): number {
  return Math.round(cantidad * precioUnitario * 100) / 100;
}

/**
 * Crea una línea de carrito a partir de un producto y el peso actual de la báscula.
 * Aplica validaciones de Casos Límite 1 y 2 para productos por peso.
 */
export function crearLineaCarrito(
  producto: ProductoLocal,
  pesoActualKg?: number
): { item: CartItem | null; error?: string } {
  if (producto.tipoVenta === 'peso') {
    if (pesoActualKg === undefined || pesoActualKg === null) {
      return { item: null, error: 'No se detectó lectura de báscula.' };
    }

    // Caso Límite 1 y 2: peso <= 0.000 kg o infinitesimal < 0.001 kg
    if (pesoActualKg <= 0) {
      return {
        item: null,
        error: 'El peso de la báscula debe ser mayor a 0.000 kg. Coloque el corte cárnico en el platillo.',
      };
    }

    const pesoRedondeado = Math.round(pesoActualKg * 1000) / 1000;
    if (pesoRedondeado < 0.001) {
      return {
        item: null,
        error: 'Peso infinitesimal (< 0.001 kg). No se permite agregar al carrito.',
      };
    }

    const subtotal = calcularSubtotalLinea(pesoRedondeado, producto.precio);

    return {
      item: {
        id: `${producto.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productoId: producto.id,
        nombre: producto.nombre,
        tipoVenta: 'peso',
        cantidad: pesoRedondeado,
        unidadMedida: producto.unidadMedida || 'kg',
        precioUnitario: producto.precio,
        subtotal,
      },
    };
  }

  // Producto por unidad
  const cantidad = 1;
  const subtotal = calcularSubtotalLinea(cantidad, producto.precio);

  return {
    item: {
      id: `${producto.id}-${Date.now()}`,
      productoId: producto.id,
      nombre: producto.nombre,
      tipoVenta: 'unidad',
      cantidad,
      unidadMedida: producto.unidadMedida || 'pieza',
      precioUnitario: producto.precio,
      subtotal,
    },
  };
}

/**
 * Agrega un producto al carrito existente.
 * Si es por unidad y ya existe, incrementa la cantidad.
 * Si es por peso, agrega una nueva pesada independiente.
 */
export function agregarAlCarrito(
  cart: CartItem[],
  producto: ProductoLocal,
  pesoActualKg?: number
): { nuevoCart: CartItem[]; error?: string } {
  if (producto.tipoVenta === 'unidad') {
    const existingIndex = cart.findIndex(
      (item) => item.productoId === producto.id && item.tipoVenta === 'unidad'
    );

    if (existingIndex >= 0) {
      const existing = cart[existingIndex];
      const nuevaCantidad = existing.cantidad + 1;
      const nuevoSubtotal = calcularSubtotalLinea(nuevaCantidad, existing.precioUnitario);

      const nuevoCart = [...cart];
      nuevoCart[existingIndex] = {
        ...existing,
        cantidad: nuevaCantidad,
        subtotal: nuevoSubtotal,
      };
      return { nuevoCart };
    }
  }

  const { item, error } = crearLineaCarrito(producto, pesoActualKg);
  if (!item) {
    return { nuevoCart: cart, error };
  }

  return { nuevoCart: [...cart, item] };
}

/**
 * Elimina un ítem del carrito por su ID de línea.
 */
export function eliminarDelCarrito(cart: CartItem[], itemId: string): CartItem[] {
  return cart.filter((i) => i.id !== itemId);
}

/**
 * Actualiza la cantidad de una línea específica en el carrito.
 */
export function actualizarCantidadCarrito(
  cart: CartItem[],
  itemId: string,
  nuevaCantidad: number
): CartItem[] {
  if (nuevaCantidad <= 0) {
    return eliminarDelCarrito(cart, itemId);
  }

  return cart.map((item) => {
    if (item.id !== itemId) return item;
    const cant = item.tipoVenta === 'peso' ? Math.round(nuevaCantidad * 1000) / 1000 : Math.round(nuevaCantidad);
    return {
      ...item,
      cantidad: cant,
      subtotal: calcularSubtotalLinea(cant, item.precioUnitario),
    };
  });
}

/**
 * Calcula el total acumulado de los ítems en el carrito.
 */
export function calcularTotalCarrito(cart: CartItem[]): number {
  const suma = cart.reduce((acc, item) => acc + item.subtotal, 0);
  return Math.round(suma * 100) / 100;
}

/**
 * Valida los métodos de pago frente al total a cobrar.
 * EARS-VENTA-04: Si pagos < total, bloquea confirmación y reporta faltante.
 */
export function validarPagosVenta(total: number, pagos: PagoVentaInput[]): ValidacionPagoResult {
  const totalPagado = Math.round(pagos.reduce((acc, p) => acc + (p.monto || 0), 0) * 100) / 100;
  const faltante = Math.max(0, Math.round((total - totalPagado) * 100) / 100);

  if (totalPagado < total) {
    return {
      esValido: false,
      total,
      totalPagado,
      faltante,
      cambio: 0,
      mensajeError: `Monto insuficiente. Faltan $${faltante.toFixed(2)} por cubrir.`,
    };
  }

  // Hay cambio si el monto en efectivo excede lo requerido
  const cambio = Math.max(0, Math.round((totalPagado - total) * 100) / 100);

  return {
    esValido: true,
    total,
    totalPagado,
    faltante: 0,
    cambio,
  };
}

/**
 * Genera el payload de la venta y lo encola directamente en IndexedDB (outbox).
 */
export async function procesarVentaLocal(params: {
  cart: CartItem[];
  pagos: PagoVentaInput[];
  cajeroId?: string;
  sucursalId?: string;
  negocioId?: string;
}): Promise<{ ventaId: string; cambio: number }> {
  const { cart, pagos, cajeroId, sucursalId, negocioId } = params;

  if (cart.length === 0) {
    throw new Error('El carrito de compras está vacío.');
  }

  const total = calcularTotalCarrito(cart);
  const validacion = validarPagosVenta(total, pagos);

  if (!validacion.esValido) {
    throw new Error(validacion.mensajeError || 'Pagos incompletos.');
  }

  const ventaPayload = {
    negocioId: negocioId || 'negocio-local',
    sucursalId: sucursalId || 'sucursal-local',
    cajeroId: cajeroId || 'cajero-pos',
    total,
    subtotal: total,
    descuento: 0,
    cambio: validacion.cambio,
    items: cart.map((i) => ({
      productoId: i.productoId,
      nombre: i.nombre,
      tipoVenta: i.tipoVenta,
      cantidad: i.cantidad,
      unidadMedida: i.unidadMedida,
      precioUnitario: i.precioUnitario,
      subtotal: i.subtotal,
    })),
    pagos: pagos.map((p) => ({
      metodo: p.metodo,
      monto: p.monto,
    })),
    fecha: new Date().toISOString(),
  };

  const ventaId = await encolarVentaOutbox(ventaPayload);

  return {
    ventaId,
    cambio: validacion.cambio,
  };
}
