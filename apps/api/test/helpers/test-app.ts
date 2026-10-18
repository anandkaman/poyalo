import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/bootstrap';
import { loadEnv } from '../../src/config/env';
import { PrismaService } from '../../src/infra/prisma.service';
import { REDIS } from '../../src/infra/redis.module';
import { FakeRedis } from './fake-redis';

export class FakePrisma {
  failQuery = false;
  async $queryRaw(): Promise<unknown> {
    if (this.failQuery) throw new Error('db down');
    return [{ '?column?': 1 }];
  }
  async $disconnect(): Promise<void> {}
}

export interface TestApp {
  app: INestApplication;
  redis: FakeRedis;
  prisma: FakePrisma;
}

/** Boots the real AppModule with in-memory Redis/Prisma stand-ins, so tests need no infrastructure. */
export async function createTestApp(extraControllers: Type[] = []): Promise<TestApp> {
  const env = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  });
  const redis = new FakeRedis();
  const prisma = new FakePrisma();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(env)],
    controllers: extraControllers,
  })
    .overrideProvider(REDIS)
    .useValue(redis.asClient())
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, env);
  await app.init();
  return { app, redis, prisma };
}
