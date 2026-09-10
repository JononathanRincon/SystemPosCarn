import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard';
import { Roles } from '../../../auth/presentation/guards/roles.decorator';
import { TenantInterceptor } from '../interceptors/tenant.interceptor';

export interface DeviceResponseDto {
  id: string;
  nombreAlias: string;
  sucursalId: string;
  modelo: string;
  sistemaOperativo: string;
  ultimoLatido: string;
  activo: boolean;
  ventasPendientesSync?: number;
  cajeroTurnoActivo?: string | null;
}

@Controller('devices')
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(TenantInterceptor)
export class DevicesController {
  // Catálogo operativo de dispositivos para auditoría multi-terminal (SDD sec. 6.4)
  private devices: Map<string, DeviceResponseDto> = new Map([
    [
      'caja-mostrador-01',
      {
        id: 'caja-mostrador-01',
        nombreAlias: 'Tablet Mostrador 01',
        sucursalId: 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
        modelo: 'Samsung Galaxy Tab A8',
        sistemaOperativo: 'Android 13',
        ultimoLatido: new Date().toISOString(),
        activo: true,
        ventasPendientesSync: 0,
        cajeroTurnoActivo: 'Carlos Cajero',
      },
    ],
    [
      'caja-mostrador-02',
      {
        id: 'caja-mostrador-02',
        nombreAlias: 'Tablet Mostrador 02',
        sucursalId: 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
        modelo: 'iPad 10.2"',
        sistemaOperativo: 'iPadOS 16',
        ultimoLatido: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        activo: true,
        ventasPendientesSync: 3,
        cajeroTurnoActivo: 'María Auxiliar',
      },
    ],
    [
      'pc-caja-central',
      {
        id: 'pc-caja-central',
        nombreAlias: 'PC Mostrador Principal',
        sucursalId: 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab',
        modelo: 'PC All-in-One Touch',
        sistemaOperativo: 'Windows 11 POS',
        ultimoLatido: new Date().toISOString(),
        activo: true,
        ventasPendientesSync: 0,
        cajeroTurnoActivo: 'Admin Sede',
      },
    ],
  ]);

  @Get()
  async findAll(): Promise<DeviceResponseDto[]> {
    return Array.from(this.devices.values());
  }

  @Patch(':id/revoke')
  @Roles('Administrador', 'Dueño', 'Gerente')
  async revoke(@Param('id') id: string): Promise<DeviceResponseDto> {
    const dev = this.devices.get(id);
    if (!dev) {
      throw new NotFoundException(`Dispositivo con ID ${id} no encontrado`);
    }
    dev.activo = false;
    this.devices.set(id, dev);
    return dev;
  }
}
