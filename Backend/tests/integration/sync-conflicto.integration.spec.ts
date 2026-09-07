import { SyncService } from '../../src/modules/sync/application/services/sync.service';
import { SyncController } from '../../src/modules/sync/presentation/http/sync.controller';
import { ConflictoService } from '../../src/modules/sync/application/services/conflicto.service';
import { VentaService } from '../../src/modules/sales/application/services/venta.service';
import { CorteCajaService } from '../../src/modules/cash/application/services/corte-caja.service';
import { Venta } from '../../src/modules/sales/domain/entities/venta.entity';
import { Inventario } from '../../src/modules/inventory/domain/entities/inventario.entity';
import { MovimientoInventario } from '../../src/modules/inventory/domain/entities/movimiento-inventario.entity';
import { IVentaRepository } from '../../src/modules/sales/domain/ports/venta-repository.port';
import { IInventarioRepository } from '../../src/modules/inventory/domain/ports/inventario-repository.port';
import { IMovimientoRepository } from '../../src/modules/inventory/domain/ports/movimiento-repository.port';

class IntegrationVentaRepository implements IVentaRepository {
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

class IntegrationInventarioRepository implements IInventarioRepository {
  public inventarios: Map<string, Inventario> = new Map();

  async crear(inventario: Inventario): Promise<Inventario> {
    this.inventarios.set(`${inventario.sucursalId}:${inventario.productoId}`, inventario);
    return inventario;
  }

  async buscarPorProductoYSucursal(productoId: string, sucursalId: string): Promise<Inventario | null> {
    return this.inventarios.get(`${sucursalId}:${productoId}`) || null;
  }

  async buscarPorSucursal(sucursalId: string): Promise<Inventario[]> {
    return Array.from(this.inventarios.values()).filter((i) => i.sucursalId === sucursalId);
  }

  async buscarBajoStock(sucursalId: string): Promise<Inventario[]> {
    return Array.from(this.inventarios.values()).filter(
      (i) => i.sucursalId === sucursalId && i.tieneAlertaStockBajo(),
    );
  }

  async actualizar(inventario: Inventario): Promise<Inventario> {
    this.inventarios.set(`${inventario.sucursalId}:${inventario.productoId}`, inventario);
    return inventario;
  }
}

class IntegrationMovimientoRepository implements IMovimientoRepository {
  public movimientos: MovimientoInventario[] = [];

  async crear(movimiento: MovimientoInventario): Promise<MovimientoInventario> {
    this.movimientos.push(movimiento);
    return movimiento;
  }

  async crearMuchos(movimientos: MovimientoInventario[]): Promise<MovimientoInventario[]> {
    this.movimientos.push(...movimientos);
    return movimientos;
  }

  async buscarPorSucursal(sucursalId: string): Promise<MovimientoInventario[]> {
    return this.movimientos.filter((m) => m.sucursalId === sucursalId);
  }

  async buscarPorProducto(productoId: string, sucursalId: string): Promise<MovimientoInventario[]> {
    return this.movimientos.filter((m) => m.productoId === productoId && m.sucursalId === sucursalId);
  }
}

describe('Integración: Manejo de Conflictos y Concurrencia Multi-Caja (TASK-15)', () => {
  let ventaRepo: IntegrationVentaRepository;
  let inventarioRepo: IntegrationInventarioRepository;
  let movimientoRepo: IntegrationMovimientoRepository;
  let corteCajaService: CorteCajaService;
  let ventaService: VentaService;
  let conflictoService: ConflictoService;
  let syncService: SyncService;
  let syncController: SyncController;

  const sucursalId = 'suc-123e4567-e89b-12d3-a456-426614174000';
  const productoId = 'prod-costilla-res-001';
  const cajero1Id = 'usr-cajero-01';
  const cajero2Id = 'usr-cajero-02';

  beforeEach(async () => {
    ventaRepo = new IntegrationVentaRepository();
    inventarioRepo = new IntegrationInventarioRepository();
    movimientoRepo = new IntegrationMovimientoRepository();
    corteCajaService = new CorteCajaService();
    ventaService = new VentaService(ventaRepo, corteCajaService);
    conflictoService = new ConflictoService(inventarioRepo, movimientoRepo);
    syncService = new SyncService(ventaService, ventaRepo, conflictoService);
    syncController = new SyncController(syncService);

    // Inicializar inventario central en servidor: 5.000 kg
    const inventarioCentral = new Inventario({
      id: 'inv-costilla-001',
      sucursalId,
      productoId,
      cantidadActual: 5.0,
      cantidadMinimaAlerta: 2.0,
    });
    await inventarioRepo.crear(inventarioCentral);
  });

  it('debe consolidar deltas concurrentes de dos terminales y reportar alertas si stock < 0 sin bloquear ventas (EARS-SYNC-05, PA-02, Caso Límite 3)', async () => {
    // 1. Terminal 1 vende 3.500 kg en modo offline
    const batchTerminal1 = {
      dispositivoId: 'term-pos-mostrador-1',
      ventas: [
        {
          id: 'vnt-offline-term1-01',
          sucursalId,
          dispositivoId: 'term-pos-mostrador-1',
          cajeroId: cajero1Id,
          subtotal: 105000.0,
          descuento: 0,
          total: 105000.0,
          metodoPago: 'efectivo',
          fechaHoraDispositivo: '2026-09-07T11:00:00.000Z',
          detalles: [
            {
              productoId,
              cantidad: 3.5,
              precioUnitario: 30000.0,
              subtotalLinea: 105000.0,
            },
          ],
          pagos: [{ metodo: 'efectivo', monto: 105000.0 }],
        },
      ],
    };

    // 2. Terminal 2 vende 2.500 kg en modo offline simultáneamente (existencia compartida)
    const batchTerminal2 = {
      dispositivoId: 'term-pos-mostrador-2',
      ventas: [
        {
          id: 'vnt-offline-term2-01',
          sucursalId,
          dispositivoId: 'term-pos-mostrador-2',
          cajeroId: cajero2Id,
          subtotal: 75000.0,
          descuento: 0,
          total: 75000.0,
          metodoPago: 'tarjeta',
          fechaHoraDispositivo: '2026-09-07T11:02:00.000Z',
          detalles: [
            {
              productoId,
              cantidad: 2.5,
              precioUnitario: 30000.0,
              subtotalLinea: 75000.0,
            },
          ],
          pagos: [{ metodo: 'tarjeta', monto: 75000.0, referenciaTransaccion: 'VOUCHER-CC-02' }],
        },
      ],
    };

    // 3. Llega sincronización de Terminal 1 al servidor
    const resSync1 = await syncController.syncSalesBatch(batchTerminal1 as any);
    expect(resSync1.procesadas).toBe(1);
    expect(resSync1.duplicadasIgnoradas).toBe(0);
    expect(resSync1.alertasStockNegativo).toBeUndefined();

    // Stock intermedio en servidor: 5.0 - 3.5 = 1.500 kg
    const invMedio = await inventarioRepo.buscarPorProductoYSucursal(productoId, sucursalId);
    expect(invMedio?.cantidadActual).toBe(1.5);

    // 4. Llega sincronización de Terminal 2 al servidor (1.5 - 2.5 = -1.000 kg)
    const resSync2 = await syncController.syncSalesBatch(batchTerminal2 as any);

    // La venta se procesa exitosamente sin abortos ni errores HTTP 500
    expect(resSync2.procesadas).toBe(1);
    expect(resSync2.duplicadasIgnoradas).toBe(0);
    expect(resSync2.errores).toHaveLength(0);

    // EARS-SYNC-05: Emite alerta de stock negativo
    expect(resSync2.alertasStockNegativo).toBeDefined();
    expect(resSync2.alertasStockNegativo).toHaveLength(1);

    const alerta = resSync2.alertasStockNegativo![0];
    expect(alerta.productoId).toBe(productoId);
    expect(alerta.stockResultante).toBe(-1.0);
    expect(alerta.deltaAplicado).toBe(-2.5);
    expect(alerta.dispositivoId).toBe('term-pos-mostrador-2');
    expect(alerta.referenciaVentaId).toBe('vnt-offline-term2-01');

    // 5. Verificación de persistencia consolidada en BD Supabase simulada
    const invFinal = await inventarioRepo.buscarPorProductoYSucursal(productoId, sucursalId);
    expect(invFinal?.cantidadActual).toBe(-1.0);
    expect(invFinal?.tieneStockNegativo()).toBe(true);

    // Ambas ventas persisten como sincronizadas
    const v1 = await ventaRepo.buscarPorId('vnt-offline-term1-01');
    const v2 = await ventaRepo.buscarPorId('vnt-offline-term2-01');
    expect(v1?.sincronizada).toBe(true);
    expect(v2?.sincronizada).toBe(true);

    // Movimientos de inventario registrados con deltas negativos
    expect(movimientoRepo.movimientos).toHaveLength(2);
    expect(movimientoRepo.movimientos[0].cantidadDelta).toBe(-3.5);
    expect(movimientoRepo.movimientos[1].cantidadDelta).toBe(-2.5);
    expect(movimientoRepo.movimientos[1].cantidadNueva).toBe(-1.0);
  });
});

