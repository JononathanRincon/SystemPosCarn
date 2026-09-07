import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { maskSensitiveData } from './masking.util';

export interface CanonicalLogEntry {
  level: 'info' | 'warn' | 'error';
  time: number;
  correlation_id: string;
  method: string;
  url: string;
  status: number;
  duration_ms: number;
  tenant_id: string | null;
  user_id: string | null;
  error?: string;
  payload?: any;
}

@Injectable()
export class CanonicalLogInterceptor implements NestInterceptor {
  private static logWriter: (entry: CanonicalLogEntry) => void = (entry) => {
    process.stdout.write(JSON.stringify(entry) + '\n');
  };

  /**
   * Permite sobreescribir el emisor de logs en tests unitarios para verificar la salida.
   */
  public static setLogWriter(writer: (entry: CanonicalLogEntry) => void): void {
    CanonicalLogInterceptor.logWriter = writer;
  }

  /**
   * Restablece el escritor por defecto a stdout.
   */
  public static resetLogWriter(): void {
    CanonicalLogInterceptor.logWriter = (entry) => {
      process.stdout.write(JSON.stringify(entry) + '\n');
    };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    return next.handle().pipe(
      tap({
        next: () => {
          this.emitLog(req, res, start);
        },
        error: (err) => {
          this.emitLog(req, res, start, err);
        },
      }),
    );
  }

  public emitLog(req: any, res: any, start: number, err?: any): CanonicalLogEntry {
    const durationMs = Date.now() - start;
    const status = err
      ? err.status || (typeof err.getStatus === 'function' ? err.getStatus() : null) || (res && res.statusCode) || 500
      : (res && res.statusCode) || 200;

    const correlationId =
      req?.correlationId ||
      req?.headers?.['x-correlation-id'] ||
      req?.headers?.['X-Correlation-ID'] ||
      'unknown-correlation-id';

    const tenantId =
      req?.tenantId ||
      req?.user?.negocioId ||
      req?.headers?.['x-tenant-id'] ||
      null;

    const userId = req?.user?.id || req?.user?.sub || req?.user?.usuarioId || null;

    const level: 'info' | 'warn' | 'error' =
      status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    const entry: CanonicalLogEntry = {
      level,
      time: Math.floor(Date.now() / 1000),
      correlation_id: String(correlationId),
      method: req?.method || 'UNKNOWN',
      url: req?.originalUrl || req?.url || '/',
      status,
      duration_ms: durationMs,
      tenant_id: tenantId ? String(tenantId) : null,
      user_id: userId ? String(userId) : null,
    };

    if (err && err.message) {
      entry.error = err.message;
    }

    if (req?.body && Object.keys(req.body).length > 0) {
      entry.payload = maskSensitiveData(req.body);
    }

    CanonicalLogInterceptor.logWriter(entry);
    return entry;
  }
}