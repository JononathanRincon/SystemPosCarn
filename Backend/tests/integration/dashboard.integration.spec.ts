import { DashboardService } from '../../src/modules/dashboard/application/services/dashboard.service';
import { DashboardController } from '../../src/modules/dashboard/presentation/http/dashboard.controller';
import { Venta } from '../../src/modules/sales/domain/entities/venta.entity';
import { DetalleVenta } from '../../src/modules/sales/domain/entities/detalle-venta.entity';
import { PagoVenta } from '../../src/modules/sales/domain/entities/pago-venta.entity';
import { Sucursal } from '../../src/modules/catalog/domain/entities/sucursal.entity';
import { Producto } from '../../src/modules/catalog/domain/entities/producto.entity';
import { CorteCaja } from '../../src/modules/cash/domain/entities/corte-caja.entity';
import { IVentaRepository } from '../../src/modules/sales/domain/ports/venta-repository.port';
import { SucursalRepositoryPort } from '../../src/modules/catalog/domain/ports/sucursal-repository.port';
import { ProductoRepositoryPort } from '../../src/modules/catalog/domain/ports/producto-repository.port';
import { CorteCajaService } from '../../src/modules/cash/application/services/corte-caja.service';
import { InventarioService } from '../../src/modules/inventory/application/services/inventario.service';
import { BadRequestException } from '@nestjs/common';

class IntegrationVentaRepository implements IVentaRepository {
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

class IntegrationSucursalRepository implements SucursalRepositoryPort {
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

class IntegrationProductoRepository implements ProductoRepositoryPort {
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

describe('Integración: Endpoints de Dashboard API (TASK-16)', () => {
  let ventaRepo: IntegrationVentaRepository;
  let sucursalRepo: IntegrationSucursalRepository;
  let productoRepo: IntegrationProductoRepository;
  let corteCajaService: CorteCajaService;
  let inventarioService: InventarioService;
  let dashboardService: DashboardService;
  let dashboardController: DashboardController;

  const negocioId = 'negocio-carniceria-colombia';
  const sucursalPrincipalId = 'suc-centro-001';
  const prodCostillaId = 'prod-costilla-res';

  const hoy = new Date();

  beforeEach(() => {
    ventaRepo = new IntegrationVentaRepository();
    sucursalRepo = new IntegrationSucursalRepository();
    productoRepo = new IntegrationProductoRepository();
    corteCajaService = new CorteCajaService();
    inventarioService = new InventarioService();

    sucursalRepo.sucursales = [
      new Sucursal({
        id: sucursalPrincipalId,
        negocioId,
        nombre: 'Sede Principal Centro',
        direccion: 'Av Central # 45',
        ciudad: 'Medellín',
      }),
    ];

    productoRepo.productos = [
      new Producto({
        id: prodCostillaId,
        negocioId,
        categoriaId: 'cat-res',
        nombre: 'Costilla Especial de Res',
        tipoVenta: 'peso',
        unidadMedida: 'kg',
        precio: 28000.0,
        costoPromedio: 17000.0,
      }),
    ];

    dashboardService = new DashboardService(
      ventaRepo,
      sucursalRepo,
      productoRepo,
      inventarioService,
      corteCajaService,
    );

    dashboardController = new DashboardController(dashboardService);
  });

  it('debe responder GET /dashboard/owner con estructura canónica, márgenes y syncTimestamp (EARS-DASH-01, US-13)', async () => {
    // 1. Simular ventas completadas sincronizadas
    const v1 = new Venta({
      id: 'vnt-sync-01',
      sucursalId: sucursalPrincipalId,
      dispositivoId: 'term-pos-1',
      cajeroId: 'usr-cajero-1',
      subtotal: 56000.0,
      descuento: 0,
      total: 56000.0,
      metodoPago: 'efectivo',
      estado: 'completada',
      fechaHoraDispositivo: hoy,
      fechaHoraServidor: hoy,
      sincronizada: true,
      detalles: [
        new DetalleVenta({
          ventaId: 'vnt-sync-01',
          productoId: prodCostillaId,
          cantidad: 2.0,
          precioUnitario: 28000.0,
          subtotalLinea: 56000.0,
        }),
      ],
      pagos: [new PagoVenta({ ventaId: 'vnt-sync-01', metodo: 'efectivo', monto: 56000.0 })],
    });

    ventaRepo.ventas.push(v1);

    // Mock usuario autenticado con rol dueño
    const reqMock = {
      user: {
        id: 'usr-owner-01',
        nombre: 'Don Carnicero',
        rol: 'dueno',
        negocioId,
      },
    };

    const response = await dashboardController.getOwnerDashboard(reqMock);

    expect(response.negocioId).toBe(negocioId);
    expect(response.syncTimestamp).toBeDefined();
    expect(new Date(response.syncTimestamp).getTime()).not.toBeNaN();
    expect(response.ventasHoy.totalVentas).toBe(56000.0);
    expect(response.ventasHoy.totalTransacciones).toBe(1);
    expect(response.ventasHoy.ticketPromedio).toBe(56000.0);

    // Margen bruto: Total ventas ($56,000) - Costo (2 * 17000 = $34,000) = $22,000 (39.29%)
    expect(response.ventasHoy.costoTotalEstimado).toBe(34000.0);
    expect(response.ventasHoy.margenBrutoEstimado).toBe(22000.0);
    expect(response.ventasHoy.porcentajeMargenBruto).toBe(39.29);

    // Desglose de métodos de pago
    expect(response.desgloseMetodosPago).toHaveLength(1);
    expect(response.desgloseMetodosPago[0].metodo).toBe('efectivo');
    expect(response.desgloseMetodosPago[0].monto).toBe(56000.0);
    expect(response.desgloseMetodosPago[0].porcentaje).toBe(100.0);

    // Comparativo sucursales
    expect(response.comparativoSucursales).toHaveLength(1);
    expect(response.comparativoSucursales[0].nombreSucursal).toBe('Sede Principal Centro');
    expect(response.comparativoSucursales[0].totalVentas).toBe(56000.0);

    // Top productos
    expect(response.topProductos).toHaveLength(1);
    expect(response.topProductos[0].nombreProducto).toBe('Costilla Especial de Res');
    expect(response.topProductos[0].cantidadTotal).toBe(2.0);
  });

  it('debe responder GET /dashboard/manager con resumen operativo de sucursal (EARS-DASH-02, US-14)', async () => {
    // Abrir turno en caja
    await corteCajaService.abrirTurno({
      sucursalId: sucursalPrincipalId,
      dispositivoId: 'term-pos-1',
      usuarioId: 'usr-cajero-1',
      montoApertura: 30000.0,
    });

    const v1 = new Venta({
      id: 'vnt-sync-02',
      sucursalId: sucursalPrincipalId,
      dispositivoId: 'term-pos-1',
      cajeroId: 'usr-cajero-1',
      subtotal: 84000.0,
      descuento: 0,
      total: 84000.0,
      metodoPago: 'efectivo',
      estado: 'completada',
      fechaHoraDispositivo: hoy,
      fechaHoraServidor: hoy,
      sincronizada: true,
      detalles: [
        new DetalleVenta({
          ventaId: 'vnt-sync-02',
          productoId: prodCostillaId,
          cantidad: 3.0,
          precioUnitario: 28000.0,
          subtotalLinea: 84000.0,
        }),
      ],
      pagos: [new PagoVenta({ ventaId: 'vnt-sync-02', metodo: 'efectivo', monto: 84000.0 })],
    });

    ventaRepo.ventas.push(v1);

    const reqMock = {
      user: {
        id: 'usr-gerente-01',
        nombre: 'Gerente Sucursal',
        rol: 'gerente',
        sucursalId: sucursalPrincipalId,
      },
    };

    const response = await dashboardController.getManagerDashboard(undefined, reqMock);

    expect(response.sucursalId).toBe(sucursalPrincipalId);
    expect(response.nombreSucursal).toBe('Sede Principal Centro');
    expect(response.ventasTurnoActual.totalVentas).toBe(84000.0);
    expect(response.estadoCaja.estado).toBe('abierta');
    expect(response.estadoCaja.montoApertura).toBe(30000.0);
    expect(response.estadoCaja.efectivoEsperado).toBe(114000.0);
    expect(response.ventasPorCajero).toHaveLength(1);
    expect(response.ventasPorCajero[0].cajeroId).toBe('usr-cajero-1');
  });

  it('debe rechazar GET /dashboard/manager si no se especifica sucursalId ni en query ni en token', async () => {
    const reqMock = {
      user: {
        id: 'usr-owner-01',
        rol: 'dueno',
      },
    };

    await expect(dashboardController.getManagerDashboard(undefined, reqMock)).rejects.toThrow(
      BadRequestException,
    );
  });
});
