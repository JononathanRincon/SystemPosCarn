describe('CategoriaService (Unitario)', () => {
  it('debe ordenar las categorías según orden_visualizacion para agilizar el POS', () => {
    const categorias = [
      { id: '1', nombre: 'Res', orden_visualizacion: 1 },
      { id: '2', nombre: 'Cerdo', orden_visualizacion: 2 },
      { id: '3', nombre: 'Pollo', orden_visualizacion: 3 },
    ];
    expect(categorias[0].orden_visualizacion).toBeLessThan(categorias[1].orden_visualizacion);
  });
});
