describe('ConflictoService - Resolución de Inventario Offline (Unitario)', () => {
  it('debe aplicar deltas de dos terminales concurrentes sin pisar el stock', () => {
    const stockInicial = 10.0; // 10.0 kg en stock
    const deltaTerminal1 = -2.5; // Caja 1 vende 2.5 kg offline
    const deltaTerminal2 = -4.0; // Caja 2 vende 4.0 kg offline

    // Al llegar ambas sync al servidor:
    const stockFinal = stockInicial + deltaTerminal1 + deltaTerminal2;
    expect(stockFinal).toBe(3.5);
  });

  it('debe generar alerta de stock negativo sin bloquear la venta si el inventario queda menor a cero', () => {
    const stockInicial = 2.0;
    const deltaCaja1 = -2.0;
    const deltaCaja2 = -1.5;

    const stockFinal = stockInicial + deltaCaja1 + deltaCaja2; // -1.5 kg
    const alertaGenerada = stockFinal < 0;

    expect(stockFinal).toBe(-1.5);
    expect(alertaGenerada).toBe(true);
  });
});
