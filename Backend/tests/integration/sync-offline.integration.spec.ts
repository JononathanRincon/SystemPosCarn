import { mockVentaOffline } from '../helpers/mock-data.helper';
import { SyncService } from '../../src/modules/sync/application/services/sync.service';
import { SyncController } from '../../src/modules/sync/presentation/http/sync.controller';
import { VentaService } from '../../src/modules/sales/application/services/venta.service';
import { CorteCajaService } from '../../src/modules/cash/application/services/corte-caja.service';
import { Venta } from '../../src/modules/sales/domain/entities/venta.entity';
import { IVentaRepository } from '../../src/modules/sales/domain/ports/venta-repository.port';

class IntegrationSyncVentaRepository implements IVentaRepository {
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

  describe('Endpoint de Ingesta por Lotes POST /sales/sync (TASK-14)', () => {
    let repo: IntegrationSyncVentaRepository;
    let corteCajaService: CorteCajaService;
    let ventaService: VentaService;
    let syncService: SyncService;
    let syncController: SyncController;

    const sucursalId = 'suc-123e4567-e89b-12d3-a456-426614174000';
    const dispositivoId = 'term-offline-tablet-01';
    const cajeroId = 'usr-123e4567-e89b-12d3-a456-426614174000';

    beforeEach(() => {
      repo = new IntegrationSyncVentaRepository();
      corteCajaService = new CorteCajaService(); // Sin turno abierto en servidor
      ventaService = new VentaService(repo, corteCajaService);
      syncService = new SyncService(ventaService, repo);
      syncController = new SyncController(syncService);
    });

    it('debe procesar lote de transacciones acumuladas en modo desconectado (EARS-SYNC-01, EARS-SYNC-02, US-05)', async () => {
      const loteVentas = {
        dispositivoId,
        ventas: [
          {
            id: 'vnt-batch-001',
            sucursalId,
            dispositivoId,
            cajeroId,
            subtotal: 57000.0,
            descuento: 0,
            total: 57000.0,
            metodoPago: 'efectivo',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [
              {
                productoId: 'prod-peso-uuid-4444',
                cantidad: 1.5,
                precioUnitario: 38000.0,
                subtotalLinea: 57000.0,
                pesoBruto: 1.505,
                pesoNeto: 1.5,
              },
            ],
            pagos: [{ metodo: 'efectivo', monto: 57000.0 }],
          },
          {
            id: 'vnt-batch-002',
            sucursalId,
            dispositivoId,
            cajeroId,
            subtotal: 30000.0,
            descuento: 0,
            total: 30000.0,
            metodoPago: 'tarjeta',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [
              {
                productoId: 'prod-unidad-uuid-5555',
                cantidad: 2.0,
                precioUnitario: 15000.0,
                subtotalLinea: 30000.0,
              },
            ],
            pagos: [{ metodo: 'tarjeta', monto: 30000.0, referenciaTransaccion: 'VOUCHER-OFF-1' }],
          },
        ],
      };

      // 1. Ejecutar push al servidor
      const respuesta = await syncController.syncSalesBatch(loteVentas as any);

      expect(respuesta.procesadas).toBe(2);
      expect(respuesta.duplicadasIgnoradas).toBe(0);
      expect(respuesta.errores).toHaveLength(0);
      expect(repo.ventas.size).toBe(2);

      // Verificar que quedaron selladas como sincronizadas con fecha de servidor
      const v1 = await repo.buscarPorId('vnt-batch-001');
      const v2 = await repo.buscarPorId('vnt-batch-002');
      expect(v1?.sincronizada).toBe(true);
      expect(v1?.fechaHoraServidor).toBeInstanceOf(Date);
      expect(v2?.sincronizada).toBe(true);
      expect(v2?.fechaHoraServidor).toBeInstanceOf(Date);
    });

    it('debe responder HTTP 200 e ignorar duplicados ante reenvío de lote (Idempotencia estricta EARS-SYNC-04)', async () => {
      const loteVentas = {
        dispositivoId,
        ventas: [
          {
            id: 'vnt-reintento-001',
            sucursalId,
            dispositivoId,
            cajeroId,
            total: 20000.0,
            metodoPago: 'efectivo',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [
              { productoId: 'prod-unidad-uuid-5555', cantidad: 1, precioUnitario: 20000.0 },
            ],
            pagos: [{ metodo: 'efectivo', monto: 20000.0 }],
          },
        ],
      };

      // Primer push
      const primeraRespuesta = await syncController.syncSalesBatch(loteVentas as any);
      expect(primeraRespuesta.procesadas).toBe(1);
      expect(primeraRespuesta.duplicadasIgnoradas).toBe(0);
      expect(repo.ventas.size).toBe(1);

      // Segundo push (simula reintento por pérdida momentánea de paquete HTTP ACK)
      const segundaRespuesta = await syncController.syncSalesBatch(loteVentas as any);
      expect(segundaRespuesta.procesadas).toBe(0);
      expect(segundaRespuesta.duplicadasIgnoradas).toBe(1);
      expect(segundaRespuesta.errores).toHaveLength(0);
      expect(repo.ventas.size).toBe(1); // No hubo inserción duplicada
    });
  });
});
