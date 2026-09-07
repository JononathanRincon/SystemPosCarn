import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingHeader =
      req.headers['x-correlation-id'] ||
      req.headers['X-Correlation-ID'] ||
      (req.headers as any)[CORRELATION_ID_HEADER.toLowerCase()];

    const correlationId =
      typeof existingHeader === 'string' && existingHeader.trim().length > 0
        ? existingHeader.trim()
        : crypto.randomUUID();

    (req as any).correlationId = correlationId;
    req.headers['x-correlation-id'] = correlationId;

    if (res && typeof res.setHeader === 'function') {
      res.setHeader(CORRELATION_ID_HEADER, correlationId);
    }

    next();
  }
}