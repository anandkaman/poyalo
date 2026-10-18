import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
import { AppException } from './common/app-exception';
import type { Env } from './config/env';

function flatten(errors: ValidationError[], parent = ''): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of errors) {
    const path = parent ? `${parent}.${e.property}` : e.property;
    if (e.constraints) out[path] = Object.values(e.constraints);
    if (e.children?.length) Object.assign(out, flatten(e.children, path));
  }
  return out;
}

/** Shared HTTP setup for main.ts, the OpenAPI script and e2e tests. */
export function configureApp(app: INestApplication, env: Env): void {
  // Versioned business routes (docs/D3 §1); health stays unversioned for load balancers.
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new AppException('VALIDATION_FAILED', 'Request validation failed', { fields: flatten(errors) }),
    }),
  );
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.enableShutdownHooks();
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Poyalo API')
    .setDescription('Ride-hailing platform API. Conventions: docs/D3-api-design.md')
    .setVersion('v1')
    .addBearerAuth()
    .addGlobalParameters(
      {
        name: 'X-Client',
        in: 'header',
        required: false,
        schema: { type: 'string', enum: ['rider-android', 'driver-android', 'web', 'admin-web'] },
      },
      { name: 'X-App-Version', in: 'header', required: false, schema: { type: 'string' } },
      { name: 'X-Region', in: 'header', required: false, schema: { type: 'string', example: 'IN-CHN' } },
    )
    .build();
  return SwaggerModule.createDocument(app, config);
}
