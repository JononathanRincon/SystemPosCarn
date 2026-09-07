import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DashboardOwnerResponseDto,
  MetricasVentasOwnerDto,
  VentasPorMetodoPagoDto,
  ComparativoSucursalDto,
  TopProductoOwnerDto,
} from '../dtos/dashboard-owner.dto';
import {
  DashboardManagerResponseDto,
  EstadoCajaActualDto,
  ResumenVentasCajeroDto,
  TopProductoManagerDto,
} from '../dtos/dashboard-manager.dto';
import { IVentaRepository, VENTA_REPOSITORY } from '../../../sales/domain/ports/venta-repository.port';
import { Venta } from '../../../sales/domain/entities/venta.entity';
import { VentaCompletadaEvent } from '../../../sales/domain/events/venta-completada.event';
import { SucursalRepositoryPort, SUCURSAL_REPOSITORY_PORT } from '../../../catalog/domain/ports/sucursal-repository.port';
import { ProductoRepositoryPort, PRODUCTO_REPOSITORY_PORT } from '../../../catalog/domain/ports/producto-repository.port';
import { InventarioService } from '../../../inventory/application/services/inventario.service';
import { CorteCajaService } from '../../../cash/application/services/corte-caja.service';
import { IMermaRepository, MERMA_REPOSITORY } from '../../../inventory/domain/ports/merma-repository.port';

@Injectable()
export class DashboardService {
  private ventasEnMemoria: Venta[] = [];
  private ultimaSincronizacionServidor: Date = new Date();

  constructor(
    @Optional()
    @Inject(VENTA_REPOSITORY)
    private readonly ventaRepo?: IVentaRepository,
    @Optional()
    @Inject(SUCURSAL_REPOSITORY_PORT)
    private readonly sucursalRepo?: SucursalRepositoryPort,
    @Optional()
    @Inject(PRODUCTO_REPOSITORY_PORT)
    private readonly productoRepo?: ProductoRepositoryPort,
    @Optional()
    private readonly inventarioService?: InventarioService,
    @Optional()
    private readonly corteCajaService?: CorteCajaService,
    @Optional()
    @Inject(MERMA_REPOSITORY)
    private readonly mermaRepo?: IMermaRepository,
  ) {}

  /**
   * Helper para actualizar la marca de tiempo de última sincronización
   */
  public registrarSyncEvent(timestamp: Date = new Date()): void {
    this.ultimaSincronizacionServidor = timestamp;
  }

  /**
   * design.md Sec. 8:
   * DashboardModule escucha VentaCompletadaEvent e invalida / refresca syncTimestamp
   */
  @OnEvent(VentaCompletadaEvent.EVENT_NAME, { async: true })
  handleVentaCompletadaEvent(event: VentaCompletadaEvent): void {
    this.registrarSyncEvent(event.timestamp || new Date());
  }

  public agregarVentaEnMemoria(venta: Venta): void {
    this.ventasEnMemoria.push(venta);
    this.registrarSyncEvent(venta.fechaHoraServidor || new Date());
  }

  /**
   * EARS-DASH-01, EARS-DASH-02, US-13, design.md sec 7.6:
   * GET /dashboard/owner
   * Retorna métricas consolidadas financieras y operativas para el dueño / admin.
   */
  async getDashboardOwner(negocioId: string, fechaReferencia: Date = new Date()): Promise<DashboardOwnerResponseDto> {
    const inicioHoy = new Date(fechaReferencia);
    inicioHoy.setHours(0, 0, 0, 0);

    const finHoy = new Date(fechaReferencia);
    finHoy.setHours(23, 59, 59, 999);

    const inicioAyer = new Date(inicioHoy);
    inicioAyer.setDate(inicioAyer.getDate() - 1);

    const finAyer = new Date(inicioHoy);
    finAyer.setMilliseconds(-1);

    // 1. Obtener sucursales del negocio
    let sucursales: { id: string; nombre: string }[] = [];
    if (this.sucursalRepo) {
      const entities = await this.sucursalRepo.findByNegocioId(negocioId);
      sucursales = entities.map((s) => ({ id: s.id, nombre: s.nombre }));
    } else {
      sucursales = [{ id: 'suc-default-01', nombre: 'Sucursal Principal' }];
    }

    // 2. Obtener todas las ventas del negocio
    const todasLasVentas = await this.obtenerVentasPorSucursales(sucursales.map((s) => s.id));

    // Filtrar ventas por fecha
    const ventasHoy = todasLasVentas.filter((v) => {
      if (v.estado !== 'completada') return false;
      const t = v.fechaHoraServidor.getTime();
      return t >= inicioHoy.getTime() && t <= finHoy.getTime();
    });

    const ventasAyer = todasLasVentas.filter((v) => {
      if (v.estado !== 'completada') return false;
      const t = v.fechaHoraServidor.getTime();
      return t >= inicioAyer.getTime() && t <= finAyer.getTime();
    });

    // 3. Cálculos financieros agregados de Hoy
    const metricasHoy = await this.calcularMetricasFinancieras(ventasHoy, negocioId);
    const metricasAyer = await this.calcularMetricasFinancieras(ventasAyer, negocioId);

    // 4. Desglose de métodos de pago
    const desgloseMetodosPago = this.calcularDesgloseMetodosPago(ventasHoy, metricasHoy.totalVentas);

    // 5. Comparativo entre sucursales activas
    const comparativoSucursales: ComparativoSucursalDto[] = sucursales.map((suc) => {
      const ventasSuc = ventasHoy.filter((v) => v.sucursalId === suc.id);
      const totalVentasSuc = Math.round(ventasSuc.reduce((acc, v) => acc + v.total, 0) * 100) / 100;
      const totalTransaccionesSuc = ventasSuc.length;
      const ticketPromedioSuc = totalTransaccionesSuc > 0
        ? Math.round((totalVentasSuc / totalTransaccionesSuc) * 100) / 100
        : 0;
      const participacion = metricasHoy.totalVentas > 0
        ? Math.round((totalVentasSuc / metricasHoy.totalVentas) * 10000) / 100
        : 0;

      return {
        sucursalId: suc.id,
        nombreSucursal: suc.nombre,
        totalVentas: totalVentasSuc,
        totalTransacciones: totalTransaccionesSuc,
        ticketPromedio: ticketPromedioSuc,
        participacion,
      };
    });

    // 6. Top productos vendidos hoy
    const topProductos = await this.calcularTopProductosOwner(ventasHoy, negocioId);

    // 7. Alertas consolidadas de stock bajo y lotes por vencer
    let alertasStockBajoTotal = 0;
    let lotesPorVencerTotal = 0;

    if (this.inventarioService) {
      for (const suc of sucursales) {
        const alertas = await this.inventarioService.consultarAlertasStock(suc.id);
        alertasStockBajoTotal += alertas.length;

        const lotes = await this.inventarioService.consultarLotesPorVencer(suc.id, 3);
        lotesPorVencerTotal += lotes.length;
      }
    }

    return {
      negocioId,
      fechaInicio: inicioHoy,
      fechaFin: finHoy,
      syncTimestamp: this.ultimaSincronizacionServidor.toISOString(),
      ventasHoy: metricasHoy,
      ventasAyer: metricasAyer,
      desgloseMetodosPago,
      comparativoSucursales,
      topProductos,
      alertasStockBajoTotal,
      lotesPorVencerTotal,
    };
  }

  /**
   * EARS-DASH-01, EARS-DASH-02, US-14, design.md sec 7.6:
   * GET /dashboard/manager?sucursalId=...
   * Retorna resumen operativo en vivo de la sucursal activa.
   */
  async getDashboardManager(sucursalId: string, fechaReferencia: Date = new Date()): Promise<DashboardManagerResponseDto> {
    const inicioHoy = new Date(fechaReferencia);
    inicioHoy.setHours(0, 0, 0, 0);

    const finHoy = new Date(fechaReferencia);
    finHoy.setHours(23, 59, 59, 999);

    let nombreSucursal = 'Sucursal';
    let negocioId = '';
    if (this.sucursalRepo) {
      const suc = await this.sucursalRepo.findById(sucursalId);
      if (suc) {
        nombreSucursal = suc.nombre;
        negocioId = suc.negocioId;
      }
    }

    // 1. Obtener ventas de la sucursal
    const ventasSucursal = (await this.obtenerVentasPorSucursales([sucursalId])).filter((v) => {
      if (v.estado !== 'completada') return false;
      const t = v.fechaHoraServidor.getTime();
      return t >= inicioHoy.getTime() && t <= finHoy.getTime();
    });

    const totalVentasTurno = Math.round(ventasSucursal.reduce((acc, v) => acc + v.total, 0) * 100) / 100;
    const totalTransacciones = ventasSucursal.length;
    const ticketPromedio = totalTransacciones > 0
      ? Math.round((totalVentasTurno / totalTransacciones) * 100) / 100
      : 0;

    const desgloseMetodosPago: Record<string, number> = {};
    for (const v of ventasSucursal) {
      for (const p of v.pagos) {
        const m = p.metodo.toLowerCase();
        desgloseMetodosPago[m] = Math.round(((desgloseMetodosPago[m] || 0) + p.monto) * 100) / 100;
      }
    }

    // 2. Estado actual de caja
    let estadoCaja: EstadoCajaActualDto = {
      estado: 'sin_turno',
      montoApertura: 0,
      ventasAcumuladasEfectivo: 0,
      efectivoEsperado: 0,
    };

    if (this.corteCajaService) {
      // Buscar turno abierto para los dispositivos asociados a ventas o genérico
      const dispositivoId = ventasSucursal.length > 0 ? ventasSucursal[0].dispositivoId : 'caja-1';
      const turno = await this.corteCajaService.buscarTurnoAbiertoPorDispositivo(dispositivoId);
      if (turno) {
        let ventasEfectivo = desgloseMetodosPago['efectivo'] || 0;
        estadoCaja = {
          corteId: turno.id,
          dispositivoId: turno.dispositivoId,
          estado: 'abierta',
          montoApertura: turno.montoApertura,
          ventasAcumuladasEfectivo: ventasEfectivo,
          efectivoEsperado: Math.round((turno.montoApertura + ventasEfectivo) * 100) / 100,
        };
      } else {
        estadoCaja = {
          estado: 'cerrada',
          montoApertura: 0,
          ventasAcumuladasEfectivo: desgloseMetodosPago['efectivo'] || 0,
          efectivoEsperado: desgloseMetodosPago['efectivo'] || 0,
        };
      }
    }

    // 3. Ventas por Cajero
    const ventasPorCajeroMap: Map<string, { total: number; count: number }> = new Map();
    for (const v of ventasSucursal) {
      const c = ventasPorCajeroMap.get(v.cajeroId) || { total: 0, count: 0 };
      c.total = Math.round((c.total + v.total) * 100) / 100;
      c.count += 1;
      ventasPorCajeroMap.set(v.cajeroId, c);
    }

    const ventasPorCajero: ResumenVentasCajeroDto[] = Array.from(ventasPorCajeroMap.entries()).map(
      ([cajeroId, data]) => ({
        cajeroId,
        nombreCajero: `Cajero ${cajeroId.substring(0, 8)}`,
        totalVentas: data.total,
        totalTransacciones: data.count,
        ticketPromedio: data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0,
      }),
    );

    // 4. Top Productos vendidos en la sucursal
    const topProductos = await this.calcularTopProductosManager(ventasSucursal, negocioId);

    // 5. Inventario crítico y lotes por vencer
    let inventarioCritico: any[] = [];
    let lotesPorVencer: any[] = [];

    if (this.inventarioService) {
      inventarioCritico = await this.inventarioService.consultarAlertasStock(sucursalId);
      lotesPorVencer = await this.inventarioService.consultarLotes({
        sucursal_id: sucursalId,
        estado: 'activo',
      });
      // Filtrar a los que vencen en <= 3 días
      lotesPorVencer = lotesPorVencer.filter((l) => l.proximo_a_vencer);
    }

    // 6. Mermas de hoy
    let mermasHoy = { totalRegistros: 0, cantidadTotalKg: 0 };
    if (this.mermaRepo) {
      const mermas = await this.mermaRepo.buscarPorSucursal(sucursalId);
      const mermasDelDia = mermas.filter((m) => {
        const t = m.fechaHoraDispositivo.getTime();
        return t >= inicioHoy.getTime() && t <= finHoy.getTime();
      });
      mermasHoy = {
        totalRegistros: mermasDelDia.length,
        cantidadTotalKg: Number(mermasDelDia.reduce((acc, m) => acc + m.cantidad, 0).toFixed(3)),
      };
    }

    return {
      sucursalId,
      nombreSucursal,
      fecha: fechaReferencia,
      syncTimestamp: this.ultimaSincronizacionServidor.toISOString(),
      ventasTurnoActual: {
        totalVentas: totalVentasTurno,
        totalTransacciones,
        ticketPromedio,
        desgloseMetodosPago,
      },
      estadoCaja,
      ventasPorCajero,
      topProductos,
      inventarioCritico,
      lotesPorVencer,
      mermasHoy,
    };
  }

  // --- Métodos privados de soporte y agregación ---

  private async obtenerVentasPorSucursales(sucursalIds: string[]): Promise<Venta[]> {
    const res: Venta[] = [];
    if (this.ventaRepo) {
      for (const sucId of sucursalIds) {
        const ventas = await this.ventaRepo.buscarPorSucursal(sucId, 1000);
        res.push(...ventas);
      }
      return res;
    }
    return this.ventasEnMemoria.filter((v) => sucursalIds.includes(v.sucursalId));
  }

  private async calcularMetricasFinancieras(ventas: Venta[], negocioId: string): Promise<MetricasVentasOwnerDto> {
    let totalVentas = 0;
    let costoTotalEstimado = 0;

    for (const v of ventas) {
      totalVentas += v.total;
      for (const d of v.detalles) {
        let costoUnitario = 0;
        if (this.productoRepo && negocioId) {
          const prod = await this.productoRepo.findById(d.productoId, negocioId);
          if (prod) {
            costoUnitario = prod.costoPromedio;
          }
        }
        // Si no se encuentra producto en repo o es 0, estimar costo promedio base del 60%
        if (costoUnitario === 0) {
          costoUnitario = Math.round(d.precioUnitario * 0.65 * 100) / 100;
        }
        costoTotalEstimado += Number((d.cantidad * costoUnitario).toFixed(2));
      }
    }

    totalVentas = Math.round(totalVentas * 100) / 100;
    costoTotalEstimado = Math.round(costoTotalEstimado * 100) / 100;
    const margenBrutoEstimado = Math.max(0, Math.round((totalVentas - costoTotalEstimado) * 100) / 100);
    const totalTransacciones = ventas.length;
    const ticketPromedio = totalTransacciones > 0
      ? Math.round((totalVentas / totalTransacciones) * 100) / 100
      : 0;
    const porcentajeMargenBruto = totalVentas > 0
      ? Math.round((margenBrutoEstimado / totalVentas) * 10000) / 100
      : 0;

    return {
      totalVentas,
      totalTransacciones,
      ticketPromedio,
      costoTotalEstimado,
      margenBrutoEstimado,
      porcentajeMargenBruto,
    };
  }

  private calcularDesgloseMetodosPago(ventas: Venta[], totalVentas: number): VentasPorMetodoPagoDto[] {
    const mapaMetodos: Map<string, number> = new Map();
    for (const v of ventas) {
      for (const p of v.pagos) {
        const m = p.metodo.toLowerCase();
        mapaMetodos.set(m, (mapaMetodos.get(m) || 0) + p.monto);
      }
    }

    return Array.from(mapaMetodos.entries()).map(([metodo, monto]) => {
      const montoRedondeado = Math.round(monto * 100) / 100;
      const porcentaje = totalVentas > 0
        ? Math.round((montoRedondeado / totalVentas) * 10000) / 100
        : 0;
      return {
        metodo,
        monto: montoRedondeado,
        porcentaje,
      };
    });
  }

  private async calcularTopProductosOwner(ventas: Venta[], negocioId: string): Promise<TopProductoOwnerDto[]> {
    const mapProductos: Map<string, { cantidad: number; monto: number }> = new Map();
    for (const v of ventas) {
      for (const d of v.detalles) {
        const curr = mapProductos.get(d.productoId) || { cantidad: 0, monto: 0 };
        curr.cantidad = Number((curr.cantidad + d.cantidad).toFixed(3));
        curr.monto = Math.round((curr.monto + d.subtotalLinea) * 100) / 100;
        mapProductos.set(d.productoId, curr);
      }
    }

    const items = Array.from(mapProductos.entries())
      .sort((a, b) => b[1].monto - a[1].monto)
      .slice(0, 5);

    const resultado: TopProductoOwnerDto[] = [];
    for (const [productoId, data] of items) {
      let nombreProducto = `Producto ${productoId.substring(0, 8)}`;
      let unidadMedida = 'kg';

      if (this.productoRepo && negocioId) {
        const prod = await this.productoRepo.findById(productoId, negocioId);
        if (prod) {
          nombreProducto = prod.nombre;
          unidadMedida = prod.unidadMedida;
        }
      }

      resultado.push({
        productoId,
        nombreProducto,
        cantidadTotal: data.cantidad,
        unidadMedida,
        montoTotal: data.monto,
      });
    }

    return resultado;
  }

  private async calcularTopProductosManager(ventas: Venta[], negocioId: string): Promise<TopProductoManagerDto[]> {
    const mapProductos: Map<string, { cantidad: number; monto: number }> = new Map();
    for (const v of ventas) {
      for (const d of v.detalles) {
        const curr = mapProductos.get(d.productoId) || { cantidad: 0, monto: 0 };
        curr.cantidad = Number((curr.cantidad + d.cantidad).toFixed(3));
        curr.monto = Math.round((curr.monto + d.subtotalLinea) * 100) / 100;
        mapProductos.set(d.productoId, curr);
      }
    }

    const items = Array.from(mapProductos.entries())
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .slice(0, 5);

    const resultado: TopProductoManagerDto[] = [];
    for (const [productoId, data] of items) {
      let nombreProducto = `Corte ${productoId.substring(0, 8)}`;
      let tipoVenta: 'peso' | 'unidad' = 'peso';
      let unidadMedida = 'kg';

      if (this.productoRepo && negocioId) {
        const prod = await this.productoRepo.findById(productoId, negocioId);
        if (prod) {
          nombreProducto = prod.nombre;
          tipoVenta = prod.tipoVenta;
          unidadMedida = prod.unidadMedida;
        }
      }

      resultado.push({
        productoId,
        nombreProducto,
        tipoVenta,
        cantidadTotal: data.cantidad,
        unidadMedida,
        totalRecaudado: data.monto,
      });
    }

    return resultado;
  }
}
