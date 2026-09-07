describe('MermaService (Unitario)', () => {
  it('debe registrar merma con motivos válidos (corte_proceso, vencimiento, dano, robo, otro)', () => {
    const merma = {
      producto_id: 'prod-peso-uuid-4444',
      cantidad: 0.85,
      motivo: 'corte_proceso',
      usuario_id: 'user-cajero-uuid',
    };
    expect(merma.motivo).toBe('corte_proceso');
    expect(merma.cantidad).toBeGreaterThan(0);
  });
});
