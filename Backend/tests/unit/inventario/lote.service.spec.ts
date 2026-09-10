import { Lote } from '../../../src/modules/inventory/domain/entities/lote.entity';

describe('LoteService / Lote Entity (Unitario)', () => {
  const baseLoteProps = {
    id: 'lote-uuid-1',
    productoId: 'prod-uuid-1',
    sucursalId: 'sucursal-uuid-1',
    codigoLote: 'L-2026-001',
    proveedor: 'Frigorífico Guadalupe',
    cantidadRecibida: 50.125,
    cantidadDisponible: 50.125,
    costoUnitario: 32000,
    temperaturaRecepcion: 2.5,
  };

  it('debe mantener la precisión estricta a 3 decimales en kilogramos (0.001 kg)', () => {
    const lote = new Lote({
      ...baseLoteProps,
      cantidadRecibida: 25.4567, // debe redondearse a 25.457
      cantidadDisponible: 25.4567,
    });

    expect(lote.cantidadRecibida).toBe(25.457);
    expect(lote.cantidadDisponible).toBe(25.457);
  });

  it('debe detectar correctamente si el lote está próximo a vencer en 3 días o menos (EARS-LOTE-03)', () => {
    const hoy = new Date('2026-09-10T10:00:00Z');
    const vencimientoEn2Dias = new Date('2026-09-12T10:00:00Z');
    const vencimientoEn10Dias = new Date('2026-09-20T10:00:00Z');

    const loteProximo = new Lote({
      ...baseLoteProps,
      fechaVencimiento: vencimientoEn2Dias,
    });

    const loteLejano = new Lote({
      ...baseLoteProps,
      fechaVencimiento: vencimientoEn10Dias,
    });

    expect(loteProximo.esProximoAVencer(3, hoy)).toBe(true);
    expect(loteLejano.esProximoAVencer(3, hoy)).toBe(false);
  });

  it('debe descontar cantidad y cambiar automáticamente a estado agotado al llegar a 0.000 kg (EARS-LOTE-04)', () => {
    const lote = new Lote({
      ...baseLoteProps,
      cantidadRecibida: 10.0,
      cantidadDisponible: 10.0,
    });

    expect(lote.estado).toBe('activo');

    // Descuenta parcialmente
    const descontadoParcial = lote.descontar(4.5);
    expect(descontadoParcial).toBe(4.5);
    expect(lote.cantidadDisponible).toBe(5.5);
    expect(lote.estado).toBe('activo');

    // Descuenta el restante exacto
    const descontadoFinal = lote.descontar(5.5);
    expect(descontadoFinal).toBe(5.5);
    expect(lote.cantidadDisponible).toBe(0.0);
    expect(lote.estado).toBe('agotado');
    expect(lote.estaAgotado()).toBe(true);
  });

  it('debe detectar ruptura de cadena de frío si la temperatura supera 4.0°C (EARS-LOTE-05)', () => {
    const loteFrio = new Lote({
      ...baseLoteProps,
      temperaturaRecepcion: 2.0,
    });

    const loteTibio = new Lote({
      ...baseLoteProps,
      temperaturaRecepcion: 6.5,
    });

    expect(loteFrio.tieneRupturaCadenaFrio()).toBe(false);
    expect(loteTibio.tieneRupturaCadenaFrio()).toBe(true);
  });
});
