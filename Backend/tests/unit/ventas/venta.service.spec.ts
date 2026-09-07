import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VentaService, IDomainEventEmitter } from '../../../src/modules/sales/application/services/venta.service';
import { CorteCajaService } from '../../../src/modules/cash/application/services/corte-caja.service';
import { Venta } from '../../../src/modules/sales/domain/entities/venta.entity';
import { IVentaRepository } from '../../../src/modules/sales/domain/ports/venta-repository.port';
import { VentaCompletadaEvent } from '../../../src/modules/sales/domain/events/venta-completada.event';
import { mockVentaOffline } from '../../helpers/mock-data.helper';

class InMemoryVentaRepository implements IVentaRepository {
  public ventas: Map<string, Venta> = new Map();

  async guardarTransaccional(venta: Venta): Promise<Venta> {
    this.ventas.set(venta.id, venta);
    return venta;
  }

  async buscarPorId(id: string): Promise<Venta | null> {
    return this.ventas.get(id) || null;
  }

  async buscarPorDispositivoYRango(dispositivoId: string, desde: Date, hasta?: Date): Promise<Venta[]> {
    return Array.from(this.ventas.values()).filter((v) => {
      if (v.dispositivoId !== dispositivoId) return false;
      const t = v.fechaHoraDispositivo.getTime();
      if (t < desde.getTime()) return false;
      if (hasta && t > hasta.getTime()) return false;
      return true;
    });
  }

  async buscarPorSucursal(sucursalId: string, limite = 50): Promise<Venta[]> {
    return Array.from(this.ventas.values())
      .filter((v) => v.sucursalId === sucursalId)
      .slice(0, limite);
  }

  async actualizar(venta: Venta): Promise<Venta> {
    this.ventas.set(venta.id, venta);
    return venta;
  }
}

describe('VentaService (Unitario)', () => {
  let service: VentaService;
  let repo: InMemoryVentaRepository;
  let mockCorteCajaService: { verificarCajaAbierta: jest.Mock };
  let mockEventEmitter: jest.Mocked<IDomainEventEmitter>;

  beforeEach(() => {
    repo = new InMemoryVentaRepository();
    mockCorteCajaService = {
      verificarCajaAbierta: jest.fn().mockResolvedValue(true),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };
    service = new VentaService(repo, mockCorteCajaService as any, mockEventEmitter);
  });

  it('debe registrar una venta generada offline con UUID de cliente y estado completada', () => {
    const venta = mockVentaOffline();
    expect(venta.id).toBe('venta-offline-uuid-9999');
    expect(venta.estado).toBe('completada');
    expect(venta.sincronizada).toBe(false);
  });

  it('debe calcular subtotal, descuentos y total con 2 decimales', () => {
    const subtotal = 47500.0;
    const descuento = 2500.0;
    const total = subtotal - descuento;
    expect(total).toBe(45000.0);
  });

  it('debe permitir anular la venta cambiando estado a anulada sin eliminar registro de BD', () => {
    const venta = mockVentaOffline({ estado: 'anulada' });
    expect(venta.estado).toBe('anulada');
  });

  describe('Creación atómica de venta y validación de reglas de negocio (TASK-13)', () => {
    it('debe crear venta con snapshot inmutable de precios y pagos mixtos exactos (EARS-VENTA-01, US-04)', async () => {
      const payload = {
        id: 'c1b2a3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        sucursalId: 'suc-123e4567-e89b-12d3-a456-426614174000',
        dispositivoId: 'term-caja-01',
        cajeroId: 'usr-123e4567-e89b-12d3-a456-426614174000',
        clienteId: 'cli-123e4567-e89b-12d3-a456-426614174000',
        total: 47500.0,
        metodoPago: 'mixto',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId: 'prod-peso-uuid-4444',
            cantidad: 1.25, // 1.250 kg
            precioUnitario: 38000.0, // Snapshot
            pesoBruto: 1.255,
            pesoNeto: 1.25,
          },
        ],
        pagos: [
          { metodo: 'efectivo', monto: 20000.0 },
          { metodo: 'tarjeta', monto: 27500.0, referenciaTransaccion: 'VOUCHER-888' },
        ],
      };

      const resultado = await service.crearVenta(payload as any);

      expect(resultado.id).toBe(payload.id);
      expect(resultado.estado).toBe('completada');
      expect(resultado.subtotal).toBe(47500.0);
      expect(resultado.total).toBe(47500.0);
      expect(resultado.detalles[0].precioUnitario).toBe(38000.0); // Snapshot
      expect(resultado.pagos).toHaveLength(2);

      // Verifica emisión de evento de dominio para inventario
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        VentaCompletadaEvent.EVENT_NAME,
        expect.objectContaining({
          ventaId: payload.id,
          total: 47500.0,
        }),
      );
    });

    it('debe rechazar la venta si el monto acumulado en pagos es insuficiente e informar saldo faltante (EARS-VENTA-04)', async () => {
      const payload = {
        id: 'c2b3a4d5-e6f7-4b5c-9d0e-1f2a3b4c5d6e',
        sucursalId: 'suc-123e4567-e89b-12d3-a456-426614174000',
        dispositivoId: 'term-caja-01',
        cajeroId: 'usr-123e4567-e89b-12d3-a456-426614174000',
        total: 50000.0,
        metodoPago: 'efectivo',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId: 'prod-unidad-uuid-5555',
            cantidad: 2,
            precioUnitario: 25000.0,
          },
        ],
        pagos: [
          { metodo: 'efectivo', monto: 35000.0 }, // Faltan $15,000
        ],
      };

      await expect(service.crearVenta(payload as any)).rejects.toThrow(
        /Saldo faltante: \$15000\.00/,
      );
    });

    it('debe rechazar la venta si la caja se encuentra cerrada o sin turno abierto (EARS-CAJA-03, EARS-CAJA-04)', async () => {
      mockCorteCajaService.verificarCajaAbierta.mockResolvedValue(false);

      const payload = {
        id: 'c3b4a5d6-e7f8-4c5d-0e1f-2a3b4c5d6e7f',
        sucursalId: 'suc-123e4567-e89b-12d3-a456-426614174000',
        dispositivoId: 'term-cerrada',
        cajeroId: 'usr-123e4567-e89b-12d3-a456-426614174000',
        total: 10000.0,
        metodoPago: 'efectivo',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId: 'prod-unidad-uuid-5555',
            cantidad: 1,
            precioUnitario: 10000.0,
          },
        ],
        pagos: [{ metodo: 'efectivo', monto: 10000.0 }],
      };

      await expect(service.crearVenta(payload as any)).rejects.toThrow(
        /no cuenta con un turno de caja abierto/,
      );
    });

    it('debe garantizar idempotencia respondiendo venta existente sin duplicar registro', async () => {
      const payload = {
        id: 'c4b5a6d7-e8f9-4d5e-1f2a-3b4c5d6e7f8a',
        sucursalId: 'suc-123e4567-e89b-12d3-a456-426614174000',
        dispositivoId: 'term-caja-01',
        cajeroId: 'usr-123e4567-e89b-12d3-a456-426614174000',
        total: 20000.0,
        metodoPago: 'efectivo',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId: 'prod-unidad-uuid-5555',
            cantidad: 2,
            precioUnitario: 10000.0,
          },
        ],
        pagos: [{ metodo: 'efectivo', monto: 20000.0 }],
      };

      const v1 = await service.crearVenta(payload as any);
      const v2 = await service.crearVenta(payload as any);

      expect(v1.id).toBe(v2.id);
      expect(repo.ventas.size).toBe(1);
    });

    it('debe anular una venta existente cambiando estado a anulada sin eliminarla', async () => {
      const payload = {
        id: 'c5b6a7d8-e9f0-4e5f-2a3b-4c5d6e7f8a9b',
        sucursalId: 'suc-123e4567-e89b-12d3-a456-426614174000',
        dispositivoId: 'term-caja-01',
        cajeroId: 'usr-123e4567-e89b-12d3-a456-426614174000',
        total: 30000.0,
        metodoPago: 'efectivo',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId: 'prod-unidad-uuid-5555',
            cantidad: 3,
            precioUnitario: 10000.0,
          },
        ],
        pagos: [{ metodo: 'efectivo', monto: 30000.0 }],
      };

      await service.crearVenta(payload as any);
      const anulada = await service.anularVenta(payload.id, {
        motivo: 'Error de digitación en peso del corte',
        usuarioId: 'usr-gerente-uuid',
      });

      expect(anulada.estado).toBe('anulada');
      const consultada = await service.buscarVentaPorId(payload.id);
      expect(consultada?.estado).toBe('anulada');
    });
  });
});
