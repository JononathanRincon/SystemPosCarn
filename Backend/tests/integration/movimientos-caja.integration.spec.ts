import { BadRequestException } from '@nestjs/common';
import { CorteCajaService, ISalesCashQueryProvider } from '../../src/modules/cash/application/services/corte-caja.service';
import { MovimientoCajaService } from '../../src/modules/cash/application/services/movimiento-caja.service';
import { CashShiftsController } from '../../src/modules/cash/presentation/http/cash-shifts.controller';
import { CashCutsController } from '../../src/modules/cash/presentation/http/cash-cuts.controller';
import { CorteCaja } from '../../src/modules/cash/domain/entities/corte-caja.entity';
import { MovimientoCaja } from '../../src/modules/cash/domain/entities/movimiento-caja.entity';
import { ICorteCajaRepository } from '../../src/modules/cash/domain/ports/corte-caja-repository.port';
import { IMovimientoCajaRepository } from '../../src/modules/cash/domain/ports/movimiento-caja-repository.port';

class IntegrationCorteCajaRepository implements ICorteCajaRepository {
  private turnos: Map<string, CorteCaja> = new Map();

  async crear(corte: CorteCaja): Promise<CorteCaja> {
    this.turnos.set(corte.id, corte);
    return corte;
  }

  async buscarPorId(id: string): Promise<CorteCaja | null> {
    return this.turnos.get(id) || null;
  }

  async buscarTurnoAbiertoPorDispositivo(dispositivoId: string): Promise<CorteCaja | null> {
    const todos = Array.from(this.turnos.values());
    return (
      todos.find((t) => t.dispositivoId === dispositivoId && t.estaAbierta()) || null
    );
  }

  async buscarUltimoPorDispositivo(dispositivoId: string): Promise<CorteCaja | null> {
    const ordenados = Array.from(this.turnos.values())
      .filter((t) => t.dispositivoId === dispositivoId)
      .sort((a, b) => b.fechaApertura.getTime() - a.fechaApertura.getTime());
    return ordenados[0] || null;
  }

  async buscarPorSucursal(sucursalId: string): Promise<CorteCaja[]> {
    return Array.from(this.turnos.values()).filter((t) => t.sucursalId === sucursalId);
  }

  async actualizar(corte: CorteCaja): Promise<CorteCaja> {
    this.turnos.set(corte.id, corte);
    return corte;
  }
}

class IntegrationMovimientoCajaRepository implements IMovimientoCajaRepository {
  private movimientos: Map<string, MovimientoCaja> = new Map();

  async crear(movimiento: MovimientoCaja): Promise<MovimientoCaja> {
    this.movimientos.set(movimiento.id, movimiento);
    return movimiento;
  }

  async buscarPorId(id: string): Promise<MovimientoCaja | null> {
    return this.movimientos.get(id) || null;
  }

  async buscarPorCorteId(corteId: string): Promise<MovimientoCaja[]> {
    return Array.from(this.movimientos.values()).filter((m) => m.corteId === corteId);
  }

  async buscarPorSucursal(sucursalId: string): Promise<MovimientoCaja[]> {
    return Array.from(this.movimientos.values()).filter((m) => m.sucursalId === sucursalId);
  }

  async obtenerTotalesPorCorte(corteId: string): Promise<{ totalIngresos: number; totalEgresos: number }> {
    const movs = Array.from(this.movimientos.values()).filter((m) => m.corteId === corteId);
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

describe('Integración: Movimientos de Caja (Ingresos y Egresos de Materia Prima y Gastos - TASK-13B)', () => {
  let corteRepo: IntegrationCorteCajaRepository;
  let movRepo: IntegrationMovimientoCajaRepository;
  let salesQueryProvider: ISalesCashQueryProvider;
  let corteService: CorteCajaService;
  let movService: MovimientoCajaService;
  let shiftsController: CashShiftsController;
  let cutsController: CashCutsController;

  const sucursalId = '11111111-1111-1111-1111-111111111111';
  const dispositivoId = 'pos-caja-carniceria-01';
  const usuarioId = '22222222-2222-2222-2222-222222222222';
  const supervisorId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    corteRepo = new IntegrationCorteCajaRepository();
    movRepo = new IntegrationMovimientoCajaRepository();
    salesQueryProvider = {
      obtenerTotalVentasEfectivo: jest.fn().mockResolvedValue(120000.0),
      obtenerTotalesPorMetodo: jest.fn().mockResolvedValue({
        efectivo: 120000.0,
        tarjeta: 80000.0,
      }),
    };

    corteService = new CorteCajaService(corteRepo, salesQueryProvider);
    movService = new MovimientoCajaService(
      corteService,
      movRepo,
      corteRepo,
      salesQueryProvider,
    );

    shiftsController = new CashShiftsController(corteService, movService);
    cutsController = new CashCutsController(corteService);
  });

  it('debe ejecutar el flujo completo de caja: Apertura -> Egresos de carne -> Inyecciones de cambio -> Consulta viva -> Cierre con cuadre exacto', async () => {
    // 1. Apertura con base inicial en efectivo ($100,000)
    const apertura = await shiftsController.openShift({
      sucursalId,
      dispositivoId,
      usuarioId,
      montoApertura: 100000.0,
    });
    expect(apertura.corteId).toBeDefined();
    expect(apertura.montoApertura).toBe(100000.0);

    // 2. Registro de egreso: Compra de materia prima ($50,000)
    const egreso1 = await shiftsController.registerMovement({
      corteId: apertura.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      autorizadoPorId: supervisorId,
      tipo: 'egreso',
      categoria: 'compra_materia_prima',
      monto: 50000.0,
      beneficiarioProveedor: 'Frigorífico Guadalupe',
      comprobante: 'REM-44512',
      descripcion: 'Compra de vísceras y asaduras frescas',
    });
    expect(egreso1.id).toBeDefined();
    expect(egreso1.monto).toBe(50000.0);
    expect(egreso1.categoria).toBe('compra_materia_prima');

    // 3. Registro de egreso menor: Flete y transporte ($15,000)
    const egreso2 = await shiftsController.registerMovement({
      corteId: apertura.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      tipo: 'egreso',
      categoria: 'flete_transporte',
      monto: 15000.0,
      descripcion: 'Acarreo de canales en camion refrigerado',
    });
    expect(egreso2.monto).toBe(15000.0);

    // 4. Registro de ingreso extraordinario: Inyección de base / cambio ($25,000)
    const ingreso1 = await shiftsController.registerMovement({
      corteId: apertura.corteId,
      dispositivoId,
      sucursalId,
      usuarioId,
      tipo: 'ingreso',
      categoria: 'inyeccion_base',
      monto: 25000.0,
      descripcion: 'Monedas de $500 y $1000 para cambio',
    });
    expect(ingreso1.monto).toBe(25000.0);

    // 5. Consulta en tiempo real de movimientos del turno activo (GET /cash-shifts/current/movements)
    const liveMovements = await shiftsController.getCurrentShiftMovements({ dispositivoId });
    expect(liveMovements.corteId).toBe(apertura.corteId);
    expect(liveMovements.montoApertura).toBe(100000.0);
    expect(liveMovements.ventasEfectivo).toBe(120000.0);
    expect(liveMovements.totalIngresosExtra).toBe(25000.0);
    expect(liveMovements.totalEgresos).toBe(65000.0);
    // Saldo disponible = 100,000 + 120,000 + 25,000 - 65,000 = 180,000
    expect(liveMovements.saldoDisponible).toBe(180000.0);
    expect(liveMovements.efectivoEsperado).toBe(180000.0);
    expect(liveMovements.movimientos.length).toBe(3);

    // 6. Consulta por ID de corte (GET /cash-shifts/:id/movements)
    const shiftMovements = await shiftsController.getMovementsByShiftId(apertura.corteId);
    expect(shiftMovements.length).toBe(3);

    // 7. Intento de egreso que sobrepasa el saldo disponible en caja ($180,000 disponible vs $190,000 solicitado)
    await expect(
      shiftsController.registerMovement({
        corteId: apertura.corteId,
        dispositivoId,
        sucursalId,
        usuarioId,
        tipo: 'egreso',
        categoria: 'anticipo_nomina',
        monto: 190000.0,
        descripcion: 'Adelanto excesivo de quincena a carnicero',
      }),
    ).rejects.toThrow(BadRequestException);

    // 8. Cierre de turno y validación inmutable del cuadre de caja (POST /cash-cuts)
    // Efectivo físico contado en gaveta = $180,000 (coincidencia exacta)
    const cierre = await cutsController.closeShift({
      corteId: apertura.corteId,
      totalEfectivoContado: 180000.0,
      totalesPorMetodoPago: {
        efectivo: 120000.0,
        tarjeta: 80000.0,
      },
      observaciones: 'Corte cuadradito con egresos de materia prima justificados con remisión.',
    });

    expect(cierre.estado).toBe('cerrada');
    expect(cierre.totalEgresos).toBe(65000.0);
    expect(cierre.totalIngresosExtra).toBe(25000.0);
    expect(cierre.efectivoEsperado).toBe(180000.0);
    expect(cierre.totalEfectivoContado).toBe(180000.0);
    expect(cierre.diferencia).toBe(0.0); // 0 diferencia
  });
});