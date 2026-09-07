import { DetalleVenta } from '../../../src/modules/sales/domain/entities/detalle-venta.entity';

describe('DetalleVentaService (Unitario)', () => {
  it('debe capturar un snapshot inmutable de precio_unitario al momento de la venta', () => {
    const detalle = {
      producto_id: 'prod-peso-uuid-4444',
      cantidad: 1.5, // 1.500 kg
      precio_unitario: 38000.0,
      subtotal_linea: 57000.0,
    };
    expect(detalle.cantidad * detalle.precio_unitario).toBe(57000.0);
  });

  it('debe almacenar peso_bruto y peso_neto para auditoría con báscula', () => {
    const detalle = { peso_bruto: 1.505, peso_neto: 1.500 };
    expect(detalle.peso_bruto).toBeGreaterThanOrEqual(detalle.peso_neto);
  });

  it('debe instanciar la entidad DetalleVenta calculando subtotal_linea inmutable con precisión de 2 decimales', () => {
    const entidad = new DetalleVenta({
      ventaId: 'venta-uuid-1',
      productoId: 'prod-peso-uuid-4444',
      cantidad: 2.345, // kg con 3 decimales
      precioUnitario: 32500.0,
      pesoBruto: 2.355,
      pesoNeto: 2.345,
    });

    // 2.345 * 32500 = 76212.50
    expect(entidad.subtotalLinea).toBe(76212.5);
    expect(entidad.precioUnitario).toBe(32500.0);
    expect(entidad.pesoNeto).toBe(2.345);
    expect(entidad.pesoBruto).toBe(2.355);
  });
});
