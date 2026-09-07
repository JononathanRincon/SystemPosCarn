import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no se requiere ningún rol específico, se concede el acceso
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.rol) {
      throw new UnauthorizedException('Usuario no autenticado o sin rol asignado');
    }

    const hasRole = requiredRoles.some((role) => this.matchRole(user.rol, role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado: el rol '${user.rol}' no tiene permisos suficientes para este recurso`,
      );
    }

    return true;
  }

  private matchRole(userRole: string, requiredRole: string): boolean {
    const normalize = (r: string) => r.toLowerCase().trim();
    const normUser = normalize(userRole);
    const normReq = normalize(requiredRole);

    if (normUser === normReq) return true;

    // Equivalencias comunes de roles en el sistema POS
    if (
      (normReq === 'administrador' || normReq === 'dueño' || normReq === 'admin') &&
      (normUser === 'administrador' || normUser === 'dueño' || normUser === 'admin')
    ) {
      return true;
    }

    if (
      (normReq === 'gerente sucursal' || normReq === 'gerente') &&
      (normUser === 'gerente sucursal' || normUser === 'gerente')
    ) {
      return true;
    }

    // Administrador / Dueño tiene superusuario (acceso a roles inferiores si no se excluye)
    if (normUser === 'administrador' || normUser === 'dueño') {
      return true;
    }

    return false;
  }
}
