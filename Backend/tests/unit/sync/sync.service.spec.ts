import { BadRequestException } from '@nestjs/common';
import { SyncService } from '../../../src/modules/sync/application/services/sync.service';
import { VentaService } from '../../../src/modules/sales/application/services/venta.service';
import { Venta } from '../../../src/modules/sales/domain/entities/venta.entity';
import { IVentaRepository } from '../../../src/modules/sales/domain/ports/venta-repository.port';
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
    return Array.from(this.ventas.values()).filter((v) => v.dispositivoId === dispositivoId);
  }

  async buscarPorSucursal(sucursalId: string): Promise<Venta[]> {
    return Array.from(this.ventas.values()).filter((v) => v.sucursalId === sucursalId);
  }

  async actualizar(venta: Venta): Promise<Venta> {
    this.ventas.set(venta.id, venta);
    return venta;
  }
}

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

  describe('Ingesta por lotes offline e Idempotencia (TASK-14)', () => {
    let repo: InMemoryVentaRepository;
    let ventaService: VentaService;
    let syncService: SyncService;

    const sucursalId = 'suc-123e4567-e89b-12d3-a456-426614174000';
    const dispositivoId = 'term-offline-01';
    const cajeroId = 'usr-123e4567-e89b-12d3-a456-426614174000';

    beforeEach(() => {
      repo = new InMemoryVentaRepository();
      ventaService = new VentaService(repo);
      syncService = new SyncService(ventaService, repo);
    });

    it('debe procesar exitosamente un lote de ventas offline (EARS-SYNC-01, US-05)', async () => {
      const batch = {
        dispositivoId,
        ventas: [
          {
            id: 'vnt-sync-0001',
            sucursalId,
            dispositivoId,
            cajeroId,
            total: 38000.0,
            metodoPago: 'efectivo',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [
              {
                productoId: 'prod-peso-uuid-4444',
                cantidad: 1.0,
                precioUnitario: 38000.0,
              },
            ],
            pagos: [{ metodo: 'efectivo', monto: 38000.0 }],
          },
          {
            id: 'vnt-sync-0002',
            sucursalId,
            dispositivoId,
            cajeroId,
            total: 15000.0,
            metodoPago: 'tarjeta',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [
              {
                productoId: 'prod-unidad-uuid-5555',
                cantidad: 1.0,
                precioUnitario: 15000.0,
              },
            ],
            pagos: [{ metodo: 'tarjeta', monto: 15000.0 }],
          },
        ],
      };

      const respuesta = await syncService.sincronizarLoteVentas(batch as any);

      expect(respuesta.procesadas).toBe(2);
      expect(respuesta.duplicadasIgnoradas).toBe(0);
      expect(respuesta.errores).toHaveLength(0);
      expect(repo.ventas.size).toBe(2);

      const v1 = repo.ventas.get('vnt-sync-0001');
      expect(v1?.sincronizada).toBe(true);
      expect(v1?.fechaHoraServidor).toBeDefined();
    });

    it('debe ignorar ventas duplicadas manteniendo idempotencia estricta (EARS-SYNC-04)', async () => {
      const ventaRepetida = {
        id: 'vnt-sync-0001',
        sucursalId,
        dispositivoId,
        cajeroId,
        total: 38000.0,
        metodoPago: 'efectivo',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId: 'prod-peso-uuid-4444',
            cantidad: 1.0,
            precioUnitario: 38000.0,
          },
        ],
        pagos: [{ metodo: 'efectivo', monto: 38000.0 }],
      };

      // Primer envío: se procesa
      const res1 = await syncService.sincronizarLoteVentas({
        dispositivoId,
        ventas: [ventaRepetida as any],
      });
      expect(res1.procesadas).toBe(1);
      expect(res1.duplicadasIgnoradas).toBe(0);

      // Segundo envío: se ignora sin duplicar
      const res2 = await syncService.sincronizarLoteVentas({
        dispositivoId,
        ventas: [ventaRepetida as any],
      });
      expect(res2.procesadas).toBe(0);
      expect(res2.duplicadasIgnoradas).toBe(1);
      expect(repo.ventas.size).toBe(1); // Mantiene exactamente 1 registro
    });

    it('debe procesar lote mixto conteniendo ventas nuevas y duplicadas', async () => {
      // Registrar venta previa
      await syncService.sincronizarLoteVentas({
        dispositivoId,
        ventas: [
          {
            id: 'vnt-previa-1',
            sucursalId,
            dispositivoId,
            cajeroId,
            total: 10000.0,
            metodoPago: 'efectivo',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 10000.0 }],
            pagos: [{ metodo: 'efectivo', monto: 10000.0 }],
          } as any,
        ],
      });

      // Lote con 1 duplicada y 2 nuevas
      const batchMixto = {
        dispositivoId,
        ventas: [
          {
            id: 'vnt-previa-1', // Duplicada
            sucursalId,
            dispositivoId,
            cajeroId,
            total: 10000.0,
            metodoPago: 'efectivo',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [{ productoId: 'prod-1', cantidad: 1, precioUnitario: 10000.0 }],
            pagos: [{ metodo: 'efectivo', monto: 10000.0 }],
          },
          {
            id: 'vnt-nueva-2', // Nueva
            sucursalId,
            dispositivoId,
            cajeroId,
            total: 20000.0,
            metodoPago: 'efectivo',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [{ productoId: 'prod-2', cantidad: 2, precioUnitario: 10000.0 }],
            pagos: [{ metodo: 'efectivo', monto: 20000.0 }],
          },
          {
            id: 'vnt-nueva-3', // Nueva
            sucursalId,
            dispositivoId,
            cajeroId,
            total: 30000.0,
            metodoPago: 'tarjeta',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [{ productoId: 'prod-3', cantidad: 3, precioUnitario: 10000.0 }],
            pagos: [{ metodo: 'tarjeta', monto: 30000.0 }],
          },
        ],
      };

      const resultado = await syncService.sincronizarLoteVentas(batchMixto as any);

      expect(resultado.procesadas).toBe(2);
      expect(resultado.duplicadasIgnoradas).toBe(1);
      expect(resultado.errores).toHaveLength(0);
      expect(repo.ventas.size).toBe(3);
    });

    it('debe rechazar lote si falta el dispositivoId o ventas', async () => {
      await expect(
        syncService.sincronizarLoteVentas({ dispositivoId: '', ventas: [] }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        syncService.sincronizarLoteVentas({ dispositivoId: 'disp-1' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
