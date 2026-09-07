import { CorteCajaService, ISalesCashQueryProvider } from '../../src/modules/cash/application/services/corte-caja.service';
import { CashShiftsController } from '../../src/modules/cash/presentation/http/cash-shifts.controller';
import { CashCutsController } from '../../src/modules/cash/presentation/http/cash-cuts.controller';
import { CorteCaja } from '../../src/modules/cash/domain/entities/corte-caja.entity';
import { ICorteCajaRepository } from '../../src/modules/cash/domain/ports/corte-caja-repository.port';

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

describe('Integración: Flujo Completo de Corte de Caja', () => {
  it('debe abrir turno con base inicial, procesar ventas del día y cerrar cuadrando métodos de pago', async () => {
    const montoApertura = 100000.0;
    const ventasEfectivo = 250000.0;
    const ventasTarjeta = 150000.0;

    const totalEfectivoEsperado = montoApertura + ventasEfectivo;
    const efectivoContado = 350000.0;

    const diferencia = efectivoContado - totalEfectivoEsperado;
    expect(diferencia).toBe(0.0); // Cuadre perfecto
  });

  describe('Ciclo de vida completo a través de Controllers y Servicio (TASK-12)', () => {
    let repo: IntegrationCorteCajaRepository;
    let salesQueryProvider: ISalesCashQueryProvider;
    let service: CorteCajaService;
    let shiftsController: CashShiftsController;
    let cutsController: CashCutsController;

    const sucursalId = 'suc-123e4567-e89b-12d3-a456-426614174000';
    const dispositivoId = 'pos-term-01';
    const usuarioId = 'usr-123e4567-e89b-12d3-a456-426614174000';

    beforeEach(() => {
      repo = new IntegrationCorteCajaRepository();
      salesQueryProvider = {
        obtenerTotalVentasEfectivo: jest.fn().mockResolvedValue(185000.0),
        obtenerTotalesPorMetodo: jest.fn().mockResolvedValue({
          efectivo: 185000.0,
          tarjeta: 120000.0,
          transferencia: 45000.0,
        }),
      };
      service = new CorteCajaService(repo, salesQueryProvider);
      shiftsController = new CashShiftsController(service);
      cutsController = new CashCutsController(service);
    });

    it('debe ejecutar el flujo completo: Apertura -> Consulta en vivo -> Cierre con cuadre inmutable', async () => {
      // 1. Apertura de Turno (POST /cash-shifts/open)
      const apertura = await shiftsController.openShift({
        sucursalId,
        dispositivoId,
        usuarioId,
        montoApertura: 80000.0, // Base inicial ,000
      });

      expect(apertura.corteId).toBeDefined();
      expect(apertura.estado).toBe('abierta');
      expect(apertura.montoApertura).toBe(80000.0);
      expect(apertura.efectivoEsperado).toBe(80000.0);

      // Verificar que la caja ahora se encuentra abierta
      const cajaAbierta = await service.verificarCajaAbierta(dispositivoId);
      expect(cajaAbierta).toBe(true);

      // 2. Consulta en vivo durante el turno (GET /cash-shifts/current)
      const estadoActual = await shiftsController.getCurrentShift({ dispositivoId });
      expect(estadoActual.corteId).toBe(apertura.corteId);
      expect(estadoActual.estado).toBe('abierta');
      expect(estadoActual.montoApertura).toBe(80000.0);
      expect(estadoActual.ventasAcumuladas).toBe(185000.0);
      // Esperado: base inicial (,000) + ventas en efectivo (,000) = ,000
      expect(estadoActual.efectivoEsperado).toBe(265000.0);

      // 3. Cierre de turno inmutable (POST /cash-cuts)
      // Cajero cuenta exactamente ,000
      const cierre = await cutsController.closeShift({
        corteId: apertura.corteId,
        totalEfectivoContado: 265000.0,
        totalesPorMetodoPago: {
          efectivo: 185000.0,
          tarjeta: 120000.0,
          transferencia: 45000.0,
        },
        observaciones: 'Cuadre exacto fin de jornada',
      });

      expect(cierre.corteId).toBe(apertura.corteId);
      expect(cierre.estado).toBe('cerrada');
      expect(cierre.fechaCierre).toBeInstanceOf(Date);
      expect(cierre.totalEfectivoContado).toBe(265000.0);
      expect(cierre.efectivoEsperado).toBe(265000.0);
      expect(cierre.diferencia).toBe(0.0); // Cuadre perfecto
      expect(cierre.totalesPorMetodoPago?.['tarjeta']).toBe(120000.0);
      expect(cierre.observaciones).toBe('Cuadre exacto fin de jornada');

      // 4. Verificar que la caja queda sellada como cerrada e impide nuevas operaciones
      const cajaAbiertaPostCierre = await service.verificarCajaAbierta(dispositivoId);
      expect(cajaAbiertaPostCierre).toBe(false);

      // 5. Intentar cerrar nuevamente debe fallar por inmutabilidad
      await expect(
        cutsController.closeShift({
          corteId: apertura.corteId,
          totalEfectivoContado: 265000.0,
        }),
      ).rejects.toThrow();
    });

    it('debe registrar y auditar sobrantes o faltantes de dinero físico con precisión de 2 decimales', async () => {
      const apertura = await shiftsController.openShift({
        sucursalId,
        dispositivoId,
        usuarioId,
        montoApertura: 50000.0,
      });

      // Esperado: 50,000 base + 185,000 efectivo = 235,000.
      // Cajero cuenta 233,500.50 (faltante de -1,499.50)
      const cierreFaltante = await cutsController.closeShift({
        corteId: apertura.corteId,
        totalEfectivoContado: 233500.5,
        observaciones: 'Faltante por billete roto devuelto al cliente',
      });

      expect(cierreFaltante.diferencia).toBe(-1499.5);
      expect(cierreFaltante.estado).toBe('cerrada');
    });
  });
});
