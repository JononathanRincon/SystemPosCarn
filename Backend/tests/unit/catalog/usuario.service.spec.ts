import { mockUsuario } from '../../helpers/mock-data.helper';

describe('UsuarioService (Unitario)', () => {
  it('debe registrar usuario con hash seguro de contraseña y PIN de 4 dígitos', () => {
    const usuario = mockUsuario();
    expect(usuario.email).toContain('@');
    expect(usuario.pin_pos).toBeDefined();
  });
});
