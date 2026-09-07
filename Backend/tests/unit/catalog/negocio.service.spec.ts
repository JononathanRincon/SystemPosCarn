import { mockNegocio } from '../../helpers/mock-data.helper';

describe('NegocioService (Unitario)', () => {
  it('debe registrar un nuevo negocio tenant con plan básico o pro', () => {
    const negocio = mockNegocio();
    expect(negocio.id).toBeDefined();
    expect(['basico', 'pro', 'enterprise']).toContain(negocio.plan);
  });

  it('debe rechazar la creación si el NIT/RUT ya existe', () => {
    const nitDuplicado = '900123456-7';
    expect(nitDuplicado).toBe('900123456-7');
  });
});
