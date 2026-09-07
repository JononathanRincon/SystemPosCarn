import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CorteCajaService, ISalesCashQueryProvider } from '../../../src/modules/cash/application/services/corte-caja.service';
import { MovimientoCajaService } from '../../../src/modules/cash/application/services/movimiento-caja.service';
import { CorteCaja } from '../../../src/modules/cash/domain/entities/corte-caja.entity';
import { MovimientoCaja } from '../../../src/modules/cash/domain/entities/movimiento-caja.entity';
import { ICorteCajaRepository } from '../../../src/modules/cash/domain/ports/corte-caja-repository.port';
import { IMovimientoCajaRepository } from '../../../src/modules/cash/domain/ports/movimiento-caja-repository.port';

class InMemoryCorteCajaRepository implements ICorteCajaRepository {
  public turnos: CorteCaja[] = [];

  async crear(corte: CorteCaja): Promise<CorteCaja> {
    this.turnos.push(corte);
    return corte;
  }

  async buscarPorId(id: string): Promise<CorteCaja | null> {
    return this.turnos.find((t) => t.id === id) || null;
  }

  async buscarTurnoAbiertoPorDispositivo(dispositivoId: string): Promise<CorteCaja | null> {
    return this.turnos.find((t) => t.dispositivoId === dispositivoId && t.estaAbierta()) || null;
  }

  async buscarUltimoPorDispositivo(dispositivoId: string): Promise<CorteCaja | null> {
    const ordenados = [...this.turnos]
      .filter((t) => t.dispositivoId === dispositivoId)
      .sort((a, b) => b.fechaApertura.getTime() - a.fechaApertura.getTime());
    return ordenados[0] || null;
  }

  async buscarPorSucursal(sucursalId: string): Promise<CorteCaja[]> {
    return this.turnos.filter((t) => t.sucursalId === sucursalId);
  }

  async actualizar(corte: CorteCaja): Promise<CorteCaja> {
    const idx = this.turnos.findIndex((t) => t.id === corte.id);
    if (idx >= 0) {
      this.turnos[idx] = corte;
    }
    return corte;
  }
}

class InMemoryMovimientoCajaRepository implements IMovimientoCajaRepository {
  public movimientos: MovimientoCaja[] = [];

  async crear(movimiento: MovimientoCaja): Promise<MovimientoCaja> {
    this.movimientos.push(movimiento);
    return movimiento;
  }

  async buscarPorId(id: string): Promise<MovimientoCaja | null> {
    return this.movimientos.find((m) => m.id === id) || null;
  }

  async buscarPorCorteId(corteId: string): Promise<MovimientoCaja[]> {
    return this.movimientos.filter((m) => m.corteId === corteId);
  }

  async buscarPorSucursal(sucursalId: string): Promise<MovimientoCaja[]> {
    return this.movimientos.filter((m) => m.sucursalId === sucursalId);
  }

  async obtenerTotalesPorCorte(corteId: string): Promise<{ totalIngresos: number; totalEgresos: number }> {
    const movs = this.movimientos.filter((m) => m.corteId === corteId);
    let totalIngresos = 0;
    let totalEgresos = 0;
    for (const m of movs) {
      if (m.esIngreso()) totalIngresos += m.monto;
      if (m.esEgreso()) totalEgresos += m.monto;
    }
    return {
      totalIngresos: Math.round(totalIngresos * 100) / 100,
      totalEgresos: Math.round(totalEgresos * 100) / 100,
    };
  }
}

describe('MovimientoCajaService (Unitario - TASK-13B)', () => {
  let corteService: CorteCajaService;
  let movimientoService: MovimientoCajaService;
  let corteRepo: InMemoryCorteCajaRepository;
  let movRepo: InMemoryMovimientoCajaRepository;
  let mockSalesQuery: ISalesCashQueryProvider;

  const sucursalId = '00000000-0000-0000-0000-000000000001';
  const usuarioId = '00000000-0000-0000-0000-000000000002';
  const supervisorId = '00000000-0000-0000-0000-000000000003';
  const dispositivoId = 'pos-term-01';

  beforeEach(() => {
    corteRepo = new InMemoryCorteCajaRepository();
    movRepo = new InMemoryMovimientoCajaRepository();
    mockSalesQuery = {
      obtenerTotalVentasEfectivo: jest.fn().mockResolvedValue(50000.0),
      obtenerTotalesPorMetodo: jest.fn().mockResolvedValue({ efectivo: 50000.0 }),
    };

    corteService = new CorteCajaService(corteRepo, mockSalesQuery);
    movimientoService = new MovimientoCajaService(
      corteService,
      movRepo,
      corteRepo,
      mockSalesQuery,
    );
  });

  it('debe registrar un egreso para compra_materia_prima si hay saldo suficiente (EARS-CAJA-05)', async () => {
    const turno = await corteService.abrirTurno({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 100000.0,
    });

    const res = await movimientoService.registrarMovimiento({
      corteId: turno.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      autorizadoPorId: supervisorId,
      tipo: 'egreso',
      categoria: 'compra_materia_prima',
      monto: 45000.0,
      beneficiarioProveedor: 'Carnes El Rodeo S.A.S.',
      comprobante: 'FACT-9981',
      descripcion: 'Compra de 1/2 canal de novillo para desposte inmediato',
    });

    expect(res.id).toBeDefined();
    expect(res.tipo).toBe('egreso');
    expect(res.categoria).toBe('compra_materia_prima');
    expect(res.monto).toBe(45000.0);
    expect(res.beneficiarioProveedor).toBe('Carnes El Rodeo S.A.S.');
    expect(res.comprobante).toBe('FACT-9981');
    expect(res.sincronizado).toBe(true);

    const turnoActualizado = await corteRepo.buscarPorId(turno.corteId);
    expect(turnoActualizado?.totalEgresos).toBe(45000.0);
    expect(turnoActualizado?.totalIngresosExtra).toBe(0);
    // Saldo disponible = 100000 base + 50000 ventas - 45000 egreso = 105000
    expect(turnoActualizado?.calcularSaldoDisponible(50000.0)).toBe(105000.0);
  });

  it('debe rechazar un egreso si el monto supera el saldo disponible en caja (EARS-CAJA-07, Caso Límite 7)', async () => {
    const turno = await corteService.abrirTurno({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 50000.0, // Base 50,000 + Ventas 50,000 = 100,000 disponible
    });

    await expect(
      movimientoService.registrarMovimiento({
        corteId: turno.corteId,
        dispositivoId,
        sucursalId,
        usuarioId,
        tipo: 'egreso',
        categoria: 'flete_transporte',
        monto: 150000.0, // Supera los 100,000
        descripcion: 'Pago de flete refrigerado',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe registrar un ingreso extraordinario por inyeccion_base o abono_fiado (EARS-CAJA-06)', async () => {
    const turno = await corteService.abrirTurno({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 50000.0,
    });

    const res = await movimientoService.registrarMovimiento({
      corteId: turno.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      tipo: 'ingreso',
      categoria: 'inyeccion_base',
      monto: 30000.0,
      descripcion: 'Refuerzo de cambio de baja denominacion para ventanilla',
    });

    expect(res.tipo).toBe('ingreso');
    expect(res.categoria).toBe('inyeccion_base');
    expect(res.monto).toBe(30000.0);

    const turnoActualizado = await corteRepo.buscarPorId(turno.corteId);
    expect(turnoActualizado?.totalIngresosExtra).toBe(30000.0);
    // 50,000 base + 50,000 ventas + 30,000 ingreso = 130,000
    expect(turnoActualizado?.calcularSaldoDisponible(50000.0)).toBe(130000.0);
  });

  it('debe rechazar movimientos con monto menor o igual a cero', async () => {
    const turno = await corteService.abrirTurno({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 50000.0,
    });

    await expect(
      movimientoService.registrarMovimiento({
        corteId: turno.corteId,
        dispositivoId,
        sucursalId,
        usuarioId,
        tipo: 'egreso',
        categoria: 'insumos_empaque',
        monto: 0,
        descripcion: 'Bolsas plasticas',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      movimientoService.registrarMovimiento({
        corteId: turno.corteId,
        dispositivoId,
        sucursalId,
        usuarioId,
        tipo: 'egreso',
        categoria: 'insumos_empaque',
        monto: -500,
        descripcion: 'Bolsas plasticas',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar movimientos con descripción o justificación vacía', async () => {
    const turno = await corteService.abrirTurno({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 50000.0,
    });

    await expect(
      movimientoService.registrarMovimiento({
        corteId: turno.corteId,
        dispositivoId,
        sucursalId,
        usuarioId,
        tipo: 'egreso',
        categoria: 'otro',
        monto: 1000.0,
        descripcion: '   ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar movimientos en turnos cerrados', async () => {
    const turno = await corteService.abrirTurno({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 50000.0,
    });

    await corteService.cerrarTurno({
      corteId: turno.corteId,
      totalEfectivoContado: 100000.0,
    });

    await expect(
      movimientoService.registrarMovimiento({
        corteId: turno.corteId,
        dispositivoId,
        sucursalId,
        usuarioId,
        tipo: 'ingreso',
        categoria: 'inyeccion_base',
        monto: 20000.0,
        descripcion: 'Intento extemporaneo',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe listar movimientos y balance del turno actual vía obtenerMovimientosTurnoActual', async () => {
    const turno = await corteService.abrirTurno({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 100000.0,
    });

    await movimientoService.registrarMovimiento({
      corteId: turno.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      tipo: 'ingreso',
      categoria: 'inyeccion_base',
      monto: 20000.0,
      descripcion: 'Monedas de $500',
    });

    await movimientoService.registrarMovimiento({
      corteId: turno.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      tipo: 'egreso',
      categoria: 'hielo_refrigeracion',
      monto: 30000.0,
      descripcion: '2 barras de hielo',
    });

    const resumen = await movimientoService.obtenerMovimientosTurnoActual(dispositivoId);

    expect(resumen.corteId).toBe(turno.corteId);
    expect(resumen.montoApertura).toBe(100000.0);
    expect(resumen.ventasEfectivo).toBe(50000.0);
    expect(resumen.totalIngresosExtra).toBe(20000.0);
    expect(resumen.totalEgresos).toBe(30000.0);
    // Saldo = 100000 + 50000 + 20000 - 30000 = 140000
    expect(resumen.saldoDisponible).toBe(140000.0);
    expect(resumen.efectivoEsperado).toBe(140000.0);
    expect(resumen.movimientos.length).toBe(2);
  });

  it('debe obtener movimientos por corteId', async () => {
    const turno = await corteService.abrirTurno({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 100000.0,
    });

    await movimientoService.registrarMovimiento({
      corteId: turno.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      tipo: 'egreso',
      categoria: 'servicios_mantenimiento',
      monto: 15000.0,
      descripcion: 'Afilado de cuchillos y sierras',
    });

    const list = await movimientoService.obtenerMovimientosPorCorteId(turno.corteId);
    expect(list.length).toBe(1);
    expect(list[0].categoria).toBe('servicios_mantenimiento');
    expect(list[0].monto).toBe(15000.0);
  });

  it('debe reflejar egresos e ingresos en el efectivoEsperado al cerrar turno (EARS-CAJA-02, EARS-CAJA-07)', async () => {
    const turno = await corteService.abrirTurno({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 100000.0,
    });

    // Ingreso extra: +15,000
    await movimientoService.registrarMovimiento({
      corteId: turno.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      tipo: 'ingreso',
      categoria: 'abono_fiado',
      monto: 15000.0,
      descripcion: 'Abono cliente cuenta corriente',
    });

    // Egreso: -25,000
    await movimientoService.registrarMovimiento({
      corteId: turno.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      tipo: 'egreso',
      categoria: 'insumos_empaque',
      monto: 25000.0,
      descripcion: 'Rollo vinipel y bolsas para vacío',
    });

    // Cierre: efectivoEsperado = 100,000 (apertura) + 50,000 (ventas) + 15,000 (ingreso) - 25,000 (egreso) = 140,000
    const cierre = await corteService.cerrarTurno({
      corteId: turno.corteId,
      totalEfectivoContado: 140000.0,
    });

    expect(cierre.efectivoEsperado).toBe(140000.0);
    expect(cierre.totalEfectivoContado).toBe(140000.0);
    expect(cierre.diferencia).toBe(0.0); // Cuadre perfecto con movimientos
    expect(cierre.totalIngresosExtra).toBe(15000.0);
    expect(cierre.totalEgresos).toBe(25000.0);
  });
});