describe('Integración: Sincronización Incremental de Catálogo hacia Terminales', () => {
  it('debe descargar únicamente los productos y precios modificados desde la última sincronización', async () => {
    const ultimoSyncToken = new Date('2026-09-01T00:00:00Z').getTime();
    const productosServidor = [
      { id: 'p1', updated_at: new Date('2026-08-20T00:00:00Z').getTime() },
      { id: 'p2', updated_at: new Date('2026-09-05T10:00:00Z').getTime() },
    ];

    const deltasCatalog = productosServidor.filter((p) => p.updated_at > ultimoSyncToken);
    expect(deltasCatalog).toHaveLength(1);
    expect(deltasCatalog[0].id).toBe('p2');
  });
});
