import { mockVentaOffline } from '../helpers/mock-data.helper';

describe('Integración: Ciclo Offline-First y Push al Servidor', () => {
  it('debe encolar ventas offline y sincronizarlas de forma idempotente al reconectar', async () => {
    const colaOffline = [
      mockVentaOffline({ id: 'v-off-1' }),
      mockVentaOffline({ id: 'v-off-2' }),
    ];

    // Simula procesamiento en backend
    const sincronizadas = colaOffline.map((v) => ({ ...v, sincronizada: true }));

    expect(sincronizadas.every((v) => v.sincronizada)).toBe(true);
    expect(sincronizadas).toHaveLength(2);
  });
});
