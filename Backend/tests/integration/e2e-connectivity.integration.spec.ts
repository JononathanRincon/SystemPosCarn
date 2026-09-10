import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { AppModule } from '../../src/app.module';
import { TokenService } from '../../src/modules/auth/application/services/token.service';

describe('TASK-31: Integración E2E y Conectividad Completa (NestJS AppModule)', () => {
  let app: INestApplication;
  let tokenService: TokenService;
  let cajeroToken: string;
  let duenoToken: string;

  const validSucursalId = 'a1b2c3d4-e5f6-4a1b-8c2d-1234567890ab';
  const validVentaId = 'f1e2d3c4-b5a6-4f1e-9d8c-7654321098fe';
  const validProductoId = 'b2c3d4e5-f6a1-4b2c-9d3e-2345678901bc';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DISABLE_REDIS = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Aplicar los mismos pipes globales que main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    );

    await app.init();

    tokenService = moduleFixture.get<TokenService>(TokenService);

    // Generar token para rol dueño para validar GET /dashboard/owner
    const duenoPayload = {
      sub: 'usr-dueno-01',
      email: 'dueno@carniceria.com',
      rol: 'dueno',
      negocioId: 'neg-1',
      sucursalId: validSucursalId,
    };
    const tokensDueno = await tokenService.generateTokenPair(duenoPayload);
    duenoToken = tokensDueno.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Autenticación POS por PIN (POST /auth/pin-login)', () => {
    it('debe responder HTTP 200 con { accessToken, refreshToken, sessionToken } ante PIN válido de 4 dígitos', async () => {
      const pinPayload = {
        sucursalId: validSucursalId,
        dispositivoId: 'caja-mostrador-01',
        pin: '1234',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/pin-login')
        .send(pinPayload)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.valid).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.nombre).toBe('Carlos Carnicero');
      expect(response.body.user.rol).toBe('Cajero');
      expect(typeof response.body.sessionToken).toBe('string');
      expect(typeof response.body.accessToken).toBe('string');
      expect(typeof response.body.refreshToken).toBe('string');

      cajeroToken = response.body.accessToken;
    });

    it('debe responder HTTP 400 ante un PIN con formato incorrecto (no 4 dígitos)', async () => {
      await request(app.getHttpServer())
        .post('/auth/pin-login')
        .send({
          sucursalId: validSucursalId,
          dispositivoId: 'caja-mostrador-01',
          pin: '12',
        })
        .expect(400);
    });
  });

  describe('2. Sincronización de Ventas Outbox (POST /sales/sync)', () => {
    const validCajeroId = 'c3d4e5f6-a1b2-4c3d-8e4f-3456789012cd';

    it('debe recibir lote de ventas offline de forma idempotente respondiendo HTTP 200', async () => {
      const syncBatchPayload = {
        dispositivoId: 'caja-mostrador-01',
        ventas: [
          {
            id: validVentaId,
            sucursalId: validSucursalId,
            cajeroId: validCajeroId,
            dispositivoId: 'caja-mostrador-01',
            subtotal: 195.0,
            descuento: 0,
            total: 195.0,
            metodoPago: 'efectivo',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [
              {
                productoId: validProductoId,
                cantidad: 1.0,
                precioUnitario: 195.0,
              },
            ],
            pagos: [
              {
                metodo: 'efectivo',
                monto: 195.0,
              },
            ],
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/sales/sync')
        .set('Authorization', `Bearer ${cajeroToken}`)
        .set('Idempotency-Key', 'idemp-sync-batch-001')
        .send(syncBatchPayload)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.procesadas).toBe(1);
      expect(response.body.duplicadasIgnoradas).toBe(0);
      expect(response.body.errores).toEqual([]);
    });

    it('debe ser idempotente si se reenvía la misma venta respondiendo HTTP 200 con duplicadasIgnoradas = 1', async () => {
      const syncBatchPayload = {
        dispositivoId: 'caja-mostrador-01',
        ventas: [
          {
            id: validVentaId,
            sucursalId: validSucursalId,
            cajeroId: validCajeroId,
            dispositivoId: 'caja-mostrador-01',
            subtotal: 195.0,
            descuento: 0,
            total: 195.0,
            metodoPago: 'efectivo',
            fechaHoraDispositivo: new Date().toISOString(),
            detalles: [
              {
                productoId: validProductoId,
                cantidad: 1.0,
                precioUnitario: 195.0,
              },
            ],
            pagos: [
              {
                metodo: 'efectivo',
                monto: 195.0,
              },
            ],
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/sales/sync')
        .set('Authorization', `Bearer ${cajeroToken}`)
        .set('Idempotency-Key', 'idemp-sync-batch-002')
        .send(syncBatchPayload)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.procesadas).toBe(0);
      expect(response.body.duplicadasIgnoradas).toBe(1);
    });
  });

  describe('3. Dashboard Ejecutivo para Dueño (GET /dashboard/owner)', () => {
    it('debe responder HTTP 200 con KPIs consolidados con token Bearer autorizado de Dueño', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/owner')
        .set('Authorization', `Bearer ${duenoToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty('ventasHoy');
      expect(response.body).toHaveProperty('ventasAyer');
      expect(response.body).toHaveProperty('comparativoSucursales');
      expect(response.body).toHaveProperty('desgloseMetodosPago');
      expect(response.body).toHaveProperty('syncTimestamp');
      expect(response.body.ventasHoy).toHaveProperty('totalVentas');
    });

    it('debe responder HTTP 401 si no se envía cabecera de autorización', async () => {
      await request(app.getHttpServer())
        .get('/dashboard/owner')
        .expect(401);
    });
  });
});
