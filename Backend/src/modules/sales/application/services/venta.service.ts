import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Venta } from '../../domain/entities/venta.entity';
import { DetalleVenta } from '../../domain/entities/detalle-venta.entity';
import { PagoVenta } from '../../domain/entities/pago-venta.entity';
import { VentaCompletadaEvent } from '../../domain/events/venta-completada.event';
import {
  IVentaRepository,
  VENTA_REPOSITORY,
} from '../../domain/ports/venta-repository.port';
import {
  CreateVentaDto,
  VoidVentaDto,
  VentaResponseDto,
} from '../dtos/venta.dto';
import { CorteCajaService } from '../../../cash/application/services/corte-caja.service';
import { ISalesCashQueryProvider } from '../../../cash/application/services/corte-caja.service';

export interface IDomainEventEmitter {
  emit(event: string, payload: any): void;
}

export const DOMAIN_EVENT_EMITTER = Symbol('DOMAIN_EVENT_EMITTER');

@Injectable()
export class VentaService implements ISalesCashQueryProvider {
  private ventasEnMemoria: Map<string, Venta> = new Map();

  constructor(
    @Optional()
    @Inject(VENTA_REPOSITORY)
    private readonly ventaRepo?: IVentaRepository,
    @Optional()
    private readonly corteCajaService?: CorteCajaService,
    @Optional()
    @Inject(DOMAIN_EVENT_EMITTER)
    private readonly eventEmitter?: IDomainEventEmitter,
  ) {}

  /**
   * EARS-VENTA-01, EARS-VENTA-03, EARS-VENTA-04, EARS-CAJA-03, EARS-CAJA-04, US-04:
   * Registra una venta atómicamente con snapshot inmutable de precios y pagos mixtos.
   */
  async crearVenta(dto: CreateVentaDto): Promise<VentaResponseDto> {
    // 1. Idempotencia: si la venta con este ID ya existe, retornar la existente sin duplicar
    const ventaExistente = await this.buscarVentaPorId(dto.id);
    if (ventaExistente) {
      return this.mapToResponse(ventaExistente);
    }

    // 2. Verificación de turno de caja (EARS-CAJA-03, EARS-CAJA-04):
    // La venta en vivo se bloquea si la terminal no tiene un turno abierto activo.
    // Las ventas offline (esOffline === true o sincronizada === false) ya se realizaron físicamente y no se bloquean en sincronización.
    if (this.corteCajaService && !dto.esOffline && dto.sincronizada !== false) {
      const cajaAbierta = await this.corteCajaService.verificarCajaAbierta(dto.dispositivoId);
      if (!cajaAbierta) {
        throw new BadRequestException(
          `La terminal ${dto.dispositivoId} no cuenta con un turno de caja abierto. Debe realizar apertura con base inicial antes de vender.`,
        );
      }
    }

    // 3. Validación de items de detalle
    if (!dto.detalles || dto.detalles.length === 0) {
      throw new BadRequestException('La venta debe contener al menos un detalle de producto.');
    }

    // 4. Congelación de Snapshot Inmutable de Precios y cálculo de subtotales
    let subtotalCalculado = 0;
    const detallesEntidad: DetalleVenta[] = [];

    for (const d of dto.detalles) {
      if (d.cantidad <= 0) {
        throw new BadRequestException(`La cantidad para el producto ${d.productoId} debe ser mayor a 0.`);
      }
      if (d.precioUnitario < 0) {
        throw new BadRequestException(`El precio unitario para el producto ${d.productoId} no puede ser negativo.`);
      }

      // Snapshot inmutable: subtotal_linea = round(cantidad * precio_unitario, 2)
      const subtotalLinea = Math.round(Number(d.cantidad) * Number(d.precioUnitario) * 100) / 100;
      subtotalCalculado += subtotalLinea;

      detallesEntidad.push(
        new DetalleVenta({
          ventaId: dto.id,
          productoId: d.productoId,
          cantidad: d.cantidad,
          precioUnitario: d.precioUnitario, // Snapshot inmutable
          subtotalLinea,
          pesoBruto: d.pesoBruto,
          pesoNeto: d.pesoNeto,
        }),
      );
    }

    subtotalCalculado = Math.round(subtotalCalculado * 100) / 100;
    const descuento = Math.round((Number(dto.descuento) || 0) * 100) / 100;
    const totalCalculado = Math.max(0, Math.round((subtotalCalculado - descuento) * 100) / 100);

    // 5. Validación de pagos mixtos y totales (EARS-VENTA-04, US-04)
    if (!dto.pagos || dto.pagos.length === 0) {
      throw new BadRequestException('La venta debe especificar al menos una forma de pago.');
    }

    let sumaPagos = 0;
    const pagosEntidad: PagoVenta[] = [];

    for (const p of dto.pagos) {
      if (p.monto <= 0) {
        throw new BadRequestException('El monto de cada pago debe ser mayor a 0.');
      }
      const montoRedondeado = Math.round(Number(p.monto) * 100) / 100;
      sumaPagos += montoRedondeado;

      pagosEntidad.push(
        new PagoVenta({
          ventaId: dto.id,
          metodo: p.metodo,
          monto: montoRedondeado,
          referenciaTransaccion: p.referenciaTransaccion,
        }),
      );
    }

    sumaPagos = Math.round(sumaPagos * 100) / 100;

    // EARS-VENTA-04: Si el monto acumulado en métodos de pago es menor que el total de la venta,
    // el sistema impedirá la confirmación del ticket y mostrará el saldo faltante.
    if (sumaPagos < totalCalculado) {
      const saldoFaltante = Math.round((totalCalculado - sumaPagos) * 100) / 100;
      throw new BadRequestException(
        `El monto pagado ($${sumaPagos.toFixed(2)}) es insuficiente para cubrir el total ($${totalCalculado.toFixed(2)}). Saldo faltante: $${saldoFaltante.toFixed(2)}.`,
      );
    }

    // 6. Instanciación del aggregate root Venta
    const nuevaVenta = new Venta({
      id: dto.id,
      sucursalId: dto.sucursalId,
      dispositivoId: dto.dispositivoId,
      cajeroId: dto.cajeroId,
      clienteId: dto.clienteId,
      subtotal: subtotalCalculado,
      descuento,
      total: totalCalculado,
      metodoPago: dto.metodoPago,
      estado: 'completada',
      fechaHoraDispositivo: new Date(dto.fechaHoraDispositivo),
      fechaHoraServidor: new Date(),
      sincronizada: dto.esOffline ? true : (dto.sincronizada !== undefined ? dto.sincronizada : true),
      detalles: detallesEntidad,
      pagos: pagosEntidad,
    });

    // 7. Persistencia Transaccional ACID
    if (this.ventaRepo) {
      await this.ventaRepo.guardarTransaccional(nuevaVenta);
    } else {
      this.ventasEnMemoria.set(nuevaVenta.id, nuevaVenta);
    }

    // 8. Emisión de Evento de Dominio VentaCompletadaEvent para desacoplamiento (DDD)
    const evento = new VentaCompletadaEvent(
      nuevaVenta.id,
      nuevaVenta.sucursalId,
      nuevaVenta.dispositivoId,
      nuevaVenta.total,
      nuevaVenta.detalles.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        pesoNeto: d.pesoNeto,
      })),
      nuevaVenta.fechaHoraServidor,
    );

    if (this.eventEmitter) {
      this.eventEmitter.emit(VentaCompletadaEvent.EVENT_NAME, evento);
    }

    return this.mapToResponse(nuevaVenta);
  }

  /**
   * Anulación de venta (POST /sales/:id/void)
   * Marca el estado de la venta como 'anulada' sin eliminarla de base de datos.
   */
  async anularVenta(id: string, dto: VoidVentaDto): Promise<VentaResponseDto> {
    const venta = await this.buscarVentaPorId(id);
    if (!venta) {
      throw new NotFoundException(`La venta con ID ${id} no fue encontrada.`);
    }

    venta.anular();

    if (this.ventaRepo) {
      await this.ventaRepo.actualizar(venta);
    } else {
      this.ventasEnMemoria.set(venta.id, venta);
    }

    return this.mapToResponse(venta);
  }

  /**
   * Consulta de venta por ID
   */
  async buscarVentaPorId(id: string): Promise<Venta | null> {
    if (this.ventaRepo) {
      return this.ventaRepo.buscarPorId(id);
    }
    return this.ventasEnMemoria.get(id) || null;
  }

  /**
   * Implementación de ISalesCashQueryProvider para integración de turnos de caja
   */
  async obtenerTotalVentasEfectivo(dispositivoId: string, desde: Date, hasta?: Date): Promise<number> {
    const ventas = await this.obtenerVentasPorDispositivoYRango(dispositivoId, desde, hasta);
    let totalEfectivo = 0;

    for (const v of ventas) {
      if (v.estado === 'completada') {
        for (const p of v.pagos) {
          if (p.metodo.toLowerCase() === 'efectivo') {
            totalEfectivo += p.monto;
          }
        }
      }
    }

    return Math.round(totalEfectivo * 100) / 100;
  }

  async obtenerTotalesPorMetodo(
    dispositivoId: string,
    desde: Date,
    hasta?: Date,
  ): Promise<Record<string, number>> {
    const ventas = await this.obtenerVentasPorDispositivoYRango(dispositivoId, desde, hasta);
    const desglose: Record<string, number> = {};

    for (const v of ventas) {
      if (v.estado === 'completada') {
        for (const p of v.pagos) {
          const m = p.metodo.toLowerCase();
          desglose[m] = Math.round(((desglose[m] || 0) + p.monto) * 100) / 100;
        }
      }
    }

    return desglose;
  }

  private async obtenerVentasPorDispositivoYRango(
    dispositivoId: string,
    desde: Date,
    hasta?: Date,
  ): Promise<Venta[]> {
    if (this.ventaRepo) {
      return this.ventaRepo.buscarPorDispositivoYRango(dispositivoId, desde, hasta);
    }

    return Array.from(this.ventasEnMemoria.values()).filter((v) => {
      if (v.dispositivoId !== dispositivoId) return false;
      const t = v.fechaHoraDispositivo.getTime();
      if (t < desde.getTime()) return false;
      if (hasta && t > hasta.getTime()) return false;
      return true;
    });
  }

  private mapToResponse(venta: Venta): VentaResponseDto {
    return {
      id: venta.id,
      sucursalId: venta.sucursalId,
      dispositivoId: venta.dispositivoId,
      cajeroId: venta.cajeroId,
      clienteId: venta.clienteId,
      subtotal: venta.subtotal,
      descuento: venta.descuento,
      total: venta.total,
      metodoPago: venta.metodoPago,
      estado: venta.estado,
      fechaHoraDispositivo: venta.fechaHoraDispositivo,
      fechaHoraServidor: venta.fechaHoraServidor,
      sincronizada: venta.sincronizada,
      detalles: venta.detalles.map((d) => ({
        productoId: d.productoId,
        cantidad: d.cantidad,
        precioUnitario: d.precioUnitario,
        subtotalLinea: d.subtotalLinea,
        pesoBruto: d.pesoBruto,
        pesoNeto: d.pesoNeto,
      })),
      pagos: venta.pagos.map((p) => ({
        metodo: p.metodo,
        monto: p.monto,
        referenciaTransaccion: p.referenciaTransaccion,
      })),
    };
  }
}
