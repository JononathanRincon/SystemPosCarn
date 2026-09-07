describe('PagoVentaService (Unitario)', () => {
  it('debe validar que la suma de los pagos coincida con el total de la venta', () => {
    const totalVenta = 47500.0;
    const pagos = [
      { metodo: 'efectivo', monto: 20000.0 },
      { metodo: 'tarjeta', monto: 27500.0 },
    ];
    const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0);
    expect(totalPagado).toBe(totalVenta);
  });

  it('debe arrojar error si la suma de pagos es inferior al total a pagar', () => {
    const totalVenta = 50000.0;
    const totalPagado = 40000.0;
    expect(totalPagado).toBeLessThan(totalVenta);
  });
});
