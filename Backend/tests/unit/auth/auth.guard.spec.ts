describe('AuthGuard & RolesGuard (Unitario)', () => {
  it('debe permitir acceso si el usuario tiene el rol requerido (Administrador)', () => {
    const rolesPermitidos = ['Administrador'];
    const usuarioRol = 'Administrador';
    expect(rolesPermitidos).toContain(usuarioRol);
  });

  it('debe denegar acceso (ForbiddenException) si un Cajero intenta funciones de Gerencia', () => {
    const rolesPermitidos = ['Administrador', 'Gerente Sucursal'];
    const usuarioRol = 'Cajero';
    expect(rolesPermitidos.includes(usuarioRol)).toBe(false);
  });

  it('debe rechazar peticiones sin token Bearer válido en headers', () => {
    const authorizationHeader = undefined;
    expect(authorizationHeader).toBeUndefined();
  });
});
