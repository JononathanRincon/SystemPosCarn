import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse<Response>();
    const retryAfter = Math.max(1, Math.ceil((throttlerLimitDetail?.timeToBlockExpire || 60000) / 1000));

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Retry-After', String(retryAfter));
    }

    throw new ThrottlerException(
      `Límite de peticiones excedido. Demasiadas peticiones. Intente nuevamente en ${retryAfter} segundos.`,
    );
  }
}