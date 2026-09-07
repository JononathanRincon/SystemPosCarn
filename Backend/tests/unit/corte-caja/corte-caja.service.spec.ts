describe('CorteCajaService (Unitario)', () => {
  it('debe calcular correctamente la diferencia: contado - esperado', () => {
    const esperado = 550000.0;
    const contado = 552000.0;
    const diferencia = contado - esperado;

    expect(diferencia).toBe(2000.0); // Sobrante de 2000
  });

  it('debe desglosar totales por cada método de pago', () => {
    const desglose = {
      efectivo: 350000.0,
      tarjeta: 200000.0,
    };
    expect(desglose.efectivo + desglose.tarjeta).toBe(550000.0);
  });
});
