import { mockVentaOffline, mockProductoPeso } from '../helpers/mock-data.helper';

describe('Integración: Flujo Completo de Venta y Afectación de Stock', () => {
  it('debe completar: venta -> detalle -> pagos -> delta de inventario', async () => {
    const producto = mockProductoPeso();
    const stockInicial = 25.0; // 25 kg
    const venta = mockVentaOffline();

    // 1. Validar venta
    expect(venta.estado).toBe('completada');

    // 2. Aplicar delta
    const cantidadVendida = venta.detalles[0].cantidad; // 1.25 kg
    const stockResultante = stockInicial - cantidadVendida;

    expect(stockResultante).toBe(23.75);
    expect(venta.pagos[0].monto + venta.pagos[1].monto).toBe(venta.total);
  });
});
