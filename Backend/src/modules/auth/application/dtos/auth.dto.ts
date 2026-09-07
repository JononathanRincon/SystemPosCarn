import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsUUID,
  Matches,
  IsOptional,
} from 'class-validator';

export interface TokenPayload {
  sub: string;
  email: string;
  rol: string;
  negocioId: string;
  sucursalId: string | null;
  tokenType?: 'access' | 'refresh';
  tokenId?: string;
}

export interface UserSummaryDto {
  id: string;
  nombre: string;
  rol: string;
  negocioId: string;
  sucursalId: string | null;
}

export class LoginDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  email!: string;

  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  password!: string;
}

export class RefreshTokenDto {
  @IsString({ message: 'El refresh token debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El refresh token es requerido' })
  refreshToken!: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // En segundos (ej: 900 para 15 min)
  refreshExpiresIn: number; // En segundos (ej: 604800 para 7 días)
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserSummaryDto;
}

export interface RefreshResponseDto {
  accessToken: string;
  refreshToken: string;
}

export class PinLoginDto {
  @IsUUID('4', { message: 'El sucursalId debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El sucursalId es requerido' })
  sucursalId!: string;

  @IsString({ message: 'El PIN debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El PIN es requerido' })
  @Matches(/^\d{4}$/, { message: 'El PIN debe tener exactamente 4 dígitos numéricos' })
  pin!: string;

  @IsString({ message: 'El dispositivoId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El dispositivoId es requerido' })
  dispositivoId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'El userId debe ser un UUID válido' })
  userId?: string;
}

export interface PinLoginUserDto {
  id: string;
  nombre: string;
  rol: string;
}

export interface PinLoginResponseDto {
  valid: boolean;
  user: PinLoginUserDto;
  sessionToken: string;
}

