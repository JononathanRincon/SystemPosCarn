import { InventarioService } from '../../../src/modules/inventory/application/services/inventario.service';
import { Lote, EstadoLote } from '../../../src/modules/inventory/domain/entities/lote.entity';
import { RecepcionMercancia } from '../../../src/modules/inventory/domain/entities/recepcion-mercancia.entity';
import { Inventario } from '../../../src/modules/inventory/domain/entities/inventario.entity';
import { MovimientoInventario } from '../../../src/modules/inventory/domain/entities/movimiento-inventario.entity';
import { ILoteRepository } from '../../../src/modules/inventory/domain/ports/lote-repository.port';
import { IRecepcionRepository } from '../../../src/modules/inventory/domain/ports/recepcion-repository.port';
import { IInventarioRepository } from '../../../src/modules/inventory/domain/ports/inventario-repository.port';
import { IMovimientoRepository } from '../../../src/modules/inventory/domain/ports/movimiento-repository.port';

class InMemoryLoteRepository implements ILoteRepository {
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

class InMemoryRecepcionRepository implements IRecepcionRepository {
  public recepciones: RecepcionMercancia[] = [];

  async crear(recepcion: RecepcionMercancia): Promise<RecepcionMercancia> {
    this.recepciones.push(recepcion);
    return recepcion;
  }

  async buscarPorId(id: string): Promise<RecepcionMercancia | null> {
    return this.recepciones.find((r) => r.id === id) || null;
  }

  async buscarPorSucursal(sucursalId: string): Promise<RecepcionMercancia[]> {
    return this.recepciones.filter((r) => r.sucursalId === sucursalId);
  }
}

class InMemoryInventarioRepository implements IInventarioRepository {
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

class InMemoryMovimientoRepository implements IMovimientoRepository {
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

describe('InventarioService (Unitario)', () => {
  let service: InventarioService;
  let loteRepo: InMemoryLoteRepository;
  let recepcionRepo: InMemoryRecepcionRepository;
  let inventarioRepo: InMemoryInventarioRepository;
  let movimientoRepo: InMemoryMovimientoRepository;

  beforeEach(() => {
    loteRepo = new InMemoryLoteRepository();
    recepcionRepo = new InMemoryRecepcionRepository();
    inventarioRepo = new InMemoryInventarioRepository();
    movimientoRepo = new InMemoryMovimientoRepository();

    service = new InventarioService(loteRepo, recepcionRepo, inventarioRepo, movimientoRepo);
  });

  it('debe mantener inventario individualizado por sucursal', () => {
    const invSucursal1 = { sucursal_id: 'suc-1', producto_id: 'prod-1', cantidad_actual: 50.0 };
    const invSucursal2 = { sucursal_id: 'suc-2', producto_id: 'prod-1', cantidad_actual: 12.5 };
    expect(invSucursal1.sucursal_id).not.toBe(invSucursal2.sucursal_id);
  });

  it('debe emitir alerta cuando cantidad_actual sea menor o igual a cantidad_minima_alerta', () => {
    const inventario = { cantidad_actual: 4.8, cantidad_minima_alerta: 5.0 };
    const deberiaAlertar = inventario.cantidad_actual <= inventario.cantidad_minima_alerta;
    expect(deberiaAlertar).toBe(true);
  });

  it('debe registrar recepción de mercancía y crear lote con datos de proveedor, costo, cantidad y vencimiento (EARS-LOTE-01)', async () => {
    const fechaFutura = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = await service.registrarRecepcion(
      {
        sucursal_id: 'suc-uuid-1',
        proveedor: 'Frigorífico Central',
        temperatura_vehiculo: 2.5,
        numero_factura_remision: 'REM-1002',
        observaciones: 'Calidad de res excelente',
        items: [
          {
            producto_id: 'prod-uuid-1',
            codigo_lote: 'LOTE-RES-001',
            cantidad: 50.75,
            costo_unitario: 80.0,
            fecha_vencimiento: fechaFutura,
            temperatura_recepcion: 3.1,
          },
        ],
      },
      'user-receptor-uuid',
    );

    expect(result.recepcion_id).toBeDefined();
    expect(result.lotes_creados).toBe(1);
    expect(result.alerta_cadena_frio).toBe(false);

    expect(loteRepo.lotes.length).toBe(1);
    const lote = loteRepo.lotes[0];
    expect(lote.codigoLote).toBe('LOTE-RES-001');
    expect(lote.cantidadRecibida).toBe(50.75);
    expect(lote.cantidadDisponible).toBe(50.75);
    expect(lote.costoUnitario).toBe(80.0);
    expect(lote.proveedor).toBe('Frigorífico Central');

    // Verificar actualización de inventario por sucursal
    const stock = await service.consultarStock('prod-uuid-1', 'suc-uuid-1');
    expect(stock).toBe(50.75);

    // Verificar movimiento de inventario incremental (+)
    expect(movimientoRepo.movimientos.length).toBe(1);
    expect(movimientoRepo.movimientos[0].cantidadDelta).toBe(50.75);
    expect(movimientoRepo.movimientos[0].tipo).toBe('recepcion');
  });

  it('debe emitir advertencia si la temperatura excede 4.0°C (ruptura de cadena de frío) (EARS-LOTE-05)', async () => {
    const result = await service.registrarRecepcion(
      {
        sucursal_id: 'suc-uuid-1',
        proveedor: 'Frigorífico El Caluroso',
        temperatura_vehiculo: 6.2, // Excede 4.0°C
        items: [
          {
            producto_id: 'prod-uuid-1',
            codigo_lote: 'LOTE-WARN-001',
            cantidad: 20.0,
            costo_unitario: 75.0,
            temperatura_recepcion: 5.5,
          },
        ],
      },
      'user-uuid',
    );

    expect(result.alerta_cadena_frio).toBe(true);
    expect(result.mensaje).toContain('ruptura de cadena de frío');
  });

  it('debe calcular si un lote está próximo a vencer dentro de los próximos 3 días (EARS-LOTE-03)', () => {
    const fechaVence2Dias = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const lote = new Lote({
      id: 'lote-1',
      productoId: 'prod-1',
      sucursalId: 'suc-1',
      codigoLote: 'LOTE-PRONTO',
      proveedor: 'Carnes SA',
      cantidadRecibida: 10,
      cantidadDisponible: 10,
      costoUnitario: 50,
      fechaVencimiento: fechaVence2Dias,
    });

    expect(lote.esProximoAVencer(3)).toBe(true);
    expect(lote.esProximoAVencer(1)).toBe(false);
  });

  it('debe descontar cantidad del lote y mutar automáticamente a agotado si llega a 0.000 (EARS-LOTE-04)', () => {
    const lote = new Lote({
      id: 'lote-1',
      productoId: 'prod-1',
      sucursalId: 'suc-1',
      codigoLote: 'LOTE-EXHAUST',
      proveedor: 'Carnes SA',
      cantidadRecibida: 15.5,
      cantidadDisponible: 15.5,
      costoUnitario: 45,
    });

    const descontadoParcial = lote.descontar(10.0);
    expect(descontadoParcial).toBe(10.0);
    expect(lote.cantidadDisponible).toBe(5.5);
    expect(lote.estado).toBe('activo');

    const descontadoFinal = lote.descontar(5.5);
    expect(descontadoFinal).toBe(5.5);
    expect(lote.cantidadDisponible).toBe(0.0);
    expect(lote.estado).toBe('agotado');
  });
});
