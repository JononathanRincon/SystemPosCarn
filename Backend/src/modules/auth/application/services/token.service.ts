import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenPayload, AuthTokensDto } from '../dtos/auth.dto';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  // Constantes de expiración según EARS-AUTH-02
  public static readonly ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutos = 900s
  public static readonly REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días = 604800s

  private readonly jwtSecret: string;
  private readonly refreshSecret: string;

  // Set en memoria para control de refresh tokens activos y tokens revocados/usados
  // En producción distribuida se respalda con Redis (diseño sec. 9.1: user_session:{userId})
  private readonly activeRefreshTokens = new Map<string, { userId: string; expiresAt: number }>();
  private readonly revokedRefreshTokens = new Set<string>();

  constructor(private readonly jwtService: JwtService = new JwtService({})) {
    this.jwtSecret = process.env.JWT_SECRET || 'secret-system-pos-jwt-access-key-production-ready';
    this.refreshSecret =
      process.env.JWT_REFRESH_SECRET || 'secret-system-pos-jwt-refresh-key-production-ready';
  }

  /**
   * Genera el par de tokens (Access Token 15 min + Refresh Token 7 días) bajo EARS-AUTH-02.
   */
  async generateTokenPair(
    basePayload: Omit<TokenPayload, 'tokenType' | 'tokenId'>,
  ): Promise<AuthTokensDto> {
    const tokenId = crypto.randomUUID();

    const accessPayload: TokenPayload = {
      ...basePayload,
      tokenType: 'access',
      tokenId: crypto.randomUUID(),
    };

    const refreshPayload: TokenPayload = {
      ...basePayload,
      tokenType: 'refresh',
      tokenId,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.jwtSecret,
      expiresIn: TokenService.ACCESS_TOKEN_TTL_SECONDS,
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.refreshSecret,
      expiresIn: TokenService.REFRESH_TOKEN_TTL_SECONDS,
    });

    // Registrar refresh token activo
    const expiresAt = Date.now() + TokenService.REFRESH_TOKEN_TTL_SECONDS * 1000;
    this.activeRefreshTokens.set(tokenId, { userId: basePayload.sub, expiresAt });

    return {
      accessToken,
      refreshToken,
      expiresIn: TokenService.ACCESS_TOKEN_TTL_SECONDS,
      refreshExpiresIn: TokenService.REFRESH_TOKEN_TTL_SECONDS,
    };
  }

  /**
   * Valida un Access Token y retorna su payload.
   */
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.jwtSecret,
      });

      if (payload.tokenType !== 'access') {
        throw new UnauthorizedException('Tipo de token no válido');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Access token inválido o expirado');
    }
  }

  /**
   * Valida un Refresh Token y verifica que no haya sido revocado ni reutilizado.
   */
  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    let payload: TokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (payload.tokenType !== 'refresh' || !payload.tokenId) {
      throw new UnauthorizedException('El token provisto no es un refresh token válido');
    }

    // Detección de reutilización (Token Reuse Detection - Cybersecurity Skill)
    if (this.revokedRefreshTokens.has(payload.tokenId)) {
      // Alerta de seguridad: token revocado intentando ser reutilizado
      throw new UnauthorizedException('Refresh token revocado o ya utilizado');
    }

    const activeToken = this.activeRefreshTokens.get(payload.tokenId);
    if (!activeToken || activeToken.expiresAt < Date.now()) {
      throw new UnauthorizedException('Refresh token expirado o no encontrado');
    }

    return payload;
  }

  /**
   * Rotación segura de tokens: Invalida el refresh token utilizado y emite un nuevo par.
   */
  async rotateRefreshToken(oldRefreshToken: string): Promise<AuthTokensDto> {
    const payload = await this.verifyRefreshToken(oldRefreshToken);

    // Invalidar inmediatamente el token anterior
    if (payload.tokenId) {
      this.activeRefreshTokens.delete(payload.tokenId);
      this.revokedRefreshTokens.add(payload.tokenId);
    }

    // Emitir nuevo par de tokens
    const { sub, email, rol, negocioId, sucursalId } = payload;
    return this.generateTokenPair({ sub, email, rol, negocioId, sucursalId });
  }

  /**
   * Revocación explícita de un refresh token (ej. al cerrar sesión).
   */
  revokeRefreshToken(token: string): void {
    try {
      const decoded = this.jwtService.decode(token) as TokenPayload | null;
      if (decoded?.tokenId) {
        this.activeRefreshTokens.delete(decoded.tokenId);
        this.revokedRefreshTokens.add(decoded.tokenId);
      }
    } catch {
      // No arrojar en revocación silenciosa
    }
  }

  /**
   * Configuración de cookie segura para el refresh token (Anthropic Cybersecurity Skill).
   */
  getCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: TokenService.REFRESH_TOKEN_TTL_SECONDS * 1000,
      path: '/auth',
    };
  }
}
