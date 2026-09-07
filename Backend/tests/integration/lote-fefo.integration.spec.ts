import { FefoDispatchService } from '../../src/modules/inventory/application/services/fefo-dispatch.service';
import { Lote, EstadoLote } from '../../src/modules/inventory/domain/entities/lote.entity';
import { Inventario } from '../../src/modules/inventory/domain/entities/inventario.entity';
import { MovimientoInventario } from '../../src/modules/inventory/domain/entities/movimiento-inventario.entity';
import { ILoteRepository } from '../../src/modules/inventory/domain/ports/lote-repository.port';
import { IInventarioRepository } from '../../src/modules/inventory/domain/ports/inventario-repository.port';
import { IMovimientoRepository } from '../../src/modules/inventory/domain/ports/movimiento-repository.port';
import { BadRequestException } from '@nestjs/common';

class TestLoteRepository implements ILoteRepository {
  public lotes: Lote[] = [];

  async crear(lote: Lote): Promise<Lote> {
    this.lotes.push(lote);
    return lote;
  }

  async crearMuchos(lotes: Lote[]): Promise<Lote[]> {
    this.lotes.push(...lotes);
    return lotes;
  }

  async buscarPorId(id: string): Promise<Lote | null> {
    return this.lotes.find((l) => l.id === id) || null;
  }

  async buscarPorCodigo(codigoLote: string, sucursalId: string): Promise<Lote | null> {
    return this.lotes.find((l) => l.codigoLote === codigoLote && l.sucursalId === sucursalId) || null;
  }

  async buscarPorSucursal(sucursalId: string, productoId?: string, estado?: EstadoLote): Promise<Lote[]> {
    return this.lotes.filter((l) => {
      if (l.sucursalId !== sucursalId) return false;
      if (productoId && l.productoId !== productoId) return false;
      if (estado && l.estado !== estado) return false;
      return true;
    });
  }

  async buscarLotesActivosPorProductoFEFO(productoId: string, sucursalId: string): Promise<Lote[]> {
    return this.lotes
      .filter((l) => l.sucursalId === sucursalId && l.productoId === productoId && l.estado === 'activo')
      .sort((a, b) => {
        if (!a.fechaVencimiento) return 1;
        if (!b.fechaVencimiento) return -1;
        return a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime();
      });
  }

  async buscarProximosAVencer(sucursalId: string, diasLimite: number): Promise<Lote[]> {
    const ahora = new Date();
    return this.lotes.filter((l) => l.sucursalId === sucursalId && l.esProximoAVencer(diasLimite, ahora));
  }

  async actualizar(lote: Lote): Promise<Lote> {
    const index = this.lotes.findIndex((l) => l.id === lote.id);
    if (index >= 0) {
      this.lotes[index] = lote;
    }
    return lote;
  }

  async actualizarMuchos(lotes: Lote[]): Promise<void> {
    for (const lote of lotes) {
      await this.actualizar(lote);
    }
  }
}

class TestInventarioRepository implements IInventarioRepository {
  public inventarios: Inventario[] = [];

  async crear(inventario: Inventario): Promise<Inventario> {
    this.inventarios.push(inventario);
    return inventario;
  }

  async buscarPorProductoYSucursal(productoId: string, sucursalId: string): Promise<Inventario | null> {
    return (
      this.inventarios.find(
        (inv) => inv.productoId === productoId && inv.sucursalId === sucursalId,
      ) || null
    );
  }

  async buscarPorSucursal(sucursalId: string): Promise<Inventario[]> {
    return this.inventarios.filter((inv) => inv.sucursalId === sucursalId);
  }

  async buscarBajoStock(sucursalId: string): Promise<Inventario[]> {
    return this.inventarios.filter(
      (inv) => inv.sucursalId === sucursalId && inv.tieneAlertaStockBajo(),
    );
  }

  async actualizar(inventario: Inventario): Promise<Inventario> {
    const index = this.inventarios.findIndex((inv) => inv.id === inventario.id);
    if (index >= 0) {
      this.inventarios[index] = inventario;
    }
    return inventario;
  }
}

class TestMovimientoRepository implements IMovimientoRepository {
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

describe('Lote FEFO Integration — Algoritmo de Despacho Automático en Ventas', () => {
  let fefoService: FefoDispatchService;
  let loteRepo: TestLoteRepository;
  let inventarioRepo: TestInventarioRepository;
  let movimientoRepo: TestMovimientoRepository;

  const SUCURSAL_ID = 'suc-central-uuid';
  const PRODUCTO_ID = 'prod-lomo-fino-uuid';

  beforeEach(async () => {
    loteRepo = new TestLoteRepository();
    inventarioRepo = new TestInventarioRepository();
    movimientoRepo = new TestMovimientoRepository();

    fefoService = new FefoDispatchService(loteRepo, inventarioRepo, movimientoRepo);

    // Inicializar inventario general
    await inventarioRepo.crear(
      new Inventario({
        id: 'inv-1',
        sucursalId: SUCURSAL_ID,
        productoId: PRODUCTO_ID,
        cantidadActual: 30.0,
        cantidadMinimaAlerta: 5.0,
      }),
    );
  });

  it('debe despachar automáticamente del lote con vencimiento más próximo (FEFO - EARS-LOTE-02)', async () => {
    const ahora = Date.now();
    // Lote A vence en 5 días
    const loteA = new Lote({
      id: 'lote-A',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-A-5DIAS',
      proveedor: 'Proveedor Norte',
      cantidadRecibida: 10.0,
      cantidadDisponible: 10.0,
      costoUnitario: 50.0,
      fechaVencimiento: new Date(ahora + 5 * 24 * 60 * 60 * 1000),
    });

    // Lote B vence en 2 días (FEFO prioritario)
    const loteB = new Lote({
      id: 'lote-B',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-B-2DIAS',
      proveedor: 'Proveedor Sur',
      cantidadRecibida: 10.0,
      cantidadDisponible: 10.0,
      costoUnitario: 55.0,
      fechaVencimiento: new Date(ahora + 2 * 24 * 60 * 60 * 1000),
    });

    await loteRepo.crearMuchos([loteA, loteB]);

    const resultado = await fefoService.despacharFefo({
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      cantidad: 4.5,
      ventaId: 'venta-1001',
    });

    expect(resultado.completamenteCubierto).toBe(true);
    expect(resultado.cantidadTotalDespachada).toBe(4.5);
    expect(resultado.asignaciones.length).toBe(1);

    // Debe haber seleccionado Lote B primero
    const asignacion = resultado.asignaciones[0];
    expect(asignacion.loteId).toBe('lote-B');
    expect(asignacion.codigoLote).toBe('LOTE-B-2DIAS');
    expect(asignacion.cantidadDescontada).toBe(4.5);
    expect(asignacion.loteAgotado).toBe(false);

    // Lote B debe tener 5.5 restante
    const loteBActualizado = await loteRepo.buscarPorId('lote-B');
    expect(loteBActualizado?.cantidadDisponible).toBe(5.5);
    expect(loteBActualizado?.estado).toBe('activo');

    // Lote A no debe haber sido tocado
    const loteAActualizado = await loteRepo.buscarPorId('lote-A');
    expect(loteAActualizado?.cantidadDisponible).toBe(10.0);
  });

  it('debe realizar distribución multi-lote cuando el primer lote no cubre la cantidad vendida (US-18)', async () => {
    const ahora = Date.now();
    // Lote 1 vence en 2 días con 3.0 kg
    const lote1 = new Lote({
      id: 'lote-1',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-1-CORTO',
      proveedor: 'Carnes SA',
      cantidadRecibida: 3.0,
      cantidadDisponible: 3.0,
      costoUnitario: 40.0,
      fechaVencimiento: new Date(ahora + 2 * 24 * 60 * 60 * 1000),
    });

    // Lote 2 vence en 6 días con 10.0 kg
    const lote2 = new Lote({
      id: 'lote-2',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-2-LARGO',
      proveedor: 'Carnes SA',
      cantidadRecibida: 10.0,
      cantidadDisponible: 10.0,
      costoUnitario: 42.0,
      fechaVencimiento: new Date(ahora + 6 * 24 * 60 * 60 * 1000),
    });

    await loteRepo.crearMuchos([lote1, lote2]);

    // Solicitar 5.5 kg (3.0 kg de Lote 1 + 2.5 kg de Lote 2)
    const resultado = await fefoService.despacharFefo({
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      cantidad: 5.5,
      ventaId: 'venta-1002',
    });

    expect(resultado.completamenteCubierto).toBe(true);
    expect(resultado.cantidadTotalDespachada).toBe(5.5);
    expect(resultado.asignaciones.length).toBe(2);

    // Asignación 1: Consume la totalidad de Lote 1
    expect(resultado.asignaciones[0].loteId).toBe('lote-1');
    expect(resultado.asignaciones[0].cantidadDescontada).toBe(3.0);
    expect(resultado.asignaciones[0].loteAgotado).toBe(true);

    // Asignación 2: Consume restante de Lote 2
    expect(resultado.asignaciones[1].loteId).toBe('lote-2');
    expect(resultado.asignaciones[1].cantidadDescontada).toBe(2.5);
    expect(resultado.asignaciones[1].loteAgotado).toBe(false);

    // Verificación de estados en repositorio
    const l1 = await loteRepo.buscarPorId('lote-1');
    expect(l1?.cantidadDisponible).toBe(0.0);
    expect(l1?.estado).toBe('agotado'); // EARS-LOTE-04

    const l2 = await loteRepo.buscarPorId('lote-2');
    expect(l2?.cantidadDisponible).toBe(7.5);
    expect(l2?.estado).toBe('activo');

    // Costo total ponderado: (3.0 * 40.0) + (2.5 * 42.0) = 120 + 105 = 225.00
    expect(resultado.costoTotalDespacho).toBe(225.0);
  });

  it('debe mutar automáticamente el estado a agotado cuando la cantidad disponible llega a 0.000 (EARS-LOTE-04)', async () => {
    const lote = new Lote({
      id: 'lote-exacto',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-EXACTO',
      proveedor: 'Proveedor Local',
      cantidadRecibida: 7.25,
      cantidadDisponible: 7.25,
      costoUnitario: 30.0,
      fechaVencimiento: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    });

    await loteRepo.crear(lote);

    const resultado = await fefoService.despacharFefo({
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      cantidad: 7.25,
      ventaId: 'venta-1003',
    });

    expect(resultado.asignaciones[0].loteAgotado).toBe(true);
    const loteGuardado = await loteRepo.buscarPorId('lote-exacto');
    expect(loteGuardado?.cantidadDisponible).toBe(0.0);
    expect(loteGuardado?.estado).toBe('agotado');
  });

  it('debe excluir lotes vencidos en fecha para proteger la seguridad alimentaria', async () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const en3Dias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const loteExpirado = new Lote({
      id: 'lote-expirado',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-AYER',
      proveedor: 'Proveedor Malo',
      cantidadRecibida: 10.0,
      cantidadDisponible: 10.0,
      costoUnitario: 20.0,
      fechaVencimiento: ayer,
    });

    const loteBueno = new Lote({
      id: 'lote-bueno',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-VIGENTE',
      proveedor: 'Proveedor Bueno',
      cantidadRecibida: 10.0,
      cantidadDisponible: 10.0,
      costoUnitario: 45.0,
      fechaVencimiento: en3Dias,
    });

    await loteRepo.crearMuchos([loteExpirado, loteBueno]);

    const resultado = await fefoService.despacharFefo({
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      cantidad: 5.0,
    });

    expect(resultado.asignaciones.length).toBe(1);
    expect(resultado.asignaciones[0].loteId).toBe('lote-bueno');

    // El lote expirado debió ser mutado a 'vencido'
    const exp = await loteRepo.buscarPorId('lote-expirado');
    expect(exp?.estado).toBe('vencido');
  });

  it('debe rechazar con BadRequestException si no hay suficiente stock en lotes y no se permite stock negativo (Modo Online)', async () => {
    const lote = new Lote({
      id: 'lote-insuficiente',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-POCO',
      proveedor: 'Carnes',
      cantidadRecibida: 2.0,
      cantidadDisponible: 2.0,
      costoUnitario: 60.0,
      fechaVencimiento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    await loteRepo.crear(lote);

    await expect(
      fefoService.despacharFefo({
        productoId: PRODUCTO_ID,
        sucursalId: SUCURSAL_ID,
        cantidad: 5.0, // Pide 5 pero solo hay 2
        permitirStockNegativo: false,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe permitir despacho con stock negativo / remanente pendiente de asignación en modo offline (EC-LOTE-03)', async () => {
    const lote = new Lote({
      id: 'lote-offline',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-OFFLINE',
      proveedor: 'Carnes',
      cantidadRecibida: 4.0,
      cantidadDisponible: 4.0,
      costoUnitario: 50.0,
      fechaVencimiento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    await loteRepo.crear(lote);

    const resultado = await fefoService.despacharFefo({
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      cantidad: 6.5, // Pide 6.5, consume 4.0 del lote y quedan 2.5 pendientes
      permitirStockNegativo: true,
      ventaId: 'venta-offline-001',
    });

    expect(resultado.completamenteCubierto).toBe(false);
    expect(resultado.cantidadTotalDespachada).toBe(4.0);
    expect(resultado.cantidadPendienteSinLote).toBe(2.5);

    // Se debió registrar un movimiento de auditoría por el remanente sin lote (loteId = null)
    const movs = movimientoRepo.movimientos;
    const movPendiente = movs.find((m) => m.loteId === null);
    expect(movPendiente).toBeDefined();
    expect(movPendiente?.cantidadDelta).toBe(-2.5);
  });
});
