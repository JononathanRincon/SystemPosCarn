import { Injectable, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class HashingService {
  public static readonly MIN_SALT_ROUNDS = 10;

  /**
   * Hashea una contraseña mediante bcrypt con factor de costo mínimo 10 (EARS-AUTH-01).
   */
  async hashPassword(password: string, saltRounds: number = HashingService.MIN_SALT_ROUNDS): Promise<string> {
    if (!password || typeof password !== 'string' || password.length === 0) {
      throw new BadRequestException('La contraseña no puede estar vacía');
    }
    if (password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }
    const rounds = Math.max(saltRounds, HashingService.MIN_SALT_ROUNDS);
    return bcrypt.hash(password, rounds);
  }

  /**
   * Valida una contraseña plana contra su hash de bcrypt.
   */
  async comparePassword(plainPassword: string, hash: string): Promise<boolean> {
    if (!plainPassword || !hash) {
      return false;
    }
    return bcrypt.compare(plainPassword, hash);
  }

  /**
   * Hashea un PIN POS de 4 dígitos numéricos para terminales de mostrador (US-01, EARS-AUTH-01).
   */
  async hashPin(pin: string, saltRounds: number = HashingService.MIN_SALT_ROUNDS): Promise<string> {
    if (!this.isValidPinFormat(pin)) {
      throw new BadRequestException('El PIN POS debe contener exactamente 4 dígitos numéricos');
    }
    const rounds = Math.max(saltRounds, HashingService.MIN_SALT_ROUNDS);
    return bcrypt.hash(pin, rounds);
  }

  /**
   * Valida un PIN plano de 4 dígitos contra su hash de bcrypt.
   */
  async comparePin(plainPin: string, hash: string): Promise<boolean> {
    if (!this.isValidPinFormat(plainPin) || !hash) {
      return false;
    }
    return bcrypt.compare(plainPin, hash);
  }

  /**
   * Valida si la cadena cumple con el formato exacto de 4 dígitos numéricos.
   */
  isValidPinFormat(pin: string): boolean {
    return typeof pin === 'string' && /^\d{4}$/.test(pin);
  }
}
