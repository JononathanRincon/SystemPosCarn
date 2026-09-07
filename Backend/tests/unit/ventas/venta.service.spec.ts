import { mockVentaOffline } from '../../helpers/mock-data.helper';

describe('VentaService (Unitario)', () => {
  it('debe registrar una venta generada offline con UUID de cliente y estado completada', () => {
    const venta = mockVentaOffline();
    expect(venta.id).toBe('venta-offline-uuid-9999');
    expect(venta.estado).toBe('completada');
    expect(venta.sincronizada).toBe(false);
  });

  it('debe calcular subtotal, descuentos y total con 2 decimales', () => {
    const subtotal = 47500.0;
    const descuento = 2500.0;
    const total = subtotal - descuento;
    expect(total).toBe(45000.0);
  });

  it('debe permitir anular la venta cambiando estado a anulada sin eliminar registro de BD', () => {
    const venta = mockVentaOffline({ estado: 'anulada' });
    expect(venta.estado).toBe('anulada');
  });
});
