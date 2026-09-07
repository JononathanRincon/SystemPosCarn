import { mockVentaOffline, mockProductoPeso } from '../helpers/mock-data.helper';
import { VentaService, IDomainEventEmitter } from '../../src/modules/sales/application/services/venta.service';
import { SalesController } from '../../src/modules/sales/presentation/http/sales.controller';
import { CorteCajaService } from '../../src/modules/cash/application/services/corte-caja.service';
import { Venta } from '../../src/modules/sales/domain/entities/venta.entity';
import { IVentaRepository } from '../../src/modules/sales/domain/ports/venta-repository.port';
import { VentaCompletadaEvent } from '../../src/modules/sales/domain/events/venta-completada.event';

class IntegrationVentaRepository implements IVentaRepository {
  public ventas: Map<string, Venta> = new Map();

  async guardarTransaccional(venta: Venta): Promise<Venta> {
    this.ventas.set(venta.id, venta);
    return venta;
  }

  async buscarPorId(id: string): Promise<Venta | null> {
    return this.ventas.get(id) || null;
  }

  async buscarPorDispositivoYRango(dispositivoId: string, desde: Date, hasta?: Date): Promise<Venta[]> {
    return Array.from(this.ventas.values()).filter((v) => {
      if (v.dispositivoId !== dispositivoId) return false;
      const t = v.fechaHoraDispositivo.getTime();
      if (t < desde.getTime()) return false;
      if (hasta && t > hasta.getTime()) return false;
      return true;
    });
  }

  async buscarPorSucursal(sucursalId: string, limite = 50): Promise<Venta[]> {
    return Array.from(this.ventas.values())
      .filter((v) => v.sucursalId === sucursalId)
      .slice(0, limite);
  }

  async actualizar(venta: Venta): Promise<Venta> {
    this.ventas.set(venta.id, venta);
    return venta;
  }
}

describe('Integración: Flujo Completo de Venta y Afectación de Stock', () => {
  it('debe completar: venta -> detalle -> pagos -> delta de inventario', async () => {
    const producto = mockProductoPeso();
    const stockInicial = 25.0; // 25 kg
    const venta = mockVentaOffline();

    // 1. Validar venta
    expect(venta.estado).toBe('completada');

    // 2. Aplicar delta
    const cantidadVendida = venta.detalles[0].cantidad; // 1.25 kg
    const stockResultante = stockInicial - cantidadVendida;

    expect(stockResultante).toBe(23.75);
    expect(venta.pagos[0].monto + venta.pagos[1].monto).toBe(venta.total);
  });

  describe('Flujo de Venta Atómica, Snapshot de Precios y Pagos Mixtos (TASK-13)', () => {
    let ventaRepo: IntegrationVentaRepository;
    let corteCajaService: CorteCajaService;
    let eventEmitter: IDomainEventEmitter;
    let eventosEmitidos: { event: string; payload: any }[];
    let ventaService: VentaService;
    let salesController: SalesController;

    const sucursalId = 'suc-123e4567-e89b-12d3-a456-426614174000';
    const dispositivoId = 'pos-term-01';
    const cajeroId = 'usr-123e4567-e89b-12d3-a456-426614174000';
    const clienteId = 'cli-123e4567-e89b-12d3-a456-426614174000';

    beforeEach(() => {
      ventaRepo = new IntegrationVentaRepository();
      eventosEmitidos = [];
      eventEmitter = {
        emit: (event: string, payload: any) => {
          eventosEmitidos.push({ event, payload });
        },
      };

      // Instanciar servicios vinculados
      corteCajaService = new CorteCajaService();
      ventaService = new VentaService(ventaRepo, corteCajaService, eventEmitter);
      salesController = new SalesController(ventaService);
    });

    it('debe bloquear la venta si la caja no ha sido abierta con base inicial (EARS-CAJA-03, EARS-CAJA-04)', async () => {
      const ventaDto = {
        id: 'vnt-bloqueo-1111',
        sucursalId,
        dispositivoId,
        cajeroId,
        total: 25000.0,
        metodoPago: 'efectivo',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId: 'prod-peso-uuid-4444',
            cantidad: 1.0,
            precioUnitario: 25000.0,
          },
        ],
        pagos: [{ metodo: 'efectivo', monto: 25000.0 }],
      };

      await expect(salesController.createSale(ventaDto as any)).rejects.toThrow();
    });

    it('debe completar venta mixta exitosamente una vez abierta la caja, congelando snapshot de precios', async () => {
      // 1. Apertura de caja con base inicial ,000
      await corteCajaService.abrirTurno({
        sucursalId,
        dispositivoId,
        usuarioId: cajeroId,
        montoApertura: 50000.0,
      });

      // 2. Venta con múltiples items (peso con 3 decimales + unidad) y pagos mixtos (efectivo + tarjeta)
      // Item 1: Lomo fino 1.345 kg @ ,000 = ,110.00
      // Item 2: Salchichas 2 unidades @ ,000 = ,000.00
      // Subtotal = ,110.00. Descuento = ,110.00. Total = ,000.00
      // Pagos: Efectivo ,000.00 + Tarjeta ,000.00 = ,000.00
      const ventaDto = {
        id: 'vnt-exitosa-2222',
        sucursalId,
        dispositivoId,
        cajeroId,
        clienteId,
        descuento: 1110.0,
        total: 80000.0,
        metodoPago: 'mixto',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId: 'prod-peso-uuid-4444',
            cantidad: 1.345, // 3 decimales para carne
            precioUnitario: 38000.0, // Snapshot
            pesoBruto: 1.35,
            pesoNeto: 1.345,
          },
          {
            productoId: 'prod-unidad-uuid-5555',
            cantidad: 2.0,
            precioUnitario: 15000.0, // Snapshot
          },
        ],
        pagos: [
          { metodo: 'efectivo', monto: 40000.0 },
          { metodo: 'tarjeta', monto: 40000.0, referenciaTransaccion: 'VOUCHER-554433' },
        ],
      };

      const respuesta = await salesController.createSale(ventaDto as any);

      expect(respuesta.id).toBe('vnt-exitosa-2222');
      expect(respuesta.estado).toBe('completada');
      expect(respuesta.subtotal).toBe(81110.0);
      expect(respuesta.descuento).toBe(1110.0);
      expect(respuesta.total).toBe(80000.0);
      expect(respuesta.detalles).toHaveLength(2);
      expect(respuesta.detalles[0].precioUnitario).toBe(38000.0);
      expect(respuesta.detalles[1].precioUnitario).toBe(15000.0);
      expect(respuesta.pagos).toHaveLength(2);

      // 3. Verificar evento de dominio para Inventario
      expect(eventosEmitidos).toHaveLength(1);
      expect(eventosEmitidos[0].event).toBe(VentaCompletadaEvent.EVENT_NAME);
      expect(eventosEmitidos[0].payload.ventaId).toBe('vnt-exitosa-2222');
      expect(eventosEmitidos[0].payload.total).toBe(80000.0);
      expect(eventosEmitidos[0].payload.detalles[0].cantidad).toBe(1.345);

      // 4. Verificar que las ventas en efectivo impactan el cálculo del efectivo esperado en la caja
      const totalEfectivo = await ventaService.obtenerTotalVentasEfectivo(dispositivoId, new Date(0));
      expect(totalEfectivo).toBe(40000.0); // Solo la porción en efectivo
    });

    it('debe soportar la anulación de la venta sin borrar el registro de persistencia', async () => {
      await corteCajaService.abrirTurno({
        sucursalId,
        dispositivoId,
        usuarioId: cajeroId,
        montoApertura: 50000.0,
      });

      const ventaDto = {
        id: 'vnt-anular-3333',
        sucursalId,
        dispositivoId,
        cajeroId,
        total: 30000.0,
        metodoPago: 'efectivo',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId: 'prod-unidad-uuid-5555',
            cantidad: 2.0,
            precioUnitario: 15000.0,
          },
        ],
        pagos: [{ metodo: 'efectivo', monto: 30000.0 }],
      };

      await salesController.createSale(ventaDto as any);
      const ventaAnulada = await salesController.voidSale('vnt-anular-3333', {
        motivo: 'Devolución de cliente por producto defectuoso',
        usuarioId: cajeroId,
      });

      expect(ventaAnulada.estado).toBe('anulada');
      const consultada = await salesController.getSaleById('vnt-anular-3333');
      expect(consultada?.estado).toBe('anulada');
    });
  });
});
