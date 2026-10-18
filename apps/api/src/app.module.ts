import { type DynamicModule, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import type { IncomingMessage } from 'node:http';
import { Headers } from '@poyalo/contracts';
import { ENV, type Env } from './config/env';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { IdempotencyInterceptor } from './common/idempotency.interceptor';
import { RateLimitGuard } from './common/rate-limit.guard';
import { RequestContextMiddleware } from './common/request-context';
import { newId } from './common/ids';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './infra/prisma.service';
import { RedisModule } from './infra/redis.module';

/** Holds the validated Env (provided by AppModule.forRoot). */
@Module({})
class EnvModule {}

@Module({})
export class AppModule implements NestModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            genReqId: (req: IncomingMessage) => {
              const id = req.headers[Headers.requestId];
              return (Array.isArray(id) ? id[0] : id) || newId();
            },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            customProps: () => ({ mode: env.MODE }),
            transport:
              env.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
            autoLogging: env.NODE_ENV !== 'test',
          },
        }),
        { module: EnvModule, providers: [{ provide: ENV, useValue: env }], exports: [ENV], global: true },
        RedisModule,
        PrismaModule,
        // Feature modules (auth, geo, pricing, trips, dispatch, ...) are registered here from P1 on.
        // MODE decides which of them start background work (docs/D1 §1).
      ],
      controllers: [HealthController],
      providers: [
        // Order matters: the first interceptor is the outermost, so the envelope wraps replayed idempotent responses too.
        { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
        { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
