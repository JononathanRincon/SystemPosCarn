import { ExecutionContext, UnauthorizedException, ForbiddenException, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../../src/modules/auth/presentation/guards/auth.guard';
import { RolesGuard } from '../../../src/modules/auth/presentation/guards/roles.guard';
import { PermissionsGuard } from '../../../src/modules/auth/presentation/guards/permissions.guard';
import { POS_PERMISSIONS } from '../../../src/modules/auth/presentation/guards/permissions.decorator';
import { TokenService } from '../../../src/modules/auth/application/services/token.service';
import { AuthService } from '../../../src/modules/auth/application/services/auth.service';
import { HashingService } from '../../../src/modules/auth/application/services/hashing.service';
import { PinThrottlerService } from '../../../src/modules/auth/application/services/pin-throttler.service';
import { AuthController } from '../../../src/modules/auth/presentation/http/auth.controller';
import { Usuario } from '../../../src/modules/auth/domain/entities/usuario.entity';
import { UsuarioRepositoryPort } from '../../../src/modules/auth/domain/ports/usuario-repository.port';
import { PinLoginDto } from '../../../src/modules/auth/application/dtos/auth.dto';

describe('TASK-06: Validación de PIN POS, Throttling y Guards RBAC (Unitario)', () => {
  let reflector: Reflector;
  let tokenService: TokenService;
  let hashingService: HashingService;
  let throttlerService: PinThrottlerService;

  const mockContext = (requestData: any, handlerMeta?: any, classMeta?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => requestData,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => handlerMeta || {},
      getClass: () => classMeta || {},
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    tokenService = new TokenService();
    hashingService = new HashingService();
    throttlerService = new PinThrottlerService();
  });

  describe('1. AuthGuard (Validación de Token Bearer)', () => {
    let authGuard: AuthGuard;

    beforeEach(() => {
      authGuard = new AuthGuard(reflector, tokenService);
    });

    it('debe permitir el acceso inmediato en rutas con metadata @Public()', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const context = mockContext({});
      const result = await authGuard.canActivate(context);

      expect(result).toBe(true);
    });

    it('debe arrojar UnauthorizedException si la cabecera Authorization no existe', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = mockContext({ headers: {} });

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(authGuard.canActivate(context)).rejects.toThrow('Token de autenticación no proporcionado');
    });

    it('debe arrojar UnauthorizedException si el esquema no es Bearer', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = mockContext({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(authGuard.canActivate(context)).rejects.toThrow('Formato de autorización inválido');
    });

    it('debe arrojar UnauthorizedException si el token es inválido o corrupto', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = mockContext({ headers: { authorization: 'Bearer token-invalido-corrupto' } });

      await expect(authGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(authGuard.canActivate(context)).rejects.toThrow('Token de acceso inválido o expirado');
    });

    it('debe inyectar request.user y retornar true ante un Access Token válido', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const tokens = await tokenService.generateTokenPair({
        sub: 'usr-123',
        email: 'cajero@carniceria.com',
        rol: 'Cajero',
        negocioId: 'neg-1',
        sucursalId: 'suc-1',
      });

      const req: any = { headers: { authorization: `Bearer ${tokens.accessToken}` } };
      const context = mockContext(req);

      const result = await authGuard.canActivate(context);

      expect(result).toBe(true);
      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('usr-123');
      expect(req.user.rol).toBe('Cajero');
    });
  });

  describe('2. RolesGuard (Autorización Basada en Roles)', () => {
    let rolesGuard: RolesGuard;

    beforeEach(() => {
      rolesGuard = new RolesGuard(reflector);
    });

    it('debe permitir acceso si la ruta no tiene restricción de roles', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const context = mockContext({ user: { rol: 'Cajero' } });
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('debe arrojar UnauthorizedException si no hay usuario en request', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Administrador']);

      const context = mockContext({});
      expect(() => rolesGuard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('debe permitir acceso si el usuario posee exactamente el rol requerido', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Cajero']);

      const context = mockContext({ user: { rol: 'Cajero' } });
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('debe permitir acceso al Administrador / Dueño en rutas de roles menores', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Gerente Sucursal']);

      const contextAdmin = mockContext({ user: { rol: 'Administrador' } });
      expect(rolesGuard.canActivate(contextAdmin)).toBe(true);

      const contextDueno = mockContext({ user: { rol: 'Dueño' } });
      expect(rolesGuard.canActivate(contextDueno)).toBe(true);
    });

    it('debe denegar acceso (ForbiddenException) si un Cajero intenta acceder a recursos de Administrador o Gerente', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['Administrador', 'Gerente Sucursal']);

      const context = mockContext({ user: { rol: 'Cajero' } });
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('3. PermissionsGuard (Matriz RBAC design.md sec. 14.1)', () => {
    let permissionsGuard: PermissionsGuard;

    beforeEach(() => {
      permissionsGuard = new PermissionsGuard(reflector);
    });

    it('debe permitir acceso a un Cajero para permisos operativos asignados (login PIN, registrar venta, caja turno)', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        POS_PERMISSIONS.POS_LOGIN_PIN,
        POS_PERMISSIONS.VENTAS_REGISTRAR,
        POS_PERMISSIONS.CAJA_TURNO,
      ]);

      const context = mockContext({ user: { rol: 'Cajero' } });
      expect(permissionsGuard.canActivate(context)).toBe(true);
    });

    it('debe denegar acceso (ForbiddenException) si un Cajero intenta anular venta o registrar merma', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([POS_PERMISSIONS.VENTAS_ANULAR]);

      const contextAnular = mockContext({ user: { rol: 'Cajero' } });
      expect(() => permissionsGuard.canActivate(contextAnular)).toThrow(ForbiddenException);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([POS_PERMISSIONS.INVENTARIO_MERMA]);
      const contextMerma = mockContext({ user: { rol: 'Cajero' } });
      expect(() => permissionsGuard.canActivate(contextMerma)).toThrow(ForbiddenException);
    });

    it('debe conceder acceso a un Gerente Sucursal para anular ventas, pesaje manual y mermas', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
        POS_PERMISSIONS.VENTAS_ANULAR,
        POS_PERMISSIONS.PESAJE_MANUAL,
        POS_PERMISSIONS.INVENTARIO_MERMA,
        POS_PERMISSIONS.LOTES_RECEPCION,
      ]);

      const context = mockContext({ user: { rol: 'Gerente Sucursal' } });
      expect(permissionsGuard.canActivate(context)).toBe(true);
    });

    it('debe denegar acceso a un Gerente Sucursal si intenta modificar precios de catálogo o ver métricas multi-sucursal', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([POS_PERMISSIONS.CATALOGO_PRECIOS]);
      const contextPrecios = mockContext({ user: { rol: 'Gerente Sucursal' } });
      expect(() => permissionsGuard.canActivate(contextPrecios)).toThrow(ForbiddenException);

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([POS_PERMISSIONS.METRICAS_MULTI_SUCURSAL]);
      const contextMetricas = mockContext({ user: { rol: 'Gerente Sucursal' } });
      expect(() => permissionsGuard.canActivate(contextMetricas)).toThrow(ForbiddenException);
    });

    it('debe otorgar acceso total al Administrador para cualquier permiso de la matriz RBAC', () => {
      const allPermissions = Object.values(POS_PERMISSIONS);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(allPermissions);

      const context = mockContext({ user: { rol: 'Administrador' } });
      expect(permissionsGuard.canActivate(context)).toBe(true);
    });
  });

  describe('4. PinThrottlerService & EARS-AUTH-04 (Control de Intentos y Bloqueo por 60s)', () => {
    const testKey = 'suc-1:disp-tablet-01';

    beforeEach(() => {
      throttlerService.clearAll();
    });

    it('debe permitir los primeros 3 intentos fallidos consecutivos sin bloquear el acceso', () => {
      const intento1 = throttlerService.recordFailedAttempt(testKey);
      expect(intento1.attempts).toBe(1);
      expect(intento1.isBlocked).toBe(false);
      expect(() => throttlerService.checkLockout(testKey)).not.toThrow();

      const intento2 = throttlerService.recordFailedAttempt(testKey);
      expect(intento2.attempts).toBe(2);
      expect(intento2.isBlocked).toBe(false);
      expect(() => throttlerService.checkLockout(testKey)).not.toThrow();

      const intento3 = throttlerService.recordFailedAttempt(testKey);
      expect(intento3.attempts).toBe(3);
      expect(intento3.isBlocked).toBe(false);
      expect(() => throttlerService.checkLockout(testKey)).not.toThrow();
    });

    it('debe bloquear el acceso durante 60 segundos al 4to intento fallido consecutivo (EARS-AUTH-04)', () => {
      // 3 fallos previos
      throttlerService.recordFailedAttempt(testKey);
      throttlerService.recordFailedAttempt(testKey);
      throttlerService.recordFailedAttempt(testKey);

      // 4to intento fallido consecutivo
      const intento4 = throttlerService.recordFailedAttempt(testKey);
      expect(intento4.attempts).toBe(4);
      expect(intento4.isBlocked).toBe(true);
      expect(intento4.remainingSeconds).toBe(60);

      // Verificación de excepción HTTP 429 Too Many Requests
      expect(() => throttlerService.checkLockout(testKey)).toThrow(HttpException);
      try {
        throttlerService.checkLockout(testKey);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const response = err.getResponse();
        expect(response.remainingSeconds).toBeGreaterThanOrEqual(1);
        expect(response.message).toContain('Demasiados intentos fallidos');
      }
    });

    it('debe mantener el bloqueo activo con HTTP 429 durante el periodo de 60 segundos', () => {
      for (let i = 0; i < 4; i++) {
        throttlerService.recordFailedAttempt(testKey);
      }

      expect(throttlerService.getRemainingLockoutSeconds(testKey)).toBeGreaterThan(0);
      expect(throttlerService.getRemainingLockoutSeconds(testKey)).toBeLessThanOrEqual(60);
    });

    it('debe restablecer los intentos fallidos tras llamar a resetAttempts()', () => {
      throttlerService.recordFailedAttempt(testKey);
      throttlerService.recordFailedAttempt(testKey);
      expect(throttlerService.getFailedAttempts(testKey)).toBe(2);

      throttlerService.resetAttempts(testKey);
      expect(throttlerService.getFailedAttempts(testKey)).toBe(0);
      expect(() => throttlerService.checkLockout(testKey)).not.toThrow();
    });
  });

  describe('5. AuthService.pinLogin y AuthController (EARS-AUTH-03, EARS-AUTH-04)', () => {
    let authService: AuthService;
    let authController: AuthController;
    let mockUsuarioRepository: jest.Mocked<UsuarioRepositoryPort>;
    let usuarioCajero: Usuario;

    beforeEach(async () => {
      const pinHash = await hashingService.hashPin('4321');
      const passHash = await hashingService.hashPassword('Password123!');

      usuarioCajero = new Usuario({
        id: 'cajero-uuid-1',
        negocioId: 'negocio-uuid-1',
        sucursalId: 'sucursal-uuid-1',
        nombreCompleto: 'Carlos Carnicero',
        email: 'carlos@carniceria.com',
        passwordHash: passHash,
        pinPosHash: pinHash,
        rol: 'Cajero',
        activo: true,
      });

      mockUsuarioRepository = {
        findById: jest.fn().mockImplementation(async (id: string) => {
          return id === usuarioCajero.id ? usuarioCajero : null;
        }),
        findByEmail: jest.fn(),
        findByNegocioAndPin: jest.fn(),
        findBySucursal: jest.fn().mockImplementation(async (sucursalId: string) => {
          return sucursalId === 'sucursal-uuid-1' ? [usuarioCajero] : [];
        }),
        save: jest.fn(),
      };

      authService = new AuthService(
        hashingService,
        tokenService,
        throttlerService,
        mockUsuarioRepository,
      );

      authController = new AuthController(authService);
    });

    it('debe autenticar exitosamente con PIN de 4 dígitos y retornar { valid: true, user, sessionToken }', async () => {
      const dto: PinLoginDto = {
        sucursalId: 'sucursal-uuid-1',
        dispositivoId: 'disp-caja-1',
        pin: '4321',
      };

      const result = await authController.pinLogin(dto);

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(usuarioCajero.id);
      expect(result.user.nombre).toBe('Carlos Carnicero');
      expect(result.user.rol).toBe('Cajero');
      expect(typeof result.sessionToken).toBe('string');

      // Validar que el sessionToken es un JWT válido emitido por el sistema
      const payload = await tokenService.verifyToken(result.sessionToken);
      expect(payload.sub).toBe(usuarioCajero.id);
      expect(payload.rol).toBe('Cajero');
    });

    it('debe rechazar con BadRequestException si el formato del PIN no tiene exactamente 4 dígitos', async () => {
      const dtoInvalido: PinLoginDto = {
        sucursalId: 'sucursal-uuid-1',
        dispositivoId: 'disp-caja-1',
        pin: '123', // Solo 3 dígitos
      };

      await expect(authController.pinLogin(dtoInvalido)).rejects.toThrow(BadRequestException);
      await expect(authController.pinLogin(dtoInvalido)).rejects.toThrow(
        'El PIN debe tener exactamente 4 dígitos numéricos',
      );
    });

    it('debe arrojar UnauthorizedException (HTTP 401) ante PIN incorrecto', async () => {
      const dtoErroneo: PinLoginDto = {
        sucursalId: 'sucursal-uuid-1',
        dispositivoId: 'disp-caja-1',
        pin: '9999',
      };

      await expect(authController.pinLogin(dtoErroneo)).rejects.toThrow(UnauthorizedException);
      expect(throttlerService.getFailedAttempts('sucursal-uuid-1:disp-caja-1')).toBe(1);
    });

    it('debe arrojar HttpException (HTTP 429 Too Many Requests) al 4to intento fallido consecutivo', async () => {
      const dtoErroneo: PinLoginDto = {
        sucursalId: 'sucursal-uuid-1',
        dispositivoId: 'disp-caja-1',
        pin: '9999',
      };

      // Intentos 1, 2, 3 arrojan 401
      await expect(authController.pinLogin(dtoErroneo)).rejects.toThrow(UnauthorizedException);
      await expect(authController.pinLogin(dtoErroneo)).rejects.toThrow(UnauthorizedException);
      await expect(authController.pinLogin(dtoErroneo)).rejects.toThrow(UnauthorizedException);

      // 4to intento arroja 429 Too Many Requests
      await expect(authController.pinLogin(dtoErroneo)).rejects.toThrow(HttpException);

      try {
        await authController.pinLogin(dtoErroneo);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse().remainingSeconds).toBeGreaterThan(0);
      }
    });

    it('debe reiniciar el contador de intentos fallidos si se ingresa el PIN correcto', async () => {
      const dtoErroneo: PinLoginDto = {
        sucursalId: 'sucursal-uuid-1',
        dispositivoId: 'disp-caja-1',
        pin: '0000',
      };

      // 2 intentos fallidos
      await expect(authController.pinLogin(dtoErroneo)).rejects.toThrow(UnauthorizedException);
      await expect(authController.pinLogin(dtoErroneo)).rejects.toThrow(UnauthorizedException);
      expect(throttlerService.getFailedAttempts('sucursal-uuid-1:disp-caja-1')).toBe(2);

      // 3er intento exitoso
      const dtoCorrecto: PinLoginDto = {
        sucursalId: 'sucursal-uuid-1',
        dispositivoId: 'disp-caja-1',
        pin: '4321',
      };
      const response = await authController.pinLogin(dtoCorrecto);
      expect(response.valid).toBe(true);

      // Contador reiniciado a 0
      expect(throttlerService.getFailedAttempts('sucursal-uuid-1:disp-caja-1')).toBe(0);
    });
  });
});
