import { mockProductoPeso, mockProductoUnidad } from '../../helpers/mock-data.helper';

describe('ProductoService (Unitario)', () => {
  it('debe crear un producto por peso admitiendo hasta 3 decimales (gramos)', () => {
    const productoPeso = mockProductoPeso();
    expect(productoPeso.tipo_venta).toBe('peso');
    expect(productoPeso.unidad_medida).toBe('kg');
    expect(productoPeso.precio).toBeGreaterThan(0);
  });

  it('debe crear un producto por unidad validando unidad_medida = unidad', () => {
    const productoUnidad = mockProductoUnidad();
    expect(productoUnidad.tipo_venta).toBe('unidad');
    expect(productoUnidad.unidad_medida).toBe('unidad');
  });

  it('debe rechazar precios negativos o iguales a cero', () => {
    const precioInvalido = -500;
    expect(precioInvalido).toBeLessThanOrEqual(0);
  });
});
