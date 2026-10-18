import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { REDIS, type RedisClient } from '../infra/redis.module';
import { AppException } from './app-exception';
import { principalKey } from './principal';

const RATE_LIMIT = 'poyalo:rate-limit';

export interface RateLimitOptions {
  /** Bucket name, e.g. 'otp-request' or 'quotes'. */
  name: string;
  limit: number;
  windowS: number;
}

/** Fixed-window limit per caller (docs/D3 §6). Defaults live here; region-level overrides come with the settings service (P1). */
export const RateLimit = (options: RateLimitOptions): MethodDecorator => SetMetadata(RATE_LIMIT, options);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.get<RateLimitOptions | undefined>(RATE_LIMIT, context.getHandler());
    if (!opts) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const window = Math.floor(Date.now() / 1000 / opts.windowS);
    const key = `rl:${opts.name}:${principalKey(req)}:${window}`;

    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, opts.windowS);

    res.setHeader('X-RateLimit-Limit', String(opts.limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, opts.limit - count)));

    if (count > opts.limit) {
      const retryAfter = opts.windowS - (Math.floor(Date.now() / 1000) % opts.windowS);
      res.setHeader('Retry-After', String(retryAfter));
      throw new AppException('RATE_LIMITED', 'Too many requests', { retry_after_s: retryAfter });
    }
    return true;
  }
}
