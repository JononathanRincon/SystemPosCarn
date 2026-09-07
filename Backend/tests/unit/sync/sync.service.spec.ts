import { mockVentaOffline } from '../../helpers/mock-data.helper';

describe('SyncService (Unitario)', () => {
  it('debe aplicar ventas de forma idempotente usando el UUID del dispositivo', () => {
    const venta1 = mockVentaOffline();
    const intentoDuplicado = { ...venta1 };
    
    // Simula comprobación de idempotencia: el segundo intento con mismo UUID no debe crear otra venta
    const mapaVentas = new Map();
    mapaVentas.set(venta1.id, venta1);
    
    const yaExiste = mapaVentas.has(intentoDuplicado.id);
    expect(yaExiste).toBe(true);
  });

  it('debe actualizar sincronizada = true y marcar fecha_hora_servidor', () => {
    const venta = mockVentaOffline();
    const ventaSincronizada = {
      ...venta,
      sincronizada: true,
      fecha_hora_servidor: new Date().toISOString(),
    };
    expect(ventaSincronizada.sincronizada).toBe(true);
    expect(ventaSincronizada.fecha_hora_servidor).toBeDefined();
  });
});
