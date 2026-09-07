import { Injectable } from '@nestjs/common';

export interface AlertaCadenaFrioRecord {
  id: string;
  recepcionId: string;
  sucursalId: string;
  proveedor: string;
  temperaturaVehiculo?: number | null;
  itemsCriticos: {
    productoId: string;
    codigoLote: string;
    temperatura: number;
  }[];
  mensaje: string;
  timestamp: Date;
}

@Injectable()
export class CadenaFrioAlertService {
  private alertas: AlertaCadenaFrioRecord[] = [];

  registrarAlerta(alerta: Omit<AlertaCadenaFrioRecord, 'id'>): AlertaCadenaFrioRecord {
    const record: AlertaCadenaFrioRecord = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...alerta,
    };
    this.alertas.push(record);
    return record;
  }

  obtenerAlertas(): AlertaCadenaFrioRecord[] {
    return [...this.alertas];
  }

  obtenerAlertasPorSucursal(sucursalId: string): AlertaCadenaFrioRecord[] {
    return this.alertas.filter((a) => a.sucursalId === sucursalId);
  }

  limpiar(): void {
    this.alertas = [];
  }
}
