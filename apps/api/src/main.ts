import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildOpenApi, configureApp } from './bootstrap';
import { loadEnv } from './config/env';

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule.forRoot(env), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app, env);

  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, buildOpenApi(app));
  }

  // Every mode serves /health so orchestrators can probe it. Socket.IO (realtime) and BullMQ (worker) attach in P3.
  await app.listen(env.PORT);
  app.get(Logger).log(`poyalo ${env.MODE} listening on :${env.PORT}`);
}

void main();
