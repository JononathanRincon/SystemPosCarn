import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import {
  CorrelationIdMiddleware,
  CORRELATION_ID_HEADER,
} from '../../../src/common/observability/correlation-id.middleware';
import {
  CanonicalLogInterceptor,
  CanonicalLogEntry,
} from '../../../src/common/observability/canonical-log.interceptor';
import { maskSensitiveData } from '../../../src/common/observability/masking.util';

describe('TASK-20: Logs Canónicos JSON y Correlation IDs (X-Correlation-ID)', () => {
  describe('1. CorrelationIdMiddleware', () => {
    let middleware: CorrelationIdMiddleware;

    beforeEach(() => {
      middleware = new CorrelationIdMiddleware();
    });

    it('debe propagar el X-Correlation-ID recibido desde el cliente hacia req y res', () => {
      const clientCorrelationId = 'client-trace-123e4567-e89b-12d3-a456-426614174000';
      const req: any = {
        headers: {
          'x-correlation-id': clientCorrelationId,
        },
      };
      const res: any = {
        setHeader: jest.fn(),
      };
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(req.correlationId).toBe(clientCorrelationId);
      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, clientCorrelationId);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('debe generar un nuevo UUIDv4 canónico cuando el cliente no envía la cabecera X-Correlation-ID', () => {
      const req: any = {
        headers: {},
      };
      const res: any = {
        setHeader: jest.fn(),
      };
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(req.correlationId).toBeDefined();
      // Validación de formato UUIDv4
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(req.correlationId).toMatch(uuidRegex);
      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, req.correlationId);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Enmascaramiento de Datos Sensibles (maskSensitiveData)', () => {
    it('debe enmascarar contraseñas, PINs, tokens y hashes sensibles con ***', () => {
      const rawPayload = {
        email: 'cajero1@carniceria.com',
        password: 'SuperSecretPassword123!',
        pin: '1234',
        password_hash: '$2b$10$abcdef1234567890',
        pin_pos_hash: '$2b$10$pinposhash123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh-token-secret-xyz',
        accessToken: 'access-token-secret-abc',
        authorization: 'Bearer secret-jwt',
        perfil: {
          nombre: 'Juan Carnicero',
          subclave_secreta: 'clave123',
          detalles: {
            pin: '9876',
            rol: 'cajero',
          },
        },
        items: [
          { producto: 'Lomo Fino', precio: 38000 },
          { token: 'item-secret-token' },
        ],
      };

      const masked = maskSensitiveData(rawPayload);

      // Campos sensibles enmascarados
      expect(masked.password).toBe('***');
      expect(masked.pin).toBe('***');
      expect(masked.password_hash).toBe('***');
      expect(masked.pin_pos_hash).toBe('***');
      expect(masked.token).toBe('***');
      expect(masked.refreshToken).toBe('***');
      expect(masked.accessToken).toBe('***');
      expect(masked.authorization).toBe('***');
      expect(masked.perfil.subclave_secreta).toBe('***');
      expect(masked.perfil.detalles.pin).toBe('***');
      expect(masked.items[1].token).toBe('***');

      // Campos no sensibles preservados intactos
      expect(masked.email).toBe('cajero1@carniceria.com');
      expect(masked.perfil.nombre).toBe('Juan Carnicero');
      expect(masked.perfil.detalles.rol).toBe('cajero');
      expect(masked.items[0].producto).toBe('Lomo Fino');
      expect(masked.items[0].precio).toBe(38000);
    });

    it('debe manejar valores nulos, indefinidos y primitivos de forma segura', () => {
      expect(maskSensitiveData(null)).toBeNull();
      expect(maskSensitiveData(undefined)).toBeUndefined();
      expect(maskSensitiveData('texto plano')).toBe('texto plano');
      expect(maskSensitiveData(12345)).toBe(12345);
    });
  });

  describe('3. CanonicalLogInterceptor (Logs Canónicos Estructurados JSON)', () => {
    let interceptor: CanonicalLogInterceptor;
    let capturedLogs: CanonicalLogEntry[] = [];

    beforeEach(() => {
      interceptor = new CanonicalLogInterceptor();
      capturedLogs = [];
      CanonicalLogInterceptor.setLogWriter((entry) => {
        capturedLogs.push(entry);
      });
    });

    afterEach(() => {
      CanonicalLogInterceptor.resetLogWriter();
    });

    it('debe emitir exactamente una línea de log estructurado JSON al completarse la petición exitosa (200 OK)', (done) => {
      const mockReq: any = {
        method: 'POST',
        originalUrl: '/sales/sync',
        correlationId: 'trace-c1b2-uuid-456',
        tenantId: 'neg-1',
        user: {
          id: 'usr-9',
          negocioId: 'neg-1',
        },
        body: {
          loteId: 'lote-123',
          password: 'insecurePassword',
        },
      };

      const mockRes: any = {
        statusCode: 200,
      };

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
      } as unknown as ExecutionContext;

      const mockCallHandler: CallHandler = {
        handle: () => of({ success: true, count: 5 }),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(capturedLogs.length).toBe(1);
          const log = capturedLogs[0];

          expect(log.level).toBe('info');
          expect(typeof log.time).toBe('number');
          expect(log.correlation_id).toBe('trace-c1b2-uuid-456');
          expect(log.method).toBe('POST');
          expect(log.url).toBe('/sales/sync');
          expect(log.status).toBe(200);
          expect(typeof log.duration_ms).toBe('number');
          expect(log.duration_ms).toBeGreaterThanOrEqual(0);
          expect(log.tenant_id).toBe('neg-1');
          expect(log.user_id).toBe('usr-9');
          // Payload enmascarado
          expect(log.payload.loteId).toBe('lote-123');
          expect(log.payload.password).toBe('***');
          done();
        },
        error: (err) => done(err),
      });
    });

    it('debe emitir log con level error o warn cuando ocurre una excepción HTTP', (done) => {
      const mockReq: any = {
        method: 'GET',
        originalUrl: '/cash-shifts/current',
        correlationId: 'trace-err-789',
        headers: {},
      };

      const mockRes: any = {
        statusCode: 404,
      };

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
      } as unknown as ExecutionContext;

      const error = {
        status: 404,
        message: 'No existe un turno de caja abierto para este dispositivo.',
      };

      const mockCallHandler: CallHandler = {
        handle: () => throwError(() => error),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          done(new Error('No debió resolverse next'));
        },
        error: () => {
          expect(capturedLogs.length).toBe(1);
          const log = capturedLogs[0];
          expect(log.level).toBe('warn');
          expect(log.status).toBe(404);
          expect(log.correlation_id).toBe('trace-err-789');
          expect(log.error).toBe('No existe un turno de caja abierto para este dispositivo.');
          done();
        },
      });
    });
  });
});