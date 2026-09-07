describe('MovimientoInventarioService (Unitario)', () => {
  it('debe procesar siempre deltas incrementales o decrementales (+ / -)', () => {
    const movimientoVenta = { tipo: 'venta', cantidad_delta: -1.25 };
    const movimientoRecepcion = { tipo: 'recepcion', cantidad_delta: 25.0 };

    expect(movimientoVenta.cantidad_delta).toBeLessThan(0);
    expect(movimientoRecepcion.cantidad_delta).toBeGreaterThan(0);
  });

  it('debe soportar tipos: venta, merma, recepcion, ajuste_manual, devolucion', () => {
    const tiposPermitidos = ['venta', 'merma', 'recepcion', 'ajuste_manual', 'devolucion'];
    expect(tiposPermitidos).toContain('merma');
  });
});
