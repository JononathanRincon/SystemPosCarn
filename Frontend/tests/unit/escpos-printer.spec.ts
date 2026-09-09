import { describe, it, expect } from 'vitest';
import {
  EscPosBuilder,
  generateEscPosCommands,
  generateTicketHtml,
  TicketData,
} from '@/lib/hardware/escpos-printer';

describe('ESC/POS Thermal Printer Generator', () => {
  const mockTicket: TicketData = {
    negocioNombre: 'Carnicería El Buen Corte',
    negocioNit: '900.123.456-7',
    sucursalNombre: 'Sucursal Mostrador Centro',
    direccion: 'Calle 10 # 5-20',
    telefono: '311 555 1234',
    ventaId: 'vta-uuid-1234567890',
    fecha: new Date('2026-09-08T14:30:00.000Z'),
    cajeroNombre: 'Juan Cajero',
    items: [
      {
        nombre: 'Arrachera Marinada',
        cantidad: 1.5,
        unidadMedida: 'kg',
        precioUnitario: 260.0,
        subtotal: 390.0,
      },
      {
        nombre: 'Bolsa Carbón 3kg',
        cantidad: 1,
        unidadMedida: 'pieza',
        precioUnitario: 25.0,
        subtotal: 25.0,
      },
    ],
    total: 415.0,
    pagos: [
      { metodo: 'efectivo', monto: 500.0 },
    ],
    cambio: 85.0,
    mensajePie: '¡Gracias por su preferencia!',
  };

  it('debe construir secuencia binaria con comandos ESC/POS básicos', () => {
    const builder = new EscPosBuilder(80);
    builder.init().align('center').bold(true).text('HOLA').feed(2).cut();

    const bytes = builder.build();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);

    // Debe contener ESC @ (0x1B, 0x40) de inicialización
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
  });

  it('debe generar bytes ESC/POS para ticket completo de carnicería (80mm y 58mm)', () => {
    const bytes80 = generateEscPosCommands(mockTicket, { width: 80 });
    expect(bytes80.length).toBeGreaterThan(100);

    const bytes58 = generateEscPosCommands(mockTicket, { width: 58 });
    expect(bytes58.length).toBeGreaterThan(100);
  });

  it('debe generar HTML de ticket con todos los campos requeridos', () => {
    const html = generateTicketHtml(mockTicket);
    expect(html).toContain('CARNICERÍA EL BUEN CORTE');
    expect(html).toContain('900.123.456-7');
    expect(html).toContain('Arrachera Marinada');
    expect(html).toContain('1.500 kg');
    expect(html).toContain('$415.00');
    expect(html).toContain('CAMBIO / DEVUELTA:');
    expect(html).toContain('$85.00');
  });
});
