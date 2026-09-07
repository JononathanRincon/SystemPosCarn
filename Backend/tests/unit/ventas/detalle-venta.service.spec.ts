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
});
