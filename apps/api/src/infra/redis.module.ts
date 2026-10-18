import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, type Env } from '../config/env';

export const REDIS = Symbol('REDIS');

/** The subset of ioredis we use; makes it easy to swap in a fake in tests. */
export type RedisClient = Pick<Redis, 'get' | 'set' | 'del' | 'incr' | 'expire' | 'ttl' | 'ping' | 'quit'>;

@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: RedisClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      // lazyConnect: nothing connects until the first command, so OpenAPI generation and tests run without Redis.
      useFactory: (env: Env): RedisClient =>
        new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2, enableOfflineQueue: true }),
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}
