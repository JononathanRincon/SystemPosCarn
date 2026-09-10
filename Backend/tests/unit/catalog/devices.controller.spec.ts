import { DevicesController } from '../../../src/modules/catalog/presentation/http/devices.controller';
import { NotFoundException } from '@nestjs/common';

describe('DevicesController (Unitario)', () => {
  let controller: DevicesController;

  beforeEach(() => {
    controller = new DevicesController();
  });

  it('debe listar todas las terminales registradas con su estado y auditoría', async () => {
    const devices = await controller.findAll();

    expect(devices).toBeDefined();
    expect(devices.length).toBeGreaterThanOrEqual(3);
    const tablet = devices.find((d) => d.id === 'caja-mostrador-01');
    expect(tablet).toBeDefined();
    expect(tablet?.nombreAlias).toBe('Tablet Mostrador 01');
    expect(tablet?.activo).toBe(true);
    expect(tablet?.cajeroTurnoActivo).toBe('Carlos Cajero');
  });

  it('debe revocar el acceso a una terminal marcando activo = false', async () => {
    const revocado = await controller.revoke('caja-mostrador-02');

    expect(revocado.id).toBe('caja-mostrador-02');
    expect(revocado.activo).toBe(false);

    const devices = await controller.findAll();
    const actualizado = devices.find((d) => d.id === 'caja-mostrador-02');
    expect(actualizado?.activo).toBe(false);
  });

  it('debe lanzar NotFoundException si se intenta revocar una terminal inexistente', async () => {
    await expect(controller.revoke('dispositivo-fantasma')).rejects.toThrow(
      NotFoundException,
    );
  });
});
