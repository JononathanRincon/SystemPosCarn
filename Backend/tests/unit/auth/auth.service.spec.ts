import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../../../src/modules/auth/application/services/auth.service';
import { HashingService } from '../../../src/modules/auth/application/services/hashing.service';
import { TokenService } from '../../../src/modules/auth/application/services/token.service';
import { AuthController } from '../../../src/modules/auth/presentation/http/auth.controller';
import { Usuario } from '../../../src/modules/auth/domain/entities/usuario.entity';
import { UsuarioRepositoryPort } from '../../../src/modules/auth/domain/ports/usuario-repository.port';

describe('Módulo de Autenticación & Seguridad (Unitario)', () => {
  let authService: AuthService;
  let hashingService: HashingService;
  let tokenService: TokenService;
  let mockUsuarioRepository: jest.Mocked<UsuarioRepositoryPort>;
  let authController: AuthController;

  const mockUserInstance = new Usuario({
    id: 'usr-uuid-1234',
    negocioId: 'neg-uuid-1234',
    sucursalId: 'suc-uuid-1234',
    nombreCompleto: 'Andrés Carnicero',
    email: 'andres@carniceria.com',
    passwordHash: bcrypt.hashSync('PasswordSegura123*', 10),
    pinPosHash: bcrypt.hashSync('7890', 10),
    rol: 'cajero',
    activo: true,
  });

  beforeEach(() => {
    hashingService = new HashingService();
    tokenService = new TokenService();
    mockUsuarioRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByNegocioAndPin: jest.fn(),
      save: jest.fn(),
    };

    authService = new AuthService(hashingService, tokenService, mockUsuarioRepository);
    authController = new AuthController(authService);
  });

  // =========================================================================
  // TASK-04: Credenciales y Hashing
  // =========================================================================
  describe('TASK-04: Entidad Usuario y Hashing de Credenciales', () => {
    const plainPassword = 'PasswordSegura2026*';
    const validPin = '4826';

    it('debe generar un hash bcrypt con factor de costo mínimo 10', async () => {
      const hash = await authService.hashPassword(plainPassword);
      expect(hash).toBeDefined();
      expect(parseInt(hash.split('$')[2], 10)).toBeGreaterThanOrEqual(10);
      expect(await authService.validatePassword(plainPassword, hash)).toBe(true);
      expect(await authService.validatePassword('erronea', hash)).toBe(false);
    });

    it('debe hashear y validar PIN POS de exactamente 4 dígitos', async () => {
      const pinHash = await authService.hashPinPos(validPin);
      expect(pinHash).toBeDefined();
      expect(await authService.validatePinPos(validPin, pinHash)).toBe(true);
      expect(await authService.validatePinPos('0000', pinHash)).toBe(false);
      await expect(authService.hashPinPos('12')).rejects.toThrow(BadRequestException);
    });

    it('toResponseDto() no debe exponer passwordHash ni pinPosHash', () => {
      const dto = mockUserInstance.toResponseDto();
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('pinPosHash');
      expect(dto.id).toBe(mockUserInstance.id);
    });
  });

  // =========================================================================
  // TASK-05: Emisión y Renovación de Tokens JWT (Access + Refresh)
  // =========================================================================
  describe('TASK-05: EARS-AUTH-02 Emisión de Tokens JWT (Access 15 min + Refresh 7 días)', () => {
    it('debe emitir tokens con tiempos de expiración exactos (15m y 7d)', async () => {
      const tokens = await tokenService.generateTokenPair({
        sub: mockUserInstance.id,
        email: mockUserInstance.email,
        rol: mockUserInstance.rol,
        negocioId: mockUserInstance.negocioId,
        sucursalId: mockUserInstance.sucursalId,
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(15 * 60); // 900 segundos = 15 minutos
      expect(tokens.refreshExpiresIn).toBe(7 * 24 * 60 * 60); // 604800 segundos = 7 días

      // Decodificar los tokens JWT para verificar los claims de expiración
      const decodedAccess = jwt.decode(tokens.accessToken) as { exp: number; iat: number; tokenType: string };
      const decodedRefresh = jwt.decode(tokens.refreshToken) as { exp: number; iat: number; tokenType: string };

      expect(decodedAccess.tokenType).toBe('access');
      expect(decodedRefresh.tokenType).toBe('refresh');

      const accessTtl = decodedAccess.exp - decodedAccess.iat;
      const refreshTtl = decodedRefresh.exp - decodedRefresh.iat;

      expect(accessTtl).toBe(15 * 60);
      expect(refreshTtl).toBe(7 * 24 * 60 * 60);
    });

    it('debe verificar la firma de un Access Token válido', async () => {
      const tokens = await tokenService.generateTokenPair({
        sub: mockUserInstance.id,
        email: mockUserInstance.email,
        rol: mockUserInstance.rol,
        negocioId: mockUserInstance.negocioId,
        sucursalId: mockUserInstance.sucursalId,
      });

      const payload = await tokenService.verifyAccessToken(tokens.accessToken);
      expect(payload.sub).toBe(mockUserInstance.id);
      expect(payload.email).toBe(mockUserInstance.email);
      expect(payload.rol).toBe(mockUserInstance.rol);
      expect(payload.negocioId).toBe(mockUserInstance.negocioId);
    });

    it('debe rechazar un Access Token manipulado o con firma inválida', async () => {
      const manipulatedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.tamperedSignature';
      await expect(tokenService.verifyAccessToken(manipulatedToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('TASK-05: Rotación Segura de Refresh Tokens (Token Reuse Detection)', () => {
    it('debe emitir nuevo par de tokens al rotar un refresh token válido', async () => {
      const initialTokens = await tokenService.generateTokenPair({
        sub: mockUserInstance.id,
        email: mockUserInstance.email,
        rol: mockUserInstance.rol,
        negocioId: mockUserInstance.negocioId,
        sucursalId: mockUserInstance.sucursalId,
      });

      const rotatedTokens = await authService.refresh(initialTokens.refreshToken);

      expect(rotatedTokens.accessToken).toBeDefined();
      expect(rotatedTokens.refreshToken).toBeDefined();
      expect(rotatedTokens.refreshToken).not.toBe(initialTokens.refreshToken);
      expect(rotatedTokens.accessToken).not.toBe(initialTokens.accessToken);
    });

    it('debe invalidar el refresh token previo tras su rotación (prevención de reutilización)', async () => {
      const initialTokens = await tokenService.generateTokenPair({
        sub: mockUserInstance.id,
        email: mockUserInstance.email,
        rol: mockUserInstance.rol,
        negocioId: mockUserInstance.negocioId,
        sucursalId: mockUserInstance.sucursalId,
      });

      // Primer uso (rotación exitosa)
      await authService.refresh(initialTokens.refreshToken);

      // Segundo uso del MISMO token previo (intento de replay attack)
      await expect(authService.refresh(initialTokens.refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe arrojar UnauthorizedException si el refresh token está vacío o malformado', async () => {
      await expect(authService.refresh('')).rejects.toThrow(UnauthorizedException);
      await expect(authService.refresh('token-invalido-xyz')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('TASK-05: Endpoint /auth/login y /auth/refresh en AuthService', () => {
    it('login: debe autenticar credenciales y retornar tokens con datos de usuario', async () => {
      mockUsuarioRepository.findByEmail.mockResolvedValue(mockUserInstance);

      const response = await authService.login({
        email: 'andres@carniceria.com',
        password: 'PasswordSegura123*',
      });

      expect(response.accessToken).toBeDefined();
      expect(response.refreshToken).toBeDefined();
      expect(response.user.id).toBe(mockUserInstance.id);
      expect(response.user.nombre).toBe(mockUserInstance.nombreCompleto);
      expect(response.user.rol).toBe(mockUserInstance.rol);
      expect(response.user.negocioId).toBe(mockUserInstance.negocioId);
    });

    it('login: debe arrojar UnauthorizedException si el correo no existe', async () => {
      mockUsuarioRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'noexiste@carniceria.com',
          password: 'PasswordSegura123*',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('login: debe arrojar UnauthorizedException ante contraseña incorrecta', async () => {
      mockUsuarioRepository.findByEmail.mockResolvedValue(mockUserInstance);

      await expect(
        authService.login({
          email: 'andres@carniceria.com',
          password: 'PasswordEquivocada99',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('login: debe arrojar UnauthorizedException si el usuario está inactivo', async () => {
      const inactiveUser = new Usuario({
        id: 'usr-inactivo',
        negocioId: 'neg-1',
        nombreCompleto: 'Usuario Inactivo',
        email: 'inactivo@carniceria.com',
        passwordHash: bcrypt.hashSync('PasswordSegura123*', 10),
        pinPosHash: bcrypt.hashSync('1111', 10),
        rol: 'cajero',
        activo: false,
      });

      mockUsuarioRepository.findByEmail.mockResolvedValue(inactiveUser);

      await expect(
        authService.login({
          email: 'inactivo@carniceria.com',
          password: 'PasswordSegura123*',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('TASK-05: Controlador AuthController & Cookies HttpOnly Seguras', () => {
    it('login: debe configurar cookie HttpOnly con SameSite Strict para el refresh token', async () => {
      mockUsuarioRepository.findByEmail.mockResolvedValue(mockUserInstance);

      const mockResponse: any = {
        cookie: jest.fn(),
      };

      const result = await authController.login(
        { email: 'andres@carniceria.com', password: 'PasswordSegura123*' },
        mockResponse,
      );

      expect(result.accessToken).toBeDefined();
      expect(result.user.id).toBe(mockUserInstance.id);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        result.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });

    it('refresh: debe renovar tokens leyendo desde el cuerpo o cookie y actualizar la cookie', async () => {
      const initialTokens = await tokenService.generateTokenPair({
        sub: mockUserInstance.id,
        email: mockUserInstance.email,
        rol: mockUserInstance.rol,
        negocioId: mockUserInstance.negocioId,
        sucursalId: mockUserInstance.sucursalId,
      });

      const mockResponse: any = {
        cookie: jest.fn(),
      };
      const mockRequest: any = {
        cookies: {},
      };

      const result = await authController.refresh(
        { refreshToken: initialTokens.refreshToken },
        mockRequest,
        mockResponse,
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        result.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
    });
  });
});
