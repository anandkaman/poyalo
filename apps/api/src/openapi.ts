import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from './app.module';
import { buildOpenApi, configureApp } from './bootstrap';
import { loadEnv } from './config/env';

/**
 * Writes the OpenAPI spec to packages/contracts/openapi.json (docs/D3: one source of truth → TS & Kotlin clients).
 * Needs no running Postgres/Redis: both clients connect lazily.
 */
async function main(): Promise<void> {
  const env = loadEnv({
    DATABASE_URL: 'postgresql://openapi:openapi@localhost:5432/openapi',
    REDIS_URL: 'redis://localhost:6379',
    LOG_LEVEL: 'error',
    NODE_ENV: 'test',
    ...process.env,
  });
  const app = await NestFactory.create(AppModule.forRoot(env), { logger: false });
  configureApp(app, env);
  await app.init();

  const out = resolve(__dirname, '../../../packages/contracts/openapi.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(buildOpenApi(app), null, 2) + '\n');
  await app.close();
  console.log(`OpenAPI written to ${out}`);
}

void main();
