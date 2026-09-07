import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { VentaService } from '../../../src/modules/sales/application/services/venta.service';
import { InventarioService } from '../../../src/modules/inventory/application/services/inventario.service';
import { InventoryEventListener } from '../../../src/modules/inventory/application/listeners/inventory-event.listener';
import { CadenaFrioAlertService } from '../../../src/modules/inventory/application/services/cadena-frio-alert.service';
import { FefoDispatchService } from '../../../src/modules/inventory/application/services/fefo-dispatch.service';
import { VentaCompletadaEvent } from '../../../src/modules/sales/domain/events/venta-completada.event';
import { VentaAnuladaEvent } from '../../../src/modules/sales/domain/events/venta-anulada.event';
import { RecepcionCreadaEvent } from '../../../src/modules/inventory/domain/events/recepcion-creada.event';
import { VENTA_REPOSITORY } from '../../../src/modules/sales/domain/ports/venta-repository.port';
import { LOTE_REPOSITORY } from '../../../src/modules/inventory/domain/ports/lote-repository.port';
import { RECEPCION_REPOSITORY } from '../../../src/modules/inventory/domain/ports/recepcion-repository.port';
import { INVENTARIO_REPOSITORY } from '../../../src/modules/inventory/domain/ports/inventario-repository.port';
import { MOVIMIENTO_REPOSITORY } from '../../../src/modules/inventory/domain/ports/movimiento-repository.port';
import { Inventario } from '../../../src/modules/inventory/domain/entities/inventario.entity';
import { Lote } from '../../../src/modules/inventory/domain/entities/lote.entity';
import { MovimientoInventario } from '../../../src/modules/inventory/domain/entities/movimiento-inventario.entity';

describe('Bus de Eventos de Dominio (TASK-17 - EventEmitter2)', () => {
  let moduleRef: TestingModule;
  let eventEmitter: EventEmitter2;
  let ventaService: VentaService;
  let inventarioService: InventarioService;
  let listener: InventoryEventListener;
  let cadenaFrioAlertService: CadenaFrioAlertService;

  // Repositorios y mocks en memoria
  let mockVentaRepo: any;
  let mockLoteRepo: any;
  let mockRecepcionRepo: any;
  let mockInventarioRepo: any;
  let mockMovimientoRepo: any;
  let mockFefoDispatchService: any;

  const sucursalId = 'suc-123e4567-e89b-12d3-a456-426614174000';
  const productoId = 'prod-corte-res-01';

  beforeEach(async () => {
    mockVentaRepo = {
      ventas: new Map(),
      guardarTransaccional: jest.fn(async (v) => {
        mockVentaRepo.ventas.set(v.id, v);
        return v;
      }),
      buscarPorId: jest.fn(async (id) => mockVentaRepo.ventas.get(id) || null),
      actualizar: jest.fn(async (v) => {
        mockVentaRepo.ventas.set(v.id, v);
        return v;
      }),
    };

    const loteAgotado = new Lote({
      id: 'lote-agotado-1',
      productoId,
      sucursalId,
      recepcionId: 'rec-1',
      codigoLote: 'LOT-AGOTADO-01',
      proveedor: 'Frigorífico Central',
      cantidadRecibida: 10,
      cantidadDisponible: 0,
      costoUnitario: 50,
      estado: 'agotado',
    });

    mockLoteRepo = {
      lotes: [loteAgotado],
      crearMuchos: jest.fn(async (lotes) => {
        mockLoteRepo.lotes.push(...lotes);
      }),
      buscarPorSucursal: jest.fn(async (sId, pId, est) =>
        mockLoteRepo.lotes.filter((l: Lote) => (!pId || l.productoId === pId) && l.sucursalId === sId),
      ),
      actualizar: jest.fn(async (lote) => {
        const idx = mockLoteRepo.lotes.findIndex((l: Lote) => l.id === lote.id);
        if (idx >= 0) mockLoteRepo.lotes[idx] = lote;
      }),
    };

    mockRecepcionRepo = {
      recepciones: [],
      crear: jest.fn(async (r) => {
        mockRecepcionRepo.recepciones.push(r);
      }),
    };

    const invExistente = new Inventario({
      id: 'inv-1',
      sucursalId,
      productoId,
      cantidadActual: 20.0,
      cantidadMinimaAlerta: 5.0,
    });

    mockInventarioRepo = {
      inventarios: [invExistente],
      buscarPorProductoYSucursal: jest.fn(async (pId, sId) =>
        mockInventarioRepo.inventarios.find((i: Inventario) => i.productoId === pId && i.sucursalId === sId) || null,
      ),
      actualizar: jest.fn(async (inv) => {
        const idx = mockInventarioRepo.inventarios.findIndex((i: Inventario) => i.id === inv.id);
        if (idx >= 0) mockInventarioRepo.inventarios[idx] = inv;
      }),
      crear: jest.fn(async (inv) => {
        mockInventarioRepo.inventarios.push(inv);
      }),
    };

    mockMovimientoRepo = {
      movimientos: [],
      crear: jest.fn(async (m) => {
        mockMovimientoRepo.movimientos.push(m);
      }),
      crearMuchos: jest.fn(async (arr) => {
        mockMovimientoRepo.movimientos.push(...arr);
      }),
    };

    mockFefoDispatchService = {
      despacharFefo: jest.fn().mockResolvedValue({
        productoId,
        cantidadTotalDespachada: 2.5,
        cantidadPendienteSinLote: 0,
        asignaciones: [],
        costoTotalDespacho: 125,
        completamenteCubierto: true,
      }),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({
          wildcard: false,
          delimiter: '.',
          maxListeners: 20,
        }),
      ],
      providers: [
        CadenaFrioAlertService,
        InventoryEventListener,
        {
          provide: VentaService,
          useFactory: (repo, emitter) => new VentaService(repo, undefined, undefined, emitter),
          inject: [VENTA_REPOSITORY, EventEmitter2],
        },
        {
          provide: InventarioService,
          useFactory: (loteR, recR, invR, movR, emitter) =>
            new InventarioService(loteR, recR, invR, movR, emitter),
          inject: [
            LOTE_REPOSITORY,
            RECEPCION_REPOSITORY,
            INVENTARIO_REPOSITORY,
            MOVIMIENTO_REPOSITORY,
            EventEmitter2,
          ],
        },
        { provide: VENTA_REPOSITORY, useValue: mockVentaRepo },
        { provide: LOTE_REPOSITORY, useValue: mockLoteRepo },
        { provide: RECEPCION_REPOSITORY, useValue: mockRecepcionRepo },
        { provide: INVENTARIO_REPOSITORY, useValue: mockInventarioRepo },
        { provide: MOVIMIENTO_REPOSITORY, useValue: mockMovimientoRepo },
        { provide: FefoDispatchService, useValue: mockFefoDispatchService },
      ],
    }).compile();

    await moduleRef.init();

    eventEmitter = moduleRef.get<EventEmitter2>(EventEmitter2);
    ventaService = moduleRef.get<VentaService>(VentaService);
    inventarioService = moduleRef.get<InventarioService>(InventarioService);
    listener = moduleRef.get<InventoryEventListener>(InventoryEventListener);
    cadenaFrioAlertService = moduleRef.get<CadenaFrioAlertService>(CadenaFrioAlertService);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe('1. VentaCompletadaEvent (EARS-INV-02, EARS-LOTE-02)', () => {
    it('debe emitir VentaCompletadaEvent al crear una venta y ejecutar el despacho FEFO desacoplado', async () => {
      const spyEmit = jest.spyOn(eventEmitter, 'emit');
      const spyListener = jest.spyOn(listener, 'handleVentaCompletada');

      const ventaDto = {
        id: crypto.randomUUID(),
        sucursalId,
        dispositivoId: 'term-pos-1',
        cajeroId: 'usr-cajero-1',
        total: 50000,
        metodoPago: 'efectivo',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId,
            cantidad: 2.5,
            precioUnitario: 20000,
            pesoNeto: 2.5,
          },
        ],
        pagos: [{ metodo: 'efectivo', monto: 50000 }],
      };

      const ventaCreada = await ventaService.crearVenta(ventaDto as any);

      expect(ventaCreada).toBeDefined();
      expect(spyEmit).toHaveBeenCalledWith(
        VentaCompletadaEvent.EVENT_NAME,
        expect.objectContaining({
          ventaId: ventaDto.id,
          sucursalId,
          total: 50000,
          detalles: expect.arrayContaining([
            expect.objectContaining({ productoId, cantidad: 2.5 }),
          ]),
        }),
      );

      // Esperar micro-tick para propagación asíncrona del listener
      await new Promise((r) => setTimeout(r, 50));

      expect(spyListener).toHaveBeenCalled();
      expect(mockFefoDispatchService.despacharFefo).toHaveBeenCalledWith(
        expect.objectContaining({
          productoId,
          sucursalId,
          cantidad: 2.5,
          ventaId: ventaDto.id,
          permitirStockNegativo: true,
        }),
      );
    });
  });

  describe('2. VentaAnuladaEvent (design.md Sec. 8)', () => {
    it('debe emitir VentaAnuladaEvent al anular una venta y revertir inventario (+ delta) y reabrir lotes', async () => {
      const spyEmit = jest.spyOn(eventEmitter, 'emit');
      const spyListener = jest.spyOn(listener, 'handleVentaAnulada');

      const ventaId = crypto.randomUUID();
      const ventaDto = {
        id: ventaId,
        sucursalId,
        dispositivoId: 'term-pos-1',
        cajeroId: 'usr-cajero-1',
        total: 20000,
        metodoPago: 'efectivo',
        fechaHoraDispositivo: new Date().toISOString(),
        detalles: [
          {
            productoId,
            cantidad: 1.0,
            precioUnitario: 20000,
          },
        ],
        pagos: [{ metodo: 'efectivo', monto: 20000 }],
      };

      await ventaService.crearVenta(ventaDto as any);

      // Anular la venta creada
      const ventaAnulada = await ventaService.anularVenta(ventaId, {
        motivo: 'Devolución de corte por solicitud del cliente',
        usuarioId: 'usr-admin-1',
      });

      expect(ventaAnulada.estado).toBe('anulada');
      expect(spyEmit).toHaveBeenCalledWith(
        VentaAnuladaEvent.EVENT_NAME,
        expect.objectContaining({
          ventaId,
          sucursalId,
          motivo: 'Devolución de corte por solicitud del cliente',
          usuarioId: 'usr-admin-1',
          detalles: expect.arrayContaining([
            expect.objectContaining({ productoId, cantidad: 1.0 }),
          ]),
        }),
      );

      // Esperar micro-tick para propagación del listener
      await new Promise((r) => setTimeout(r, 50));

      expect(spyListener).toHaveBeenCalled();
      // Verificación de incremento de stock en inventario
      expect(mockInventarioRepo.actualizar).toHaveBeenCalled();
      // Verificación de movimiento delta positivo de reposición
      expect(mockMovimientoRepo.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'devolucion',
          cantidadDelta: 1.0,
          referenciaId: ventaId,
        }),
      );

      // Verificación de lote agotado reabierto
      const loteRestaurado = mockLoteRepo.lotes.find((l: Lote) => l.id === 'lote-agotado-1');
      expect(loteRestaurado.estado).toBe('activo');
      expect(loteRestaurado.cantidadDisponible).toBe(1.0);
    });
  });

  describe('3. RecepcionCreadaEvent y Ruptura de Cadena de Frío (EARS-LOTE-05)', () => {
    it('debe emitir RecepcionCreadaEvent sin alerta cuando temperatura es <= 4°C', async () => {
      const spyEmit = jest.spyOn(eventEmitter, 'emit');

      const recepcionDto = {
        sucursal_id: sucursalId,
        proveedor: 'Frigorífico Guadalupe',
        numero_factura_remision: 'FAC-9988',
        temperatura_vehiculo: 3.5, // <= 4°C
        items: [
          {
            producto_id: productoId,
            codigo_lote: 'LOT-FRIO-01',
            cantidad: 50,
            costo_unitario: 15000,
            temperatura_recepcion: 2.8, // <= 4°C
            fecha_vencimiento: new Date(Date.now() + 86400000 * 5).toISOString(),
          },
        ],
      };

      const resp = await inventarioService.registrarRecepcion(recepcionDto as any, 'usr-operador-1');

      expect(resp.alerta_cadena_frio).toBe(false);
      expect(spyEmit).toHaveBeenCalledWith(
        RecepcionCreadaEvent.EVENT_NAME,
        expect.objectContaining({
          proveedor: 'Frigorífico Guadalupe',
          alertaCadenaFrio: false,
          temperaturaVehiculo: 3.5,
        }),
      );

      await new Promise((r) => setTimeout(r, 50));
      expect(cadenaFrioAlertService.obtenerAlertas()).toHaveLength(0);
    });

    it('debe advertir sobre posible ruptura de cadena de frío cuando temperatura > 4°C (EARS-LOTE-05)', async () => {
      const spyEmit = jest.spyOn(eventEmitter, 'emit');
      const spyListener = jest.spyOn(listener, 'handleRecepcionCreada');

      const recepcionDto = {
        sucursal_id: sucursalId,
        proveedor: 'Carnes de los Andes',
        numero_factura_remision: 'FAC-7766',
        temperatura_vehiculo: 7.2, // > 4°C: Ruptura en transporte
        items: [
          {
            producto_id: productoId,
            codigo_lote: 'LOT-CRITICO-02',
            cantidad: 30,
            costo_unitario: 18000,
            temperatura_recepcion: 6.5, // > 4°C: Ruptura en producto
            fecha_vencimiento: new Date(Date.now() + 86400000 * 4).toISOString(),
          },
        ],
      };

      const resp = await inventarioService.registrarRecepcion(recepcionDto as any, 'usr-operador-1');

      expect(resp.alerta_cadena_frio).toBe(true);
      expect(resp.mensaje).toContain('se detectó temperatura superior a 4.0°C (ruptura de cadena de frío)');

      expect(spyEmit).toHaveBeenCalledWith(
        RecepcionCreadaEvent.EVENT_NAME,
        expect.objectContaining({
          alertaCadenaFrio: true,
          temperaturaVehiculo: 7.2,
          items: expect.arrayContaining([
            expect.objectContaining({ temperaturaRecepcion: 6.5 }),
          ]),
        }),
      );

      await new Promise((r) => setTimeout(r, 50));

      expect(spyListener).toHaveBeenCalled();
      const alertas = cadenaFrioAlertService.obtenerAlertasPorSucursal(sucursalId);
      expect(alertas).toHaveLength(1);
      expect(alertas[0].temperaturaVehiculo).toBe(7.2);
      expect(alertas[0].itemsCriticos).toHaveLength(1);
      expect(alertas[0].itemsCriticos[0].temperatura).toBe(6.5);
      expect(alertas[0].mensaje).toContain('Alerta de ruptura de cadena de frío');
    });
  });

  describe('4. Desacoplamiento y Robustez del Bus', () => {
    it('debe tolerar emisores sin listeners registrados sin fallar ni bloquear peticiones', async () => {
      expect(() => {
        eventEmitter.emit('evento.inexistente', { test: true });
      }).not.toThrow();
    });

    it('debe registrar y recuperar eventos en cadena frío alert service correctamente', () => {
      cadenaFrioAlertService.limpiar();
      expect(cadenaFrioAlertService.obtenerAlertas()).toHaveLength(0);

      cadenaFrioAlertService.registrarAlerta({
        recepcionId: 'rec-test',
        sucursalId,
        proveedor: 'Proveedor Test',
        itemsCriticos: [],
        mensaje: 'Test alerta',
        timestamp: new Date(),
      });

      expect(cadenaFrioAlertService.obtenerAlertas()).toHaveLength(1);
      expect(cadenaFrioAlertService.obtenerAlertasPorSucursal(sucursalId)).toHaveLength(1);
      expect(cadenaFrioAlertService.obtenerAlertasPorSucursal('suc-otra')).toHaveLength(0);
    });

    it('debe exponer aliases canónicos items, itemsRevertidos y lotes en eventos de dominio', () => {
      const vComp = new VentaCompletadaEvent(
        'v-1',
        sucursalId,
        'dev-1',
        100,
        [{ productoId: 'p-1', cantidad: 2, precioUnitario: 50 }],
        new Date(),
        'efectivo',
        'tenant-1',
      );
      expect(vComp.items).toEqual(vComp.detalles);
      expect(vComp.tenantId).toBe('tenant-1');
      expect(vComp.metodoPago).toBe('efectivo');

      const vAnul = new VentaAnuladaEvent(
        'v-1',
        sucursalId,
        'motivo',
        'u-1',
        [{ productoId: 'p-1', cantidad: 2, precioUnitario: 50 }],
        new Date(),
        'tenant-1',
      );
      expect(vAnul.itemsRevertidos).toEqual(vAnul.detalles);
      expect(vAnul.tenantId).toBe('tenant-1');

      const recCre = new RecepcionCreadaEvent(
        'r-1',
        sucursalId,
        'prov',
        'u-1',
        [{ productoId: 'p-1', codigoLote: 'L1', cantidad: 10, costoUnitario: 20 }],
        false,
        3.0,
        new Date(),
        'tenant-1',
        3.0,
      );
      expect(recCre.lotes).toEqual(recCre.items);
      expect(recCre.tenantId).toBe('tenant-1');
      expect(recCre.temperaturaRecepcion).toBe(3.0);
    });
  });
});

