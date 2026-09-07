import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ThrottlerStorageService, ThrottlerException } from '@nestjs/throttler';
import { CustomThrottlerGuard } from '../../../src/common/security/custom-throttler.guard';
import { helmetConfig } from '../../../src/common/security/helmet.config';
import {
  PinThrottlerService,
  PinLockoutException,
} from '../../../src/modules/auth/application/services/pin-throttler.service';

describe('TASK-19: Seguridad, Throttling y Hardening HTTP', () => {
  describe('1. PinThrottlerService - Bloqueo de PIN tras intentos fallidos (EARS-AUTH-04)', () => {
    let pinThrottler: PinThrottlerService;
    const testKey = 'sucursal-101:terminal-pos-01';

    beforeEach(() => {
      pinThrottler = new PinThrottlerService();
    });

    it('debe permitir los primeros 3 intentos fallidos consecutivos sin bloquear el acceso', () => {
      for (let i = 1; i <= 3; i++) {
        const res = pinThrottler.recordFailedAttempt(testKey);
        expect(res.attempts).toBe(i);
        expect(res.isBlocked).toBe(false);
        expect(res.remainingSeconds).toBe(0);
        expect(() => pinThrottler.checkLockout(testKey)).not.toThrow();
      }
    });

    it('debe bloquear el acceso durante 60 segundos tras el 4to fallo consecutivo con HTTP 429 y Retry-After: 60', () => {
      // 3 fallos previos
      pinThrottler.recordFailedAttempt(testKey);
      pinThrottler.recordFailedAttempt(testKey);
      pinThrottler.recordFailedAttempt(testKey);

      // 4to fallo (supera el límite de 3)
      const resBloqueo = pinThrottler.recordFailedAttempt(testKey);
      expect(resBloqueo.attempts).toBe(4);
      expect(resBloqueo.isBlocked).toBe(true);
      expect(resBloqueo.remainingSeconds).toBe(60);

      // checkLockout debe lanzar PinLockoutException con HTTP 429
      const mockRes = { setHeader: jest.fn() };
      expect(() => pinThrottler.checkLockout(testKey, mockRes)).toThrow(PinLockoutException);

      try {
        pinThrottler.checkLockout(testKey, mockRes);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.headers['Retry-After']).toBe('60');
        expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', '60');
        const responseBody = err.getResponse();
        expect(responseBody.remainingSeconds).toBeGreaterThanOrEqual(1);
        expect(responseBody.message).toContain('Demasiados intentos fallidos');
      }
    });

    it('debe restablecer los intentos fallidos tras una autenticación exitosa (resetAttempts)', () => {
      pinThrottler.recordFailedAttempt(testKey);
      pinThrottler.recordFailedAttempt(testKey);
      expect(pinThrottler.getFailedAttempts(testKey)).toBe(2);

      pinThrottler.resetAttempts(testKey);
      expect(pinThrottler.getFailedAttempts(testKey)).toBe(0);
      expect(() => pinThrottler.checkLockout(testKey)).not.toThrow();
    });
  });

  describe('2. Throttling de Rutas Sensibles (5 req/min) y Global (100 req/min)', () => {
    let storageService: ThrottlerStorageService;

    beforeEach(() => {
      storageService = new ThrottlerStorageService();
    });

    afterEach(async () => {
      if (storageService && typeof storageService.onApplicationShutdown === 'function') {
        storageService.onApplicationShutdown();
      }
    });

    it('debe tolerar hasta 5 peticiones y bloquear la 6ª petición consecutiva en < 60s para rutas de login/PIN', async () => {
      const sensitiveRouteKey = 'login:192.168.1.50';
      const limit = 5;
      const ttl = 60000;

      // Peticiones 1 a 5: Permitidas
      for (let i = 1; i <= limit; i++) {
        const record = await storageService.increment(sensitiveRouteKey, ttl, limit, 60000, 'default');
        expect(record.totalHits).toBe(i);
        expect(record.isBlocked).toBe(false);
      }

      // 6ª petición: Bloqueada por superar el límite
      const record6 = await storageService.increment(sensitiveRouteKey, ttl, limit, 60000, 'default');
      expect(record6.totalHits).toBe(6);
      expect(record6.isBlocked).toBe(true);
      expect(record6.timeToBlockExpire).toBeGreaterThan(0);
    });

    it('debe tolerar hasta 100 peticiones globales por minuto y bloquear la 101ª petición', async () => {
      const globalRouteKey = 'global:192.168.1.99';
      const limit = 100;
      const ttl = 60000;

      // Realizar 100 peticiones bajo el umbral permitido
      for (let i = 1; i <= limit; i++) {
        const record = await storageService.increment(globalRouteKey, ttl, limit, 60000, 'default');
        expect(record.isBlocked).toBe(false);
      }

      // La 101ª petición excede el umbral global de 100 req/min
      const record101 = await storageService.increment(globalRouteKey, ttl, limit, 60000, 'default');
      expect(record101.totalHits).toBe(101);
      expect(record101.isBlocked).toBe(true);
    });
  });

  describe('3. CustomThrottlerGuard y Cabecera Retry-After', () => {
    it('debe inyectar la cabecera Retry-After y arrojar ThrottlerException (HTTP 429)', async () => {
      const mockHeaders: Record<string, string> = {};
      const mockRes = {
        setHeader: jest.fn((k: string, v: string) => {
          mockHeaders[k] = v;
        }),
      };

      const mockExecutionContext = {
        switchToHttp: () => ({
          getResponse: () => mockRes,
          getRequest: () => ({}),
        }),
      } as unknown as ExecutionContext;

      // Crear instancia de CustomThrottlerGuard con storage
      const guard = new CustomThrottlerGuard(
        [{ name: 'default', ttl: 60000, limit: 5 }],
        new ThrottlerStorageService(),
        { get: () => null } as any,
      );

      await expect(
        (guard as any).throwThrottlingException(mockExecutionContext, {
          totalHits: 6,
          timeToExpire: 50,
          isBlocked: true,
          timeToBlockExpire: 60000,
        }),
      ).rejects.toThrow(ThrottlerException);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', '60');
      expect(mockHeaders['Retry-After']).toBe('60');
    });
  });

  describe('4. Hardening HTTP (Helmet y Políticas de Seguridad)', () => {
    it('debe configurar CSP estricto (default-src self) y ocultar la cabecera X-Powered-By', () => {
      expect(helmetConfig.contentSecurityPolicy.directives.defaultSrc).toEqual(["'self'"]);
      expect(helmetConfig.hidePoweredBy).toBe(true);
      expect(helmetConfig.hsts.maxAge).toBe(31536000);
      expect(helmetConfig.hsts.includeSubDomains).toBe(true);
      expect(helmetConfig.hsts.preload).toBe(true);
    });
  });
});