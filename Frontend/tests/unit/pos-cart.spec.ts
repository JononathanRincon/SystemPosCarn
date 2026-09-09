import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  calcularSubtotalLinea,
  crearLineaCarrito,
  agregarAlCarrito,
  eliminarDelCarrito,
  calcularTotalCarrito,
  validarPagosVenta,
  procesarVentaLocal,
  CartItem,
} from '@/lib/pos/pos-cart';
import { POSDatabase } from '@/lib/db/pos-database';
import { ProductoLocal } from '@/lib/db/pos-database';
import { obtenerVentasPendientesSync } from '@/lib/db/repos/venta-outbox-repo';

let testDb: POSDatabase;

describe('POS Cart & Payment Validation', () => {
  const productoCarne: ProductoLocal = {
    id: 'prod-arrachera',
    negocioId: 'neg-1',
    categoriaId: 'cat-res',
    nombre: 'Arrachera Marinada',
    tipoVenta: 'peso',
    precio: 250.0,
    unidadMedida: 'kg',
    activo: true,
  };

  const productoUnidad: ProductoLocal = {
    id: 'prod-carbon',
    negocioId: 'neg-1',
    categoriaId: 'cat-abarrotes',
    nombre: 'Bolsa Carbón 3kg',
    tipoVenta: 'unidad',
    precio: 85.5,
    unidadMedida: 'pieza',
    activo: true,
  };

  beforeEach(async () => {
    testDb = new POSDatabase(`TestPosCartDB_${Date.now()}`);
    // Override singleton en lib/db/pos-database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).testDbOverride = testDb;
  });

  afterEach(async () => {
    if (testDb) {
      testDb.close();
      await testDb.delete();
    }
  });

  describe('Cálculo de Subtotales y Precisión (EARS-VENTA-01)', () => {
    it('debe calcular subtotal con 3 decimales de kg y 2 decimales monetarios', () => {
      // 1.255 kg * $250.00 = $313.75
      const subtotal = calcularSubtotalLinea(1.255, 250.0);
      expect(subtotal).toBe(313.75);

      // 0.333 kg * $189.50 = 63.1035 -> $63.10
      const subtotal2 = calcularSubtotalLinea(0.333, 189.5);
      expect(subtotal2).toBe(63.1);
    });

    it('debe crear línea de carrito para producto por peso con lectura de báscula válida', () => {
      const { item, error } = crearLineaCarrito(productoCarne, 1.45);
      expect(error).toBeUndefined();
      expect(item).not.toBeNull();
      expect(item!.cantidad).toBe(1.45);
      expect(item!.precioUnitario).toBe(250.0);
      expect(item!.subtotal).toBe(362.5);
      expect(item!.tipoVenta).toBe('peso');
    });

    it('debe rechazar producto por peso si la báscula está en 0.000 kg o negativo (Casos Límite 1 y 2)', () => {
      const resCero = crearLineaCarrito(productoCarne, 0.0);
      expect(resCero.item).toBeNull();
      expect(resCero.error).toContain('mayor a 0.000 kg');

      const resNegativo = crearLineaCarrito(productoCarne, -0.05);
      expect(resNegativo.item).toBeNull();
      expect(resNegativo.error).toContain('mayor a 0.000 kg');

      const resUndefined = crearLineaCarrito(productoCarne, undefined);
      expect(resUndefined.item).toBeNull();
      expect(resUndefined.error).toContain('No se detectó lectura');
    });

    it('debe rechazar pesos infinitesimales menores a 0.001 kg (Caso Límite 2)', () => {
      const resInfinitesimal = crearLineaCarrito(productoCarne, 0.0004);
      expect(resInfinitesimal.item).toBeNull();
      expect(resInfinitesimal.error).toContain('infinitesimal');
    });

    it('debe crear línea de producto por unidad con cantidad 1', () => {
      const { item, error } = crearLineaCarrito(productoUnidad);
      expect(error).toBeUndefined();
      expect(item).not.toBeNull();
      expect(item!.cantidad).toBe(1);
      expect(item!.subtotal).toBe(85.5);
      expect(item!.tipoVenta).toBe('unidad');
    });
  });

  describe('Manejo de Carrito (US-03)', () => {
    it('debe incrementar cantidad si se agrega un producto por unidad ya existente', () => {
      let cart: CartItem[] = [];
      const res1 = agregarAlCarrito(cart, productoUnidad);
      cart = res1.nuevoCart;
      expect(cart.length).toBe(1);
      expect(cart[0].cantidad).toBe(1);
      expect(cart[0].subtotal).toBe(85.5);

      const res2 = agregarAlCarrito(cart, productoUnidad);
      cart = res2.nuevoCart;
      expect(cart.length).toBe(1);
      expect(cart[0].cantidad).toBe(2);
      expect(cart[0].subtotal).toBe(171.0);
    });

    it('debe permitir múltiples pesadas independientes para productos por peso', () => {
      let cart: CartItem[] = [];
      const res1 = agregarAlCarrito(cart, productoCarne, 1.25);
      cart = res1.nuevoCart;

      const res2 = agregarAlCarrito(cart, productoCarne, 0.85);
      cart = res2.nuevoCart;

      expect(cart.length).toBe(2);
      expect(cart[0].cantidad).toBe(1.25);
      expect(cart[1].cantidad).toBe(0.85);
      expect(calcularTotalCarrito(cart)).toBe(525.0); // (1.25*250) + (0.85*250) = 312.5 + 212.5
    });

    it('debe eliminar un ítem del carrito', () => {
      const { nuevoCart } = agregarAlCarrito([], productoUnidad);
      expect(nuevoCart.length).toBe(1);
      const cartVacio = eliminarDelCarrito(nuevoCart, nuevoCart[0].id);
      expect(cartVacio.length).toBe(0);
    });
  });

  describe('Validación de Pagos Simples y Mixtos (EARS-VENTA-04, US-04)', () => {
    it('debe rechazar pago si el monto acumulado es menor al total de la venta', () => {
      const total = 500.0;
      const pagos = [{ metodo: 'efectivo' as const, monto: 350.0 }];

      const res = validarPagosVenta(total, pagos);
      expect(res.esValido).toBe(false);
      expect(res.faltante).toBe(150.0);
      expect(res.cambio).toBe(0);
      expect(res.mensajeError).toContain('Faltan $150.00');
    });

    it('debe validar pago exacto en efectivo o tarjeta sin cambio', () => {
      const total = 320.0;
      const pagos = [{ metodo: 'tarjeta' as const, monto: 320.0 }];

      const res = validarPagosVenta(total, pagos);
      expect(res.esValido).toBe(true);
      expect(res.faltante).toBe(0);
      expect(res.cambio).toBe(0);
    });

    it('debe calcular cambio correctamente si se paga con exceso en efectivo', () => {
      const total = 370.0;
      const pagos = [{ metodo: 'efectivo' as const, monto: 500.0 }]; // Billete de 500

      const res = validarPagosVenta(total, pagos);
      expect(res.esValido).toBe(true);
      expect(res.faltante).toBe(0);
      expect(res.cambio).toBe(130.0);
    });

    it('debe soportar pagos mixtos exactos (Efectivo + Tarjeta)', () => {
      const total = 650.0;
      const pagos = [
        { metodo: 'tarjeta' as const, monto: 400.0 },
        { metodo: 'efectivo' as const, monto: 250.0 },
      ];

      const res = validarPagosVenta(total, pagos);
      expect(res.esValido).toBe(true);
      expect(res.totalPagado).toBe(650.0);
      expect(res.cambio).toBe(0);
    });
  });

  describe('Procesamiento de Venta y Encolado Outbox (Persistencia Offline)', () => {
    it('debe procesar venta y guardarla con status pending en IndexedDB', async () => {
      const { nuevoCart } = agregarAlCarrito([], productoCarne, 2.0); // 2kg * $250 = $500
      const pagos = [{ metodo: 'efectivo' as const, monto: 500.0 }];

      const resultado = await procesarVentaLocal({
        cart: nuevoCart,
        pagos,
        cajeroId: 'cajero-test-01',
      });

      expect(resultado.ventaId).toBeDefined();
      expect(resultado.cambio).toBe(0);

      // Verificar que se haya encolado en IndexedDB
      const pendientes = await obtenerVentasPendientesSync();
      expect(pendientes.length).toBeGreaterThan(0);
      const ventaEncolada = pendientes.find((v) => v.id === resultado.ventaId);
      expect(ventaEncolada).toBeDefined();
      expect(ventaEncolada!.status).toBe('pending');

      const payloadParsed = JSON.parse(ventaEncolada!.payload);
      expect(payloadParsed.total).toBe(500.0);
      expect(payloadParsed.items[0].nombre).toBe('Arrachera Marinada');
      expect(payloadParsed.items[0].cantidad).toBe(2.0);
    });
  });
});
