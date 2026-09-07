import {
  Injectable,
  Inject,
  Optional,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HashingService } from './hashing.service';
import { TokenService } from './token.service';
import { PinThrottlerService } from './pin-throttler.service';
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
  PinLoginDto,
  PinLoginResponseDto,
} from '../dtos/auth.dto';

export interface LoginResult {
  usuario: ReturnType<Usuario['toResponseDto']>;
  tokens?: AuthTokensDto;
}

@Injectable()
export class AuthService {
  private readonly pinThrottlerService: PinThrottlerService;
  private readonly usuarioRepository?: UsuarioRepositoryPort;

  constructor(
    private readonly hashingService: HashingService = new HashingService(),
    private readonly tokenService: TokenService = new TokenService(),
    @Optional()
    pinThrottlerOrRepo?: PinThrottlerService | UsuarioRepositoryPort,
    @Optional()
    @Inject(USUARIO_REPOSITORY_PORT)
    usuarioRepository?: UsuarioRepositoryPort,
  ) {
    if (pinThrottlerOrRepo && 'checkLockout' in pinThrottlerOrRepo) {
      this.pinThrottlerService = pinThrottlerOrRepo as PinThrottlerService;
      this.usuarioRepository = usuarioRepository;
    } else if (
      pinThrottlerOrRepo &&
      ('findById' in pinThrottlerOrRepo || 'findByEmail' in pinThrottlerOrRepo)
    ) {
      this.pinThrottlerService = new PinThrottlerService();
      this.usuarioRepository = pinThrottlerOrRepo as UsuarioRepositoryPort;
    } else {
      this.pinThrottlerService = (pinThrottlerOrRepo as PinThrottlerService) || new PinThrottlerService();
      this.usuarioRepository = usuarioRepository;
    }
  }

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

  /**
   * Expone el servicio de limitación de intentos de PIN.
   */
  getPinThrottlerService(): PinThrottlerService {
    return this.pinThrottlerService;
  }

  /**
   * Endpoint de Validación Local de PIN POS y Bloqueo por Intentos Fallidos
   * (EARS-AUTH-03, EARS-AUTH-04, design.md sec. 7.1 endpoint 3):
   * - Valida PIN POS de exactamente 4 dígitos contra los usuarios asignados a la sucursal.
   * - Bloquea el acceso durante 60 segundos si se superan 3 intentos erróneos consecutivos (HTTP 429 Too Many Requests).
   * - Retorna { valid: true, user: { id, nombre, rol }, sessionToken }.
   */
  async pinLogin(dto: PinLoginDto): Promise<PinLoginResponseDto> {
    if (!dto.pin || !Usuario.isValidPinFormat(dto.pin)) {
      throw new BadRequestException('El PIN debe tener exactamente 4 dígitos numéricos');
    }

    const throttleKey = `${dto.sucursalId}:${dto.dispositivoId}`;

    // 1. Validar si el dispositivo se encuentra actualmente bloqueado por fuerza bruta
    this.pinThrottlerService.checkLockout(throttleKey);

    if (!this.usuarioRepository) {
      throw new Error('UsuarioRepositoryPort no configurado');
    }

    let matchingUser: Usuario | null = null;

    if (dto.userId) {
      const user = await this.usuarioRepository.findById(dto.userId);
      if (user && user.activo && user.sucursalId === dto.sucursalId) {
        const isValid = await user.validatePin(dto.pin);
        if (isValid) {
          matchingUser = user;
        }
      }
    } else {
      if (this.usuarioRepository.findBySucursalAndPin) {
        matchingUser = await this.usuarioRepository.findBySucursalAndPin(dto.sucursalId, dto.pin);
      } else if (this.usuarioRepository.findBySucursal) {
        const users = await this.usuarioRepository.findBySucursal(dto.sucursalId);
        for (const user of users) {
          if (user.activo && (await user.validatePin(dto.pin))) {
            matchingUser = user;
            break;
          }
        }
      }
    }

    if (!matchingUser) {
      // Registrar intento fallido
      const attemptResult = this.pinThrottlerService.recordFailedAttempt(throttleKey);
      if (attemptResult.isBlocked) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message: `Demasiados intentos fallidos. Acceso bloqueado durante ${attemptResult.remainingSeconds} segundos.`,
            remainingSeconds: attemptResult.remainingSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException('PIN o credenciales inválidas');
    }

    // Éxito: restablecer intentos fallidos para el dispositivo
    this.pinThrottlerService.resetAttempts(throttleKey);

    // Emitir session token para la terminal POS (TTL 12h)
    const sessionToken = await this.tokenService.generateSessionToken({
      sub: matchingUser.id,
      email: matchingUser.email,
      rol: matchingUser.rol,
      negocioId: matchingUser.negocioId,
      sucursalId: matchingUser.sucursalId,
      dispositivoId: dto.dispositivoId,
    });

    return {
      valid: true,
      user: {
        id: matchingUser.id,
        nombre: matchingUser.nombreCompleto,
        rol: matchingUser.rol,
      },
      sessionToken,
    };
  }
}

