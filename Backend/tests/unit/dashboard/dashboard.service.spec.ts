import { DashboardService } from '../../../src/modules/dashboard/application/services/dashboard.service';
import { Venta } from '../../../src/modules/sales/domain/entities/venta.entity';
import { DetalleVenta } from '../../../src/modules/sales/domain/entities/detalle-venta.entity';
import { PagoVenta } from '../../../src/modules/sales/domain/entities/pago-venta.entity';
import { Sucursal } from '../../../src/modules/catalog/domain/entities/sucursal.entity';
import { Producto } from '../../../src/modules/catalog/domain/entities/producto.entity';
import { CorteCaja } from '../../../src/modules/cash/domain/entities/corte-caja.entity';
import { Merma } from '../../../src/modules/inventory/domain/entities/merma.entity';
import { IVentaRepository } from '../../../src/modules/sales/domain/ports/venta-repository.port';
import { SucursalRepositoryPort } from '../../../src/modules/catalog/domain/ports/sucursal-repository.port';
import { ProductoRepositoryPort } from '../../../src/modules/catalog/domain/ports/producto-repository.port';
import { IMermaRepository } from '../../../src/modules/inventory/domain/ports/merma-repository.port';
import { InventarioService } from '../../../src/modules/inventory/application/services/inventario.service';
import { CorteCajaService } from '../../../src/modules/cash/application/services/corte-caja.service';

class MockVentaRepo implements IVentaRepository {
  public ventas: Venta[] = [];

  async guardarTransaccional(venta: Venta): Promise<Venta> {
    this.ventas.push(venta);
    return venta;
  }

  async buscarPorId(id: string): Promise<Venta | null> {
    return this.ventas.find((v) => v.id === id) || null;
  }

  async buscarPorDispositivoYRango(dispositivoId: string, desde: Date, hasta?: Date): Promise<Venta[]> {
    return this.ventas.filter((v) => v.dispositivoId === dispositivoId);
  }

  async buscarPorSucursal(sucursalId: string, limite = 1000): Promise<Venta[]> {
    return this.ventas.filter((v) => v.sucursalId === sucursalId).slice(0, limite);
  }

  async actualizar(venta: Venta): Promise<Venta> {
    const idx = this.ventas.findIndex((v) => v.id === venta.id);
    if (idx >= 0) this.ventas[idx] = venta;
    return venta;
  }
}

class MockSucursalRepo implements SucursalRepositoryPort {
  public sucursales: Sucursal[] = [];

  async findById(id: string): Promise<Sucursal | null> {
    return this.sucursales.find((s) => s.id === id) || null;
  }

  async findByNegocioId(negocioId: string): Promise<Sucursal[]> {
    return this.sucursales.filter((s) => s.negocioId === negocioId);
  }

  async findByIdAndNegocioId(id: string, negocioId: string): Promise<Sucursal | null> {
    return this.sucursales.find((s) => s.id === id && s.negocioId === negocioId) || null;
  }

  async save(sucursal: Sucursal): Promise<Sucursal> {
    this.sucursales.push(sucursal);
    return sucursal;
  }

  async delete(id: string, negocioId: string): Promise<boolean> {
    return true;
  }
}

class MockProductoRepo implements ProductoRepositoryPort {
  public productos: Producto[] = [];

  async findById(id: string, negocioId: string): Promise<Producto | null> {
    return this.productos.find((p) => p.id === id) || null;
  }

  async findByNegocioId(negocioId: string): Promise<Producto[]> {
    return this.productos.filter((p) => p.negocioId === negocioId);
  }

  async findByCodigoBarras(codigoBarras: string, negocioId: string): Promise<Producto | null> {
    return null;
  }

  async save(producto: Producto): Promise<Producto> {
    this.productos.push(producto);
    return producto;
  }

  async delete(id: string, negocioId: string): Promise<boolean> {
    return true;
  }
}

class MockMermaRepo implements IMermaRepository {
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

describe('DashboardService (Unitario)', () => {
  let dashboardService: DashboardService;
  let ventaRepo: MockVentaRepo;
  let sucursalRepo: MockSucursalRepo;
  let productoRepo: MockProductoRepo;
  let mermaRepo: MockMermaRepo;
  let corteCajaService: CorteCajaService;
  let inventarioService: InventarioService;

  const negocioId = 'negocio-carniceria-colombia';
  const sucursal1Id = 'suc-norte-001';
  const sucursal2Id = 'suc-sur-002';
  const prodLomoId = 'prod-lomo-res';
  const prodPolloId = 'prod-pechuga-pollo';

  const hoy = new Date('2026-09-07T14:30:00Z');

  beforeEach(() => {
    ventaRepo = new MockVentaRepo();
    sucursalRepo = new MockSucursalRepo();
    productoRepo = new MockProductoRepo();
    mermaRepo = new MockMermaRepo();
    corteCajaService = new CorteCajaService();
    inventarioService = new InventarioService();

    // Configurar sucursales
    sucursalRepo.sucursales = [
      new Sucursal({ id: sucursal1Id, negocioId, nombre: 'Sucursal Norte', direccion: 'Calle 100', ciudad: 'Bogotá' }),
      new Sucursal({ id: sucursal2Id, negocioId, nombre: 'Sucursal Sur', direccion: 'Carrera 10', ciudad: 'Bogotá' }),
    ];

    // Configurar catálogo de productos con costo promedio
    productoRepo.productos = [
      new Producto({
        id: prodLomoId,
        negocioId,
        categoriaId: 'cat-res',
        nombre: 'Lomo Fino de Res',
        tipoVenta: 'peso',
        unidadMedida: 'kg',
        precio: 40000.0,
        costoPromedio: 24000.0, // Margen 40%
      }),
      new Producto({
        id: prodPolloId,
        negocioId,
        categoriaId: 'cat-pollo',
        nombre: 'Pechuga de Pollo',
        tipoVenta: 'peso',
        unidadMedida: 'kg',
        precio: 20000.0,
        costoPromedio: 14000.0, // Margen 30%
      }),
    ];

    dashboardService = new DashboardService(
      ventaRepo,
      sucursalRepo,
      productoRepo,
      inventarioService,
      corteCajaService,
      mermaRepo,
    );
  });

  describe('GET /dashboard/owner (EARS-DASH-01, US-13)', () => {
    it('debe calcular métricas agregadas de ventas de hoy, ticket promedio y margen bruto estimado', async () => {
      // Venta 1 en Sucursal Norte: 2 kg Lomo ($80,000)
      const v1 = new Venta({
        id: 'vnt-owner-01',
        sucursalId: sucursal1Id,
        dispositivoId: 'term-pos-1',
        cajeroId: 'usr-cajero-1',
        subtotal: 80000.0,
        descuento: 0,
        total: 80000.0,
        metodoPago: 'efectivo',
        estado: 'completada',
        fechaHoraDispositivo: hoy,
        fechaHoraServidor: hoy,
        sincronizada: true,
        detalles: [
          new DetalleVenta({ ventaId: 'vnt-owner-01', productoId: prodLomoId, cantidad: 2.0, precioUnitario: 40000.0, subtotalLinea: 80000.0 }),
        ],
        pagos: [new PagoVenta({ ventaId: 'vnt-owner-01', metodo: 'efectivo', monto: 80000.0 })],
      });

      // Venta 2 en Sucursal Sur: 1 kg Pechuga ($20,000)
      const v2 = new Venta({
        id: 'vnt-owner-02',
        sucursalId: sucursal2Id,
        dispositivoId: 'term-pos-2',
        cajeroId: 'usr-cajero-2',
        subtotal: 20000.0,
        descuento: 0,
        total: 20000.0,
        metodoPago: 'tarjeta',
        estado: 'completada',
        fechaHoraDispositivo: hoy,
        fechaHoraServidor: hoy,
        sincronizada: true,
        detalles: [
          new DetalleVenta({ ventaId: 'vnt-owner-02', productoId: prodPolloId, cantidad: 1.0, precioUnitario: 20000.0, subtotalLinea: 20000.0 }),
        ],
        pagos: [new PagoVenta({ ventaId: 'vnt-owner-02', metodo: 'tarjeta', monto: 20000.0 })],
      });

      ventaRepo.ventas = [v1, v2];

      const res = await dashboardService.getDashboardOwner(negocioId, hoy);

      // Verificación de totales consolidados
      expect(res.negocioId).toBe(negocioId);
      expect(res.syncTimestamp).toBeDefined();
      expect(res.ventasHoy.totalVentas).toBe(100000.0);
      expect(res.ventasHoy.totalTransacciones).toBe(2);
      expect(res.ventasHoy.ticketPromedio).toBe(50000.0);

      // Costo total = (2 * 24000) + (1 * 14000) = 48000 + 14000 = 62000
      expect(res.ventasHoy.costoTotalEstimado).toBe(62000.0);
      // Margen bruto = 100000 - 62000 = 38000
      expect(res.ventasHoy.margenBrutoEstimado).toBe(38000.0);
      expect(res.ventasHoy.porcentajeMargenBruto).toBe(38.0);

      // Desglose de métodos de pago
      expect(res.desgloseMetodosPago).toHaveLength(2);
      const ef = res.desgloseMetodosPago.find((m) => m.metodo === 'efectivo');
      const tj = res.desgloseMetodosPago.find((m) => m.metodo === 'tarjeta');
      expect(ef?.monto).toBe(80000.0);
      expect(ef?.porcentaje).toBe(80.0);
      expect(tj?.monto).toBe(20000.0);
      expect(tj?.porcentaje).toBe(20.0);

      // Comparativo de sucursales
      expect(res.comparativoSucursales).toHaveLength(2);
      const sucNorte = res.comparativoSucursales.find((s) => s.sucursalId === sucursal1Id);
      const sucSur = res.comparativoSucursales.find((s) => s.sucursalId === sucursal2Id);
      expect(sucNorte?.totalVentas).toBe(80000.0);
      expect(sucNorte?.participacion).toBe(80.0);
      expect(sucSur?.totalVentas).toBe(20000.0);
      expect(sucSur?.participacion).toBe(20.0);

      // Top productos
      expect(res.topProductos).toHaveLength(2);
      expect(res.topProductos[0].nombreProducto).toBe('Lomo Fino de Res');
      expect(res.topProductos[0].montoTotal).toBe(80000.0);
    });

    it('debe calcular comparativa con ventas de ayer', async () => {
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);

      const vAyer = new Venta({
        id: 'vnt-ayer-01',
        sucursalId: sucursal1Id,
        dispositivoId: 'term-pos-1',
        cajeroId: 'usr-cajero-1',
        subtotal: 50000.0,
        descuento: 0,
        total: 50000.0,
        metodoPago: 'efectivo',
        estado: 'completada',
        fechaHoraDispositivo: ayer,
        fechaHoraServidor: ayer,
        sincronizada: true,
        detalles: [
          new DetalleVenta({ ventaId: 'vnt-ayer-01', productoId: prodPolloId, cantidad: 2.5, precioUnitario: 20000.0, subtotalLinea: 50000.0 }),
        ],
        pagos: [new PagoVenta({ ventaId: 'vnt-ayer-01', metodo: 'efectivo', monto: 50000.0 })],
      });

      ventaRepo.ventas = [vAyer];

      const res = await dashboardService.getDashboardOwner(negocioId, hoy);
      expect(res.ventasHoy.totalVentas).toBe(0);
      expect(res.ventasAyer).toBeDefined();
      expect(res.ventasAyer?.totalVentas).toBe(50000.0);
      expect(res.ventasAyer?.totalTransacciones).toBe(1);
    });
  });

  describe('GET /dashboard/manager (EARS-DASH-02, US-14)', () => {
    it('debe consolidar resumen operativo por sucursal, ventas por cajero y estado de caja', async () => {
      // 1. Simular turno de caja abierto
      await corteCajaService.abrirTurno({
        sucursalId: sucursal1Id,
        dispositivoId: 'term-pos-1',
        usuarioId: 'usr-cajero-1',
        montoApertura: 50000.0,
      });

      // 2. Ventas del turno
      const v = new Venta({
        id: 'vnt-mgr-01',
        sucursalId: sucursal1Id,
        dispositivoId: 'term-pos-1',
        cajeroId: 'usr-cajero-1',
        subtotal: 60000.0,
        descuento: 0,
        total: 60000.0,
        metodoPago: 'efectivo',
        estado: 'completada',
        fechaHoraDispositivo: hoy,
        fechaHoraServidor: hoy,
        sincronizada: true,
        detalles: [
          new DetalleVenta({ ventaId: 'vnt-mgr-01', productoId: prodLomoId, cantidad: 1.5, precioUnitario: 40000.0, subtotalLinea: 60000.0 }),
        ],
        pagos: [new PagoVenta({ ventaId: 'vnt-mgr-01', metodo: 'efectivo', monto: 60000.0 })],
      });

      ventaRepo.ventas = [v];

      // 3. Merma de hoy
      mermaRepo.mermas = [
        new Merma({
          id: 'merma-01',
          sucursalId: sucursal1Id,
          productoId: prodLomoId,
          dispositivoId: 'term-pos-1',
          cantidad: 0.35,
          motivo: 'corte_proceso',
          usuarioId: 'usr-cajero-1',
          fechaHoraDispositivo: hoy,
        }),
      ];

      const res = await dashboardService.getDashboardManager(sucursal1Id, hoy);

      expect(res.sucursalId).toBe(sucursal1Id);
      expect(res.nombreSucursal).toBe('Sucursal Norte');
      expect(res.syncTimestamp).toBeDefined();

      // Ventas del turno
      expect(res.ventasTurnoActual.totalVentas).toBe(60000.0);
      expect(res.ventasTurnoActual.totalTransacciones).toBe(1);
      expect(res.ventasTurnoActual.ticketPromedio).toBe(60000.0);
      expect(res.ventasTurnoActual.desgloseMetodosPago['efectivo']).toBe(60000.0);

      // Estado de caja
      expect(res.estadoCaja.estado).toBe('abierta');
      expect(res.estadoCaja.montoApertura).toBe(50000.0);
      expect(res.estadoCaja.ventasAcumuladasEfectivo).toBe(60000.0);
      expect(res.estadoCaja.efectivoEsperado).toBe(110000.0);

      // Ventas por cajero
      expect(res.ventasPorCajero).toHaveLength(1);
      expect(res.ventasPorCajero[0].cajeroId).toBe('usr-cajero-1');
      expect(res.ventasPorCajero[0].totalVentas).toBe(60000.0);

      // Top productos
      expect(res.topProductos).toHaveLength(1);
      expect(res.topProductos[0].nombreProducto).toBe('Lomo Fino de Res');
      expect(res.topProductos[0].cantidadTotal).toBe(1.5);
      expect(res.topProductos[0].totalRecaudado).toBe(60000.0);

      // Mermas hoy
      expect(res.mermasHoy.totalRegistros).toBe(1);
      expect(res.mermasHoy.cantidadTotalKg).toBe(0.35);
    });
  });
});
