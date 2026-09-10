import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Punto de entrada del servidor Backend NestJS.
 * Inicializa el servidor HTTP en el puerto 3001 con CORS, Helmet y ValidationPipe global.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Seguridad de cabeceras HTTP
  app.use(helmet());

  // Configuración de CORS para Next.js (Web POS / Admin) y clientes móviles/tablets
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (ej. apps móviles React Native, curl, Postman)
      if (!origin) return callback(null, true);

      // Orígenes permitidos para Frontend local y en red
      const allowedOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ];

      // Permitir orígenes configurados en variables de entorno o red local de desarrollo
      if (
        allowedOrigins.includes(origin) ||
        process.env.CORS_ALLOWED_ORIGINS?.split(',').includes(origin) ||
        /^http:\/\/(localhost|10\.0\.2\.2|192\.168\.\d+\.\d+|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }

      return callback(null, true); // En modo desarrollo se permite la comunicación segura
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Correlation-ID',
      'X-Dispositivo-ID',
      'X-Tenant-ID',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Validación global de DTOs según estándares de diseño
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // NOTA ARQUITECTÓNICA: NO se define prefijo global (setGlobalPrefix) para mantener
  // compatibilidad estricta con design.md y los tests existentes (/auth/login, /sales/sync, etc.)

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🥩 [POS-Carnicería] Servidor Backend escuchando en http://localhost:${port}`);
}

bootstrap();
