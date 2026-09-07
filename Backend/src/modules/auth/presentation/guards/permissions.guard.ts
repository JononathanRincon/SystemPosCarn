import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, POS_PERMISSIONS } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  // Matriz RBAC oficial según design.md sec. 14.1
  private static readonly ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
    cajero: [
      POS_PERMISSIONS.POS_LOGIN_PIN,
      POS_PERMISSIONS.VENTAS_REGISTRAR,
      POS_PERMISSIONS.CAJA_TURNO,
    ],
    'gerente sucursal': [
      POS_PERMISSIONS.POS_LOGIN_PIN,
      POS_PERMISSIONS.VENTAS_REGISTRAR,
      POS_PERMISSIONS.CAJA_TURNO,
      POS_PERMISSIONS.VENTAS_ANULAR,
      POS_PERMISSIONS.PESAJE_MANUAL,
      POS_PERMISSIONS.INVENTARIO_MERMA,
      POS_PERMISSIONS.LOTES_RECEPCION,
    ],
    gerente: [
      POS_PERMISSIONS.POS_LOGIN_PIN,
      POS_PERMISSIONS.VENTAS_REGISTRAR,
      POS_PERMISSIONS.CAJA_TURNO,
      POS_PERMISSIONS.VENTAS_ANULAR,
      POS_PERMISSIONS.PESAJE_MANUAL,
      POS_PERMISSIONS.INVENTARIO_MERMA,
      POS_PERMISSIONS.LOTES_RECEPCION,
    ],
    administrador: Object.values(POS_PERMISSIONS),
    dueño: Object.values(POS_PERMISSIONS),
    admin: Object.values(POS_PERMISSIONS),
  };

  constructor(private readonly reflector: Reflector = new Reflector()) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no se requiere ningún permiso específico, conceder acceso
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.rol) {
      throw new UnauthorizedException('Usuario no autenticado o sin rol asignado');
    }

    const normalizedRole = user.rol.toLowerCase().trim();
    const userPermissions = PermissionsGuard.ROLE_PERMISSIONS_MAP[normalizedRole] || [];

    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Acceso denegado: el rol '${user.rol}' carece de los permisos requeridos para esta operación`,
      );
    }

    return true;
  }

  /**
   * Helper estático para consultar los permisos asignados a un rol.
   */
  static getPermissionsForRole(role: string): string[] {
    const normalizedRole = role.toLowerCase().trim();
    return PermissionsGuard.ROLE_PERMISSIONS_MAP[normalizedRole] || [];
  }
}
