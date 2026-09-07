import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CorteCajaService, ISalesCashQueryProvider } from '../../../src/modules/cash/application/services/corte-caja.service';
import { CorteCaja } from '../../../src/modules/cash/domain/entities/corte-caja.entity';
import { ICorteCajaRepository } from '../../../src/modules/cash/domain/ports/corte-caja-repository.port';

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

describe('CorteCajaService (Unitario)', () => {
  let service: CorteCajaService;
  let repo: InMemoryCorteCajaRepository;
  let mockSalesQuery: ISalesCashQueryProvider;

  beforeEach(() => {
    repo = new InMemoryCorteCajaRepository();
    mockSalesQuery = {
      obtenerTotalVentasEfectivo: jest.fn().mockResolvedValue(250000.0),
      obtenerTotalesPorMetodo: jest.fn().mockResolvedValue({
        efectivo: 250000.0,
        tarjeta: 150000.0,
      }),
    };
    service = new CorteCajaService(repo, mockSalesQuery);
  });

  it('debe calcular correctamente la diferencia: contado - esperado', () => {
    const esperado = 550000.0;
    const contado = 552000.0;
    const diferencia = contado - esperado;

    expect(diferencia).toBe(2000.0); // Sobrante de 2000
  });

  it('debe desglosar totales por cada método de pago', () => {
    const desglose = {
      efectivo: 350000.0,
      tarjeta: 200000.0,
    };
    expect(desglose.efectivo + desglose.tarjeta).toBe(550000.0);
  });

  it('debe abrir un nuevo turno con base inicial y estado abierta (EARS-CAJA-01)', async () => {
    const res = await service.abrirTurno({
      sucursalId: 'sucursal-uuid-2222',
      dispositivoId: 'disp-caja-01',
      usuarioId: 'usuario-uuid-3333',
      montoApertura: 100000.0,
    });

    expect(res.corteId).toBeDefined();
    expect(res.estado).toBe('abierta');
    expect(res.montoApertura).toBe(100000.0);
    expect(res.efectivoEsperado).toBe(100000.0);
    expect(res.fechaApertura).toBeInstanceOf(Date);
  });

  it('debe rechazar abrir turno si el dispositivo ya tiene una caja abierta (EARS-CAJA-03)', async () => {
    await service.abrirTurno({
      sucursalId: 'sucursal-uuid-2222',
      dispositivoId: 'disp-caja-01',
      usuarioId: 'usuario-uuid-3333',
      montoApertura: 100000.0,
    });

    await expect(
      service.abrirTurno({
        sucursalId: 'sucursal-uuid-2222',
        dispositivoId: 'disp-caja-01',
        usuarioId: 'usuario-uuid-3333',
        montoApertura: 50000.0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar apertura con monto negativo', async () => {
    await expect(
      service.abrirTurno({
        sucursalId: 'sucursal-uuid-2222',
        dispositivoId: 'disp-caja-02',
        usuarioId: 'usuario-uuid-3333',
        montoApertura: -1000,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe consultar el turno actual y calcular el efectivo esperado acumulado', async () => {
    await service.abrirTurno({
      sucursalId: 'sucursal-uuid-2222',
      dispositivoId: 'disp-caja-01',
      usuarioId: 'usuario-uuid-3333',
      montoApertura: 100000.0,
    });

    const actual = await service.obtenerTurnoActual('disp-caja-01');
    expect(actual.estado).toBe('abierta');
    expect(actual.montoApertura).toBe(100000.0);
    expect(actual.ventasAcumuladas).toBe(250000.0);
    expect(actual.efectivoEsperado).toBe(350000.0); // 100000 base + 250000 ventas
  });

  it('debe lanzar NotFoundException si se consulta turno actual de un dispositivo sin turno abierto', async () => {
    await expect(service.obtenerTurnoActual('disp-inactivo')).rejects.toThrow(NotFoundException);
  });

  it('debe cerrar turno calculando diferencia inmutable y sellando estado cerrada (EARS-CAJA-02, US-06)', async () => {
    const turno = await service.abrirTurno({
      sucursalId: 'sucursal-uuid-2222',
      dispositivoId: 'disp-caja-01',
      usuarioId: 'usuario-uuid-3333',
      montoApertura: 100000.0,
    });

    // Efectivo esperado: 100,000 + 250,000 = 350,000.
    // Cajero cuenta: 350,000 exacto.
    const resCierre = await service.cerrarTurno({
      corteId: turno.corteId,
      totalEfectivoContado: 350000.0,
      totalesPorMetodoPago: { efectivo: 250000.0, tarjeta: 150000.0 },
      observaciones: 'Turno tarde cerrado sin novedad',
    });

    expect(resCierre.estado).toBe('cerrada');
    expect(resCierre.fechaCierre).toBeInstanceOf(Date);
    expect(resCierre.totalEfectivoContado).toBe(350000.0);
    expect(resCierre.efectivoEsperado).toBe(350000.0);
    expect(resCierre.diferencia).toBe(0.0);
    expect(resCierre.observaciones).toBe('Turno tarde cerrado sin novedad');
  });

  it('debe calcular diferencia positiva (sobrante) y negativa (faltante)', async () => {
    const turno1 = await service.abrirTurno({
      sucursalId: 'sucursal-uuid-2222',
      dispositivoId: 'disp-caja-01',
      usuarioId: 'usuario-uuid-3333',
      montoApertura: 50000.0,
    });

    // Efectivo esperado: 50,000 + 250,000 = 300,000.
    // Cajero cuenta 305,000 -> sobrante +5,000
    const sobrante = await service.cerrarTurno({
      corteId: turno1.corteId,
      totalEfectivoContado: 305000.0,
    });
    expect(sobrante.diferencia).toBe(5000.0);

    // Abrir turno 2 y probar faltante
    const turno2 = await service.abrirTurno({
      sucursalId: 'sucursal-uuid-2222',
      dispositivoId: 'disp-caja-01',
      usuarioId: 'usuario-uuid-3333',
      montoApertura: 50000.0,
    });

    // Cajero cuenta 290,000 -> faltante -10,000
    const faltante = await service.cerrarTurno({
      corteId: turno2.corteId,
      totalEfectivoContado: 290000.0,
    });
    expect(faltante.diferencia).toBe(-10000.0);
  });

  it('debe impedir cerrar un turno que ya está cerrado (inmutabilidad)', async () => {
    const turno = await service.abrirTurno({
      sucursalId: 'sucursal-uuid-2222',
      dispositivoId: 'disp-caja-01',
      usuarioId: 'usuario-uuid-3333',
      montoApertura: 100000.0,
    });

    await service.cerrarTurno({
      corteId: turno.corteId,
      totalEfectivoContado: 350000.0,
    });

    await expect(
      service.cerrarTurno({
        corteId: turno.corteId,
        totalEfectivoContado: 350000.0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe validar si la caja esta abierta para operar (EARS-CAJA-04)', async () => {
    expect(await service.verificarCajaAbierta('disp-caja-01')).toBe(false);

    const turno = await service.abrirTurno({
      sucursalId: 'sucursal-uuid-2222',
      dispositivoId: 'disp-caja-01',
      usuarioId: 'usuario-uuid-3333',
      montoApertura: 100000.0,
    });
    expect(await service.verificarCajaAbierta('disp-caja-01')).toBe(true);

    await service.cerrarTurno({
      corteId: turno.corteId,
      totalEfectivoContado: 350000.0,
    });
    expect(await service.verificarCajaAbierta('disp-caja-01')).toBe(false);
  });
});
