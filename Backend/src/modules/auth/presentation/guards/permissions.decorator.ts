import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Matriz de permisos canónicos según design.md sec. 14.1
 */
export const POS_PERMISSIONS = {
  // Cajero, Gerente, Administrador
  POS_LOGIN_PIN: 'pos.login_pin',
  VENTAS_REGISTRAR: 'ventas.registrar',
  CAJA_TURNO: 'caja.turno',

  // Gerente, Administrador (Cajero no / requiere PIN Supervisor)
  VENTAS_ANULAR: 'ventas.anular',
  PESAJE_MANUAL: 'pesaje.manual',
  INVENTARIO_MERMA: 'inventario.merma',
  LOTES_RECEPCION: 'lotes.recepcion',

  // Solo Administrador
  CATALOGO_PRECIOS: 'catalogo.precios',
  METRICAS_MULTI_SUCURSAL: 'metricas.multi_sucursal',
  ADMIN_SUCURSALES_USUARIOS: 'admin.sucursales_usuarios',
} as const;

export type PosPermission = (typeof POS_PERMISSIONS)[keyof typeof POS_PERMISSIONS];

/**
 * Decorador para exigir permisos específicos definidos en la matriz RBAC.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorador para marcar una ruta como pública (exenta de AuthGuard).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
