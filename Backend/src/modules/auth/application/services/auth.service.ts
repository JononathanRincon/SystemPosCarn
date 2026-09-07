import {
  Injectable,
  Inject,
  Optional,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { HashingService } from './hashing.service';
import { TokenService } from './token.service';
import { Usuario } from '../../domain/entities/usuario.entity';
import {
  UsuarioRepositoryPort,
  USUARIO_REPOSITORY_PORT,
} from '../../domain/ports/usuario-repository.port';
import {
  LoginDto,
  LoginResponseDto,
  RefreshResponseDto,
  AuthTokensDto,
} from '../dtos/auth.dto';

export interface LoginResult {
  usuario: ReturnType<Usuario['toResponseDto']>;
  tokens?: AuthTokensDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly hashingService: HashingService = new HashingService(),
    private readonly tokenService: TokenService = new TokenService(),
    @Optional()
    @Inject(USUARIO_REPOSITORY_PORT)
    private readonly usuarioRepository?: UsuarioRepositoryPort,
  ) {}

  /**
   * Hashea una contraseña con bcrypt y factor de costo mínimo 10 (EARS-AUTH-01).
   */
  async hashPassword(password: string): Promise<string> {
    return this.hashingService.hashPassword(password);
  }

  /**
   * Compara una contraseña en texto plano contra su hash bcrypt.
   */
  async validatePassword(plainPassword: string, hash: string): Promise<boolean> {
    return this.hashingService.comparePassword(plainPassword, hash);
  }

  /**
   * Hashea un PIN POS de 4 dígitos numéricos (US-01, EARS-AUTH-01).
   */
  async hashPinPos(pin: string): Promise<string> {
    return this.hashingService.hashPin(pin);
  }

  /**
   * Compara un PIN POS en texto plano contra su hash bcrypt.
   */
  async validatePinPos(plainPin: string, hash: string): Promise<boolean> {
    return this.hashingService.comparePin(plainPin, hash);
  }

  /**
   * Endpoint de Login Web (EARS-AUTH-02, design.md sec. 7.1 endpoint 1):
   * Genera Access Token (15 min) y Refresh Token (7 días) ante credenciales válidas.
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    if (!this.usuarioRepository) {
      throw new Error('UsuarioRepositoryPort no configurado');
    }

    const usuario = await this.usuarioRepository.findByEmail(loginDto.email);
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!usuario.activo) {
      throw new UnauthorizedException('El usuario se encuentra inactivo');
    }

    const isPasswordValid = await usuario.validatePassword(loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.tokenService.generateTokenPair({
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      negocioId: usuario.negocioId,
      sucursalId: usuario.sucursalId,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: usuario.id,
        nombre: usuario.nombreCompleto,
        rol: usuario.rol,
        negocioId: usuario.negocioId,
        sucursalId: usuario.sucursalId,
      },
    };
  }

  /**
   * Endpoint de Refresh de Tokens (EARS-AUTH-02, design.md sec. 7.1 endpoint 2):
   * Aplica rotación segura de refresh token e invalida el token previo.
   */
  async refresh(refreshToken: string): Promise<RefreshResponseDto> {
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new UnauthorizedException('Refresh token requerido');
    }

    const tokens = await this.tokenService.rotateRefreshToken(refreshToken);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Valida credenciales de un usuario ya cargado (método de dominio / pruebas).
   */
  async authenticateUser(usuario: Usuario, plainPassword: string): Promise<LoginResult> {
    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!usuario.activo) {
      throw new UnauthorizedException('El usuario se encuentra inactivo');
    }

    const isPasswordValid = await usuario.validatePassword(plainPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.tokenService.generateTokenPair({
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      negocioId: usuario.negocioId,
      sucursalId: usuario.sucursalId,
    });

    return {
      usuario: usuario.toResponseDto(),
      tokens,
    };
  }

  /**
   * Valida inicio de sesión rápido por PIN de 4 dígitos (POS Mostrador Offline-First).
   */
  async authenticatePin(usuario: Usuario, plainPin: string): Promise<LoginResult> {
    if (!this.hashingService.isValidPinFormat(plainPin)) {
      throw new BadRequestException('El PIN debe tener exactamente 4 dígitos numéricos');
    }

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!usuario.activo) {
      throw new UnauthorizedException('El usuario se encuentra inactivo');
    }

    const isPinValid = await usuario.validatePin(plainPin);
    if (!isPinValid) {
      throw new UnauthorizedException('PIN inválido');
    }

    return {
      usuario: usuario.toResponseDto(),
    };
  }

  /**
   * Delegación de renovación de tokens por TokenService.
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokensDto> {
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    return this.tokenService.rotateRefreshToken(refreshToken);
  }

  /**
   * Expone el servicio de tokens para consultas de cookies y verificación.
   */
  getTokenService(): TokenService {
    return this.tokenService;
  }
}
