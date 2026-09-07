import { ConflictoService } from '../../../src/modules/sync/application/services/conflicto.service';
import { Inventario } from '../../../src/modules/inventory/domain/entities/inventario.entity';
import { MovimientoInventario } from '../../../src/modules/inventory/domain/entities/movimiento-inventario.entity';
import { IInventarioRepository } from '../../../src/modules/inventory/domain/ports/inventario-repository.port';
import { IMovimientoRepository } from '../../../src/modules/inventory/domain/ports/movimiento-repository.port';
import { IDomainEventEmitter } from '../../../src/modules/sales/application/services/venta.service';
import { AlertaStockNegativoEvent } from '../../../src/modules/sync/application/dtos/alerta-stock-negativo.dto';

class MockInventarioRepo implements IInventarioRepository {
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

class MockMovimientoRepo implements IMovimientoRepository {
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

class MockEventEmitter implements IDomainEventEmitter {
  public emittedEvents: { event: string; payload: any }[] = [];

  emit(event: string, payload: any): void {
    this.emittedEvents.push({ event, payload });
  }
}

describe('ConflictoService - Resolución Concurrente de Inventario Offline (Unitario)', () => {
  let conflictoService: ConflictoService;
  let inventarioRepo: MockInventarioRepo;
  let movimientoRepo: MockMovimientoRepo;
  let eventEmitter: MockEventEmitter;

  const sucursalId = 'suc-123e4567-e89b-12d3-a456-426614174000';
  const productoId = 'prod-lomo-fino-1111';
  const cajeroId = 'usr-cajero-01';

  beforeEach(() => {
    inventarioRepo = new MockInventarioRepo();
    movimientoRepo = new MockMovimientoRepo();
    eventEmitter = new MockEventEmitter();
    conflictoService = new ConflictoService(inventarioRepo, movimientoRepo, eventEmitter);
  });

  it('debe aplicar deltas cronológicos concurrentes de dos cajas sin pisar el stock (EARS-SYNC-05, PA-02)', async () => {
    // Stock inicial en servidor: 10.0 kg
    const inventarioInicial = new Inventario({
      id: 'inv-001',
      sucursalId,
      productoId,
      cantidadActual: 10.0,
      cantidadMinimaAlerta: 3.0,
    });
    await inventarioRepo.crear(inventarioInicial);

    // Caja 1 sincroniza venta de 2.5 kg
    const res1 = await conflictoService.aplicarDeltasVentaOffline({
      ventaId: 'vnt-caja1-001',
      sucursalId,
      dispositivoId: 'term-pos-caja-1',
      cajeroId,
      fechaHoraDispositivo: new Date('2026-09-07T10:00:00Z'),
      items: [{ productoId, cantidad: 2.5 }],
    });

    expect(res1.deltasAplicados[0].delta).toBe(-2.5);
    expect(res1.deltasAplicados[0].stockNuevo).toBe(7.5);
    expect(res1.alertasGeneradas).toHaveLength(0);

    // Caja 2 sincroniza venta de 4.0 kg efectuada offline simultáneamente
    const res2 = await conflictoService.aplicarDeltasVentaOffline({
      ventaId: 'vnt-caja2-001',
      sucursalId,
      dispositivoId: 'term-pos-caja-2',
      cajeroId,
      fechaHoraDispositivo: new Date('2026-09-07T10:01:00Z'),
      items: [{ productoId, cantidad: 4.0 }],
    });

    expect(res2.deltasAplicados[0].delta).toBe(-4.0);
    expect(res2.deltasAplicados[0].stockNuevo).toBe(3.5);
    expect(res2.alertasGeneradas).toHaveLength(0);

    // Verificar persistencia en repositorio
    const invFinal = await inventarioRepo.buscarPorProductoYSucursal(productoId, sucursalId);
    expect(invFinal?.cantidadActual).toBe(3.5);

    // Verificar movimientos de auditoría generados con deltas negativos (EARS-INV-01)
    expect(movimientoRepo.movimientos).toHaveLength(2);
    expect(movimientoRepo.movimientos[0].cantidadDelta).toBe(-2.5);
    expect(movimientoRepo.movimientos[1].cantidadDelta).toBe(-4.0);
  });

  it('debe generar alerta de stock negativo sin bloquear la venta si el stock consolidado queda menor a cero (Caso Límite 3)', async () => {
    // Stock inicial en servidor: 2.0 kg
    const inventarioInicial = new Inventario({
      id: 'inv-002',
      sucursalId,
      productoId,
      cantidadActual: 2.0,
      cantidadMinimaAlerta: 1.0,
    });
    await inventarioRepo.crear(inventarioInicial);

    // Caja 1 vendió 2.0 kg offline
    await conflictoService.aplicarDeltasVentaOffline({
      ventaId: 'vnt-caja1-002',
      sucursalId,
      dispositivoId: 'term-pos-caja-1',
      cajeroId,
      fechaHoraDispositivo: new Date('2026-09-07T10:00:00Z'),
      items: [{ productoId, cantidad: 2.0 }],
    });

    // Caja 2 vendió 1.5 kg offline (al llegar provoca sobregiro de -1.5 kg)
    const resCaja2 = await conflictoService.aplicarDeltasVentaOffline({
      ventaId: 'vnt-caja2-002',
      sucursalId,
      dispositivoId: 'term-pos-caja-2',
      cajeroId,
      fechaHoraDispositivo: new Date('2026-09-07T10:02:00Z'),
      items: [{ productoId, cantidad: 1.5 }],
    });

    // La venta NO debe ser bloqueada ni revertida
    expect(resCaja2.ventaId).toBe('vnt-caja2-002');
    expect(resCaja2.deltasAplicados[0].stockNuevo).toBe(-1.5);
    expect(resCaja2.alertasGeneradas).toHaveLength(1);

    const alerta = resCaja2.alertasGeneradas[0];
    expect(alerta.productoId).toBe(productoId);
    expect(alerta.stockResultante).toBe(-1.5);
    expect(alerta.deltaAplicado).toBe(-1.5);
    expect(alerta.referenciaVentaId).toBe('vnt-caja2-002');
    expect(alerta.dispositivoId).toBe('term-pos-caja-2');
    expect(alerta.severidad).toBe('alta');
    expect(alerta.mensaje).toContain('alcanzó un stock negativo de -1.500');

    // Verificar que se emitió el evento de dominio (DDD)
    expect(eventEmitter.emittedEvents).toHaveLength(1);
    expect(eventEmitter.emittedEvents[0].event).toBe(AlertaStockNegativoEvent.EVENT_NAME);

    // Verificar que el inventario se actualizó con el valor en sobregiro
    const invFinal = await inventarioRepo.buscarPorProductoYSucursal(productoId, sucursalId);
    expect(invFinal?.cantidadActual).toBe(-1.5);
    expect(invFinal?.tieneStockNegativo()).toBe(true);

    // Auditoría en MovimientoInventario debe reflejar el delta y el nuevo stock
    const ultimoMov = movimientoRepo.movimientos[movimientoRepo.movimientos.length - 1];
    expect(ultimoMov.cantidadDelta).toBe(-1.5);
    expect(ultimoMov.cantidadNueva).toBe(-1.5);
    expect(ultimoMov.referenciaId).toBe('vnt-caja2-002');
  });

  it('debe catalogar con severidad critica si el stock resultante es menor a -10.0 kg', async () => {
    const res = await conflictoService.aplicarDeltasVentaOffline({
      ventaId: 'vnt-gran-sobregiro',
      sucursalId,
      dispositivoId: 'term-pos-caja-3',
      cajeroId,
      fechaHoraDispositivo: new Date(),
      items: [{ productoId: 'prod-pesado', cantidad: 15.0 }],
    });

    expect(res.alertasGeneradas[0].severidad).toBe('critica');
  });

  it('debe permitir consultar alertas de stock negativo filtradas por sucursal', async () => {
    await conflictoService.aplicarDeltasVentaOffline({
      ventaId: 'vnt-alerta-1',
      sucursalId,
      dispositivoId: 'term-1',
      cajeroId,
      fechaHoraDispositivo: new Date(),
      items: [{ productoId, cantidad: 5.0 }],
    });

    const alertas = conflictoService.consultarAlertasStockNegativo(sucursalId);
    expect(alertas.length).toBeGreaterThanOrEqual(1);

    const alertasOtraSucursal = conflictoService.consultarAlertasStockNegativo('otra-sucursal');
    expect(alertasOtraSucursal).toHaveLength(0);
  });
});

