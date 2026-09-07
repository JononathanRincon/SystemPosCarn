import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { AuthService } from '../../application/services/auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  LoginResponseDto,
  RefreshResponseDto,
  PinLoginDto,
  PinLoginResponseDto,
} from '../../application/dtos/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint POST /auth/login (design.md sec. 7.1 y 14.2)
   * Rate limiting sensible: 5 peticiones por minuto.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(loginDto);

    // Configurar cookie segura HttpOnly para el refresh token
    const cookieOptions = this.authService.getTokenService().getCookieOptions();
    if (res && typeof res.cookie === 'function') {
      res.cookie('refreshToken', result.refreshToken, cookieOptions);
    }

    return result;
  }

  /**
   * Endpoint POST /auth/refresh (design.md sec. 7.1)
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    // Tomar el refresh token desde el body o desde las cookies firmadas
    const token = refreshDto?.refreshToken || req?.cookies?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token requerido');
    }

    const result = await this.authService.refresh(token);

    // Actualizar cookie segura HttpOnly con el nuevo refresh token
    const cookieOptions = this.authService.getTokenService().getCookieOptions();
    if (res && typeof res.cookie === 'function') {
      res.cookie('refreshToken', result.refreshToken, cookieOptions);
    }

    return result;
  }

  /**
   * Endpoint POST /auth/pin-login (design.md sec. 7.1 endpoint 3, EARS-AUTH-03, EARS-AUTH-04)
   * Validación local rápida de PIN para cajeros con mitigación de fuerza bruta (bloqueo tras 3 intentos erróneos durante 60s).
   * Rate limiting sensible: 5 peticiones por minuto.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('pin-login')
  @HttpCode(HttpStatus.OK)
  async pinLogin(@Body() pinLoginDto: PinLoginDto): Promise<PinLoginResponseDto> {
    return this.authService.pinLogin(pinLoginDto);
  }

  /**
   * Alias de compatibilidad: POST /auth/login-pin
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login-pin')
  @HttpCode(HttpStatus.OK)
  async loginPin(@Body() pinLoginDto: PinLoginDto): Promise<PinLoginResponseDto> {
    return this.authService.pinLogin(pinLoginDto);
  }
}

