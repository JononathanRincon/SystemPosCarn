import { RecepcionMercancia } from '../../../src/modules/inventory/domain/entities/recepcion-mercancia.entity';

describe('RecepcionService / RecepcionMercancia Entity (Unitario)', () => {
  const baseRecepcionProps = {
    id: 'rec-uuid-1',
    sucursalId: 'suc-uuid-1',
    proveedor: 'Ganadería La Pradera S.A.S.',
    usuarioId: 'usr-gerente-1',
    numeroFacturaRemision: 'REM-2026-981',
    temperaturaVehiculo: 2.8,
  };

  it('debe registrar la recepción con temperatura adecuada dentro de rango seguro (-2°C a +4°C)', () => {
    const recepcion = new RecepcionMercancia({
      ...baseRecepcionProps,
      temperaturaVehiculo: 1.5,
    });

    expect(recepcion.id).toBe('rec-uuid-1');
    expect(recepcion.proveedor).toBe('Ganadería La Pradera S.A.S.');
    expect(recepcion.temperaturaVehiculo).toBe(1.5);
    expect(recepcion.tieneAlertaCadenaFrio()).toBe(false);
  });

  it('debe alertar ruptura de cadena de frío si la temperatura del vehículo supera 4.0°C (EARS-LOTE-05)', () => {
    const recepcionCaliente = new RecepcionMercancia({
      ...baseRecepcionProps,
      temperaturaVehiculo: 8.2,
    });

    expect(recepcionCaliente.temperaturaVehiculo).toBe(8.2);
    expect(recepcionCaliente.tieneAlertaCadenaFrio()).toBe(true);

    const dto = recepcionCaliente.toResponseDto();
    expect(dto.alertaTemperaturaVehiculo).toBe(true);
  });

  it('debe permitir agregar múltiples lotes de productos con precisión y validaciones de costo y cantidad', () => {
    const recepcion = new RecepcionMercancia(baseRecepcionProps);

    recepcion.agregarItem({
      productoId: 'prod-lomo-1',
      codigoLote: 'L-LOMO-01',
      cantidadRecibida: 45.6789, // debe redondearse a 45.679
      costoUnitario: 35000.555, // debe redondearse a 35000.56
      temperaturaRecepcion: 3.1,
    });

    recepcion.agregarItem({
      productoId: 'prod-costilla-2',
      codigoLote: 'L-COSTILLA-02',
      cantidadRecibida: 80.0,
      costoUnitario: 22000.0,
      temperaturaRecepcion: 2.0,
    });

    expect(recepcion.items).toHaveLength(2);
    expect(recepcion.items[0].cantidadRecibida).toBe(45.679);
    expect(recepcion.items[0].costoUnitario).toBe(35000.56);
    expect(recepcion.toResponseDto().itemsCount).toBe(2);
  });

  it('debe rechazar items con cantidad menor o igual a cero', () => {
    const recepcion = new RecepcionMercancia(baseRecepcionProps);

    expect(() => {
      recepcion.agregarItem({
        productoId: 'prod-1',
        codigoLote: 'L-ERR-1',
        cantidadRecibida: 0,
        costoUnitario: 10000,
      });
    }).toThrow('La cantidad recibida debe ser mayor a cero');
  });
});
