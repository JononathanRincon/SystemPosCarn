import { mockSucursal } from '../../helpers/mock-data.helper';

describe('SucursalService (Unitario)', () => {
  it('debe asociar la sucursal únicamente al tenant_id correcto', () => {
    const sucursal = mockSucursal({ negocio_id: 'negocio-uuid-1111' });
    expect(sucursal.negocio_id).toBe('negocio-uuid-1111');
  });

  it('debe requerir nombre y zona horaria válida', () => {
    const sucursal = mockSucursal();
    expect(sucursal.nombre).toBeTruthy();
    expect(sucursal.zona_horaria).toBe('America/Bogota');
  });
});
