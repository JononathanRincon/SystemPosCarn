import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../../application/services/token.service';
import { IS_PUBLIC_KEY } from './permissions.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector = new Reflector(),
    @Optional()
    private readonly tokenService: TokenService = new TokenService(),
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Verificar si la ruta está decorada con @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Extraer cabecera Authorization
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Token de autenticación no proporcionado');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Formato de autorización inválido. Debe ser Bearer <token>');
    }

    // 3. Validar token
    try {
      const payload = await this.tokenService.verifyToken(token);
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }
  }
}
