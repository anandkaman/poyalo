import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { Headers } from '@poyalo/contracts';
import { from, of, type Observable, switchMap, tap, catchError, throwError } from 'rxjs';
import { ENV, type Env } from '../config/env';
import { REDIS, type RedisClient } from '../infra/redis.module';
import { AppException } from './app-exception';
import { principalKey } from './principal';

const IDEMPOTENT = 'poyalo:idempotent';
const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

/** Marks a money/trip-mutating route: `Idempotency-Key` is required, and replays get the stored response (docs/D3 §2). */
export const Idempotent = (): MethodDecorator => SetMetadata(IDEMPOTENT, true);

interface StoredEntry {
  state: 'pending' | 'done';
  fingerprint: string;
  body?: unknown;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: RedisClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.reflector.get<boolean>(IDEMPOTENT, context.getHandler())) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers[Headers.idempotencyKey];
    const key = Array.isArray(raw) ? raw[0] : raw;
    if (!key || !KEY_RE.test(key)) {
      throw new AppException('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header (8-128 chars) is required');
    }

    const redisKey = `idem:${principalKey(req)}:${key}`;
    const fingerprint = createHash('sha256')
      .update(`${req.method} ${req.path} ${JSON.stringify(req.body ?? null)}`)
      .digest('hex');
    const ttl = this.env.IDEMPOTENCY_TTL_S;

    return from(this.claim(redisKey, fingerprint, ttl)).pipe(
      switchMap((existing) => {
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            throw new AppException(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency-Key was already used with a different request',
            );
          }
          if (existing.state === 'pending') {
            throw new AppException(
              'IDEMPOTENCY_CONFLICT',
              'A request with this Idempotency-Key is still in progress',
            );
          }
          return of(existing.body);
        }
        return next.handle().pipe(
          tap((body) => {
            const done: StoredEntry = { state: 'done', fingerprint, body };
            void this.redis.set(redisKey, JSON.stringify(done), 'EX', ttl);
          }),
          // A failed attempt must not block a retry with the same key.
          catchError((err: unknown) =>
            from(this.redis.del(redisKey)).pipe(switchMap(() => throwError(() => err))),
          ),
        );
      }),
    );
  }

  /** Returns null if we now own the key, otherwise the stored entry. */
  private async claim(redisKey: string, fingerprint: string, ttl: number): Promise<StoredEntry | null> {
    const pending: StoredEntry = { state: 'pending', fingerprint };
    const ok = await this.redis.set(redisKey, JSON.stringify(pending), 'EX', ttl, 'NX');
    if (ok === 'OK') return null;
    const stored = await this.redis.get(redisKey);
    if (!stored) return this.claim(redisKey, fingerprint, ttl); // expired between SET and GET
    return JSON.parse(stored) as StoredEntry;
  }
}
