import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

export interface ThrottlerRecord {
  attempts: number;
  lockoutUntil: number | null;
  lastAttemptAt: number;
}

@Injectable()
export class PinThrottlerService {
  private readonly records = new Map<string, ThrottlerRecord>();

  /**
   * Límite de intentos fallidos consecutivos permitidos antes del bloqueo (EARS-AUTH-04).
   * Al superar este número (4to intento consecutivo incorrecto), se bloquea el acceso.
   */
  public readonly maxAttempts: number = 3;

  /**
   * Duración del bloqueo en segundos (EARS-AUTH-04).
   */
  public readonly lockoutDurationSeconds: number = 60;

  /**
   * Verifica si una clave (ej: "sucursalId:dispositivoId") se encuentra bloqueada por exceso de intentos fallidos.
   * Si está bloqueada, arroja una HttpException con status 429 (Too Many Requests).
   */
  checkLockout(key: string): void {
    const record = this.records.get(key);
    if (!record) return;

    const now = Date.now();

    if (record.lockoutUntil) {
      if (now < record.lockoutUntil) {
        const remainingSeconds = Math.max(1, Math.ceil((record.lockoutUntil - now) / 1000));
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message: `Demasiados intentos fallidos. Acceso bloqueado. Intente nuevamente en ${remainingSeconds} segundos.`,
            remainingSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      } else {
        // El periodo de bloqueo ha expirado: restablecer el contador
        this.records.delete(key);
      }
    }
  }

  /**
   * Registra un intento fallido para la clave dada.
   * Si los intentos superan el umbral (al 4to intento), se activa el bloqueo de 60 segundos.
   */
  recordFailedAttempt(key: string): { attempts: number; isBlocked: boolean; remainingSeconds: number } {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record || (record.lockoutUntil && now >= record.lockoutUntil)) {
      record = {
        attempts: 0,
        lockoutUntil: null,
        lastAttemptAt: now,
      };
    }

    record.attempts += 1;
    record.lastAttemptAt = now;

    if (record.attempts > this.maxAttempts) {
      // Bloquear acceso por 60 segundos
      record.lockoutUntil = now + this.lockoutDurationSeconds * 1000;
      this.records.set(key, record);
      return {
        attempts: record.attempts,
        isBlocked: true,
        remainingSeconds: this.lockoutDurationSeconds,
      };
    }

    this.records.set(key, record);
    return {
      attempts: record.attempts,
      isBlocked: false,
      remainingSeconds: 0,
    };
  }

  /**
   * Resetea los intentos fallidos tras una autenticación exitosa.
   */
  resetAttempts(key: string): void {
    this.records.delete(key);
  }

  /**
   * Retorna el número actual de intentos fallidos registrados para la clave.
   */
  getFailedAttempts(key: string): number {
    const record = this.records.get(key);
    if (!record) return 0;
    const now = Date.now();
    if (record.lockoutUntil && now >= record.lockoutUntil) {
      this.records.delete(key);
      return 0;
    }
    return record.attempts;
  }

  /**
   * Retorna los segundos restantes de bloqueo o 0 si no está bloqueado.
   */
  getRemainingLockoutSeconds(key: string): number {
    const record = this.records.get(key);
    if (!record || !record.lockoutUntil) return 0;
    const now = Date.now();
    if (now >= record.lockoutUntil) {
      this.records.delete(key);
      return 0;
    }
    return Math.max(1, Math.ceil((record.lockoutUntil - now) / 1000));
  }

  /**
   * Limpia todos los registros en memoria (para pruebas).
   */
  clearAll(): void {
    this.records.clear();
  }
}
