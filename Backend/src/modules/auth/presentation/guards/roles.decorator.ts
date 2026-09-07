import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export enum UserRole {
  ADMINISTRADOR = 'Administrador',
  GERENTE_SUCURSAL = 'Gerente Sucursal',
  GERENTE = 'Gerente',
  CAJERO = 'Cajero',
}

/**
 * Decorador para restringir el acceso a uno o varios roles específicos (RBAC - design.md sec. 14.1).
 * @example @Roles('Administrador', 'Gerente Sucursal')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
