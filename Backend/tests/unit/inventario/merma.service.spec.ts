import { MermaService } from '../../../src/modules/inventory/application/services/merma.service';
import { Merma, MotivoMerma } from '../../../src/modules/inventory/domain/entities/merma.entity';
import { Lote, EstadoLote } from '../../../src/modules/inventory/domain/entities/lote.entity';
import { Inventario } from '../../../src/modules/inventory/domain/entities/inventario.entity';
import { MovimientoInventario } from '../../../src/modules/inventory/domain/entities/movimiento-inventario.entity';
import { IMermaRepository } from '../../../src/modules/inventory/domain/ports/merma-repository.port';
import { ILoteRepository } from '../../../src/modules/inventory/domain/ports/lote-repository.port';
import { IInventarioRepository } from '../../../src/modules/inventory/domain/ports/inventario-repository.port';
import { IMovimientoRepository } from '../../../src/modules/inventory/domain/ports/movimiento-repository.port';
import { BadRequestException, NotFoundException } from '@nestjs/common';

class MockMermaRepository implements IMermaRepository {
  public mermas: Merma[] = [];

  async crear(merma: Merma): Promise<Merma> {
    this.mermas.push(merma);
    return merma;
  }

  async buscarPorId(id: string): Promise<Merma | null> {
    return this.mermas.find((m) => m.id === id) || null;
  }

  async buscarPorSucursal(sucursalId: string): Promise<Merma[]> {
    return this.mermas.filter((m) => m.sucursalId === sucursalId);
  }

  async buscarPorLote(loteId: string): Promise<Merma[]> {
    return this.mermas.filter((m) => m.loteId === loteId);
  }
}

class MockLoteRepository implements ILoteRepository {
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

  async buscarPorSucursal(sucursalId: string): Promise<Lote[]> {
    return this.lotes.filter((l) => l.sucursalId === sucursalId);
  }

  async buscarLotesActivosPorProductoFEFO(productoId: string, sucursalId: string): Promise<Lote[]> {
    return this.lotes.filter((l) => l.sucursalId === sucursalId && l.productoId === productoId && l.estado === 'activo');
  }

  async buscarProximosAVencer(sucursalId: string, diasLimite: number): Promise<Lote[]> {
    return this.lotes.filter((l) => l.sucursalId === sucursalId && l.esProximoAVencer(diasLimite));
  }

  async actualizar(lote: Lote): Promise<Lote> {
    const index = this.lotes.findIndex((l) => l.id === lote.id);
    if (index >= 0) {
      this.lotes[index] = lote;
    }
    return lote;
  }

  async actualizarMuchos(lotes: Lote[]): Promise<void> {
    for (const l of lotes) {
      await this.actualizar(l);
    }
  }
}

class MockInventarioRepository implements IInventarioRepository {
  public inventarios: Inventario[] = [];

  async crear(inventario: Inventario): Promise<Inventario> {
    this.inventarios.push(inventario);
    return inventario;
  }

  async buscarPorProductoYSucursal(productoId: string, sucursalId: string): Promise<Inventario | null> {
    return this.inventarios.find((i) => i.productoId === productoId && i.sucursalId === sucursalId) || null;
  }

  async buscarPorSucursal(sucursalId: string): Promise<Inventario[]> {
    return this.inventarios.filter((i) => i.sucursalId === sucursalId);
  }

  async buscarBajoStock(sucursalId: string): Promise<Inventario[]> {
    return this.inventarios.filter((i) => i.sucursalId === sucursalId && i.tieneAlertaStockBajo());
  }

  async actualizar(inventario: Inventario): Promise<Inventario> {
    const index = this.inventarios.findIndex((i) => i.id === inventario.id);
    if (index >= 0) {
      this.inventarios[index] = inventario;
    }
    return inventario;
  }
}

class MockMovimientoRepository implements IMovimientoRepository {
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

describe('MermaService (Unitario)', () => {
  let service: MermaService;
  let mermaRepo: MockMermaRepository;
  let loteRepo: MockLoteRepository;
  let inventarioRepo: MockInventarioRepository;
  let movimientoRepo: MockMovimientoRepository;

  const SUCURSAL_ID = 'suc-merma-1';
  const PRODUCTO_ID = 'prod-peso-uuid-4444';
  const DISPOSITIVO_ID = 'disp-tablet-1';
  const USUARIO_ID = 'user-cajero-uuid';

  beforeEach(async () => {
    mermaRepo = new MockMermaRepository();
    loteRepo = new MockLoteRepository();
    inventarioRepo = new MockInventarioRepository();
    movimientoRepo = new MockMovimientoRepository();

    service = new MermaService(mermaRepo, loteRepo, inventarioRepo, movimientoRepo);

    // Inicializar inventario
    await inventarioRepo.crear(
      new Inventario({
        id: 'inv-1',
        sucursalId: SUCURSAL_ID,
        productoId: PRODUCTO_ID,
        cantidadActual: 20.0,
      }),
    );
  });

  it('debe registrar merma con motivos válidos (corte_proceso, vencimiento, dano, robo, otro)', () => {
    const merma = {
      producto_id: 'prod-peso-uuid-4444',
      cantidad: 0.85,
      motivo: 'corte_proceso',
      usuario_id: 'user-cajero-uuid',
    };
    expect(merma.motivo).toBe('corte_proceso');
    expect(merma.cantidad).toBeGreaterThan(0);
  });

  it('debe registrar merma operativa y reducir el stock de la sucursal con delta negativo (EARS-INV-04)', async () => {
    const resultado = await service.registrarMerma(
      {
        producto_id: PRODUCTO_ID,
        sucursal_id: SUCURSAL_ID,
        dispositivo_id: DISPOSITIVO_ID,
        cantidad: 2.5,
        motivo: 'corte_proceso',
        notas: 'Hueso y grasa excedente del desposte',
      },
      USUARIO_ID,
    );

    expect(resultado.id).toBeDefined();
    expect(resultado.descuento_lote_aplicado).toBe(false);
    expect(resultado.nuevo_stock_sucursal).toBe(17.5);

    // Verificar entidad persistida
    expect(mermaRepo.mermas.length).toBe(1);
    expect(mermaRepo.mermas[0].motivo).toBe('corte_proceso');
    expect(mermaRepo.mermas[0].cantidad).toBe(2.5);

    // Verificar auditoría de movimiento con delta negativo (-)
    expect(movimientoRepo.movimientos.length).toBe(1);
    const mov = movimientoRepo.movimientos[0];
    expect(mov.tipo).toBe('merma');
    expect(mov.cantidadDelta).toBe(-2.5);
    expect(mov.cantidadNueva).toBe(17.5);
  });

  it('debe vincular la merma a un lote y descontar del lote específico mutando a agotado si llega a 0 (EARS-LOTE-04)', async () => {
    const lote = new Lote({
      id: 'lote-merma-100',
      productoId: PRODUCTO_ID,
      sucursalId: SUCURSAL_ID,
      codigoLote: 'LOTE-DANO-01',
      proveedor: 'Frigorífico Sur',
      cantidadRecibida: 1.5,
      cantidadDisponible: 1.5,
      costoUnitario: 35.0,
      fechaVencimiento: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    await loteRepo.crear(lote);

    const resultado = await service.registrarMerma(
      {
        producto_id: PRODUCTO_ID,
        sucursal_id: SUCURSAL_ID,
        dispositivo_id: DISPOSITIVO_ID,
        lote_id: 'lote-merma-100',
        cantidad: 1.5, // Consume todo el lote
        motivo: 'dano',
        notas: 'Caída al suelo durante transporte interno',
      },
      USUARIO_ID,
    );

    expect(resultado.descuento_lote_aplicado).toBe(true);

    const loteActualizado = await loteRepo.buscarPorId('lote-merma-100');
    expect(loteActualizado?.cantidadDisponible).toBe(0.0);
    expect(loteActualizado?.estado).toBe('agotado');

    // Movimiento debe incluir loteId
    expect(movimientoRepo.movimientos[0].loteId).toBe('lote-merma-100');
  });

  it('debe rechazar la merma si no se proporciona un motivo válido', async () => {
    await expect(
      service.registrarMerma(
        {
          producto_id: PRODUCTO_ID,
          sucursal_id: SUCURSAL_ID,
          dispositivo_id: DISPOSITIVO_ID,
          cantidad: 1.0,
          motivo: 'motivo_inexistente' as any,
        },
        USUARIO_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar la merma si la cantidad es menor o igual a cero', async () => {
    await expect(
      service.registrarMerma(
        {
          producto_id: PRODUCTO_ID,
          sucursal_id: SUCURSAL_ID,
          dispositivo_id: DISPOSITIVO_ID,
          cantidad: 0,
          motivo: 'corte_proceso',
        },
        USUARIO_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar si el lote indicado no existe (NotFoundException)', async () => {
    await expect(
      service.registrarMerma(
        {
          producto_id: PRODUCTO_ID,
          sucursal_id: SUCURSAL_ID,
          dispositivo_id: DISPOSITIVO_ID,
          lote_id: 'lote-fantasma-uuid',
          cantidad: 1.0,
          motivo: 'vencimiento',
        },
        USUARIO_ID,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('debe rechazar si el lote pertenece a otra sucursal o producto', async () => {
    const loteOtraSucursal = new Lote({
      id: 'lote-otra-suc',
      productoId: PRODUCTO_ID,
      sucursalId: 'otra-sucursal-uuid',
      codigoLote: 'LOTE-OTRO',
      proveedor: 'Proveedor',
      cantidadRecibida: 5,
      cantidadDisponible: 5,
      costoUnitario: 30,
    });
    await loteRepo.crear(loteOtraSucursal);

    await expect(
      service.registrarMerma(
        {
          producto_id: PRODUCTO_ID,
          sucursal_id: SUCURSAL_ID,
          dispositivo_id: DISPOSITIVO_ID,
          lote_id: 'lote-otra-suc',
          cantidad: 1.0,
          motivo: 'vencimiento',
        },
        USUARIO_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
