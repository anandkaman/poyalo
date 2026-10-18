import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsInt, IsString, Min } from 'class-validator';
import request from 'supertest';
import { AppException } from '../src/common/app-exception';
import { Paginated } from '../src/common/envelope.interceptor';
import { Idempotent } from '../src/common/idempotency.interceptor';
import { RateLimit } from '../src/common/rate-limit.guard';
import { createTestApp, type TestApp } from './helpers/test-app';

class EchoDto {
  @IsString() name!: string;
  @IsInt() @Min(1) seats!: number;
}

let created = 0;

@Controller('test')
class TestController {
  @Get('items')
  items() {
    return new Paginated([{ id: 1 }], 'cursor-2');
  }

  @Get('boom')
  boom() {
    throw new AppException('OFFER_ALREADY_TAKEN', 'Someone else accepted', { offer_id: 'o1' });
  }

  @Get('crash')
  crash() {
    throw new Error('secret internals');
  }

  @Post('echo')
  echo(@Body() dto: EchoDto) {
    return dto;
  }

  @Post('trips')
  @Idempotent()
  createTrip(@Body() body: { quote_id: string }) {
    created += 1;
    return { trip_id: `t-${created}`, quote_id: body.quote_id };
  }

  @Get('limited')
  @RateLimit({ name: 'test', limit: 2, windowS: 60 })
  limited() {
    return 'ok';
  }
}

describe('API foundation (P0)', () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());

  beforeEach(async () => {
    created = 0;
    t = await createTestApp([TestController]);
  });
  afterEach(async () => t.app.close());

  describe('health', () => {
    it('GET /health is unversioned and live', async () => {
      const res = await http().get('/health').expect(200);
      expect(res.body.data).toEqual({ status: 'ok', mode: 'api' });
    });

    it('GET /health/ready reports dependencies', async () => {
      const ok = await http().get('/health/ready').expect(200);
      expect(ok.body.data.checks).toEqual({ postgres: 'ok', redis: 'ok' });

      t.redis.failPing = true;
      const down = await http().get('/health/ready').expect(503);
      expect(down.body.error.code).toBe('MAINTENANCE');
      expect(down.body.error.details.checks).toEqual({ postgres: 'ok', redis: 'fail' });
    });
  });

  describe('envelope & errors (docs/D3 §3)', () => {
    it('wraps data and echoes X-Request-Id', async () => {
      const res = await http()
        .get('/v1/test/items')
        .set('X-Request-Id', 'req-42')
        .set('X-Region', 'IN-CHN')
        .expect(200);
      expect(res.headers['x-request-id']).toBe('req-42');
      expect(res.body).toEqual({
        data: [{ id: 1 }],
        meta: { request_id: 'req-42', region: 'IN-CHN', next_cursor: 'cursor-2' },
      });
    });

    it('maps AppException to its code and status', async () => {
      const res = await http().get('/v1/test/boom').expect(409);
      expect(res.body.error).toEqual({
        code: 'OFFER_ALREADY_TAKEN',
        message: 'Someone else accepted',
        details: { offer_id: 'o1' },
      });
      expect(res.body.meta.request_id).toBeTruthy();
    });

    it('hides internals of unexpected errors', async () => {
      const res = await http().get('/v1/test/crash').expect(500);
      expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
    });

    it('returns NOT_FOUND for unknown routes', async () => {
      const res = await http().get('/v1/nope').expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns VALIDATION_FAILED with field details', async () => {
      const res = await http().post('/v1/test/echo').send({ name: 'x', seats: 0, extra: true }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(Object.keys(res.body.error.details.fields).sort()).toEqual(['extra', 'seats']);
    });
  });

  describe('idempotency (docs/D3 §2)', () => {
    it('requires the header', async () => {
      const res = await http().post('/v1/test/trips').send({ quote_id: 'q1' }).expect(400);
      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('replays the first response and runs the handler once', async () => {
      const send = () =>
        http()
          .post('/v1/test/trips')
          .set('Idempotency-Key', 'key-00000001')
          .set('X-Device-Id', 'd1')
          .send({ quote_id: 'q1' });
      const first = await send().expect(201);
      const second = await send().expect(201);
      expect(first.body.data).toEqual({ trip_id: 't-1', quote_id: 'q1' });
      expect(second.body.data).toEqual(first.body.data);
      expect(created).toBe(1);
    });

    it('rejects the same key with a different body', async () => {
      const post = (quote: string) =>
        http()
          .post('/v1/test/trips')
          .set('Idempotency-Key', 'key-00000002')
          .set('X-Device-Id', 'd1')
          .send({ quote_id: quote });
      await post('q1').expect(201);
      const res = await post('q2').expect(409);
      expect(res.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('keys are scoped per caller', async () => {
      const post = (device: string) =>
        http()
          .post('/v1/test/trips')
          .set('Idempotency-Key', 'key-00000003')
          .set('X-Device-Id', device)
          .send({ quote_id: 'q1' });
      await post('d1').expect(201);
      await post('d2').expect(201);
      expect(created).toBe(2);
    });
  });

  describe('rate limit (docs/D3 §6)', () => {
    it('blocks after the limit with Retry-After', async () => {
      const call = () => http().get('/v1/test/limited').set('X-Device-Id', 'd1');
      await call().expect(200);
      await call().expect(200);
      const res = await call().expect(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      await http().get('/v1/test/limited').set('X-Device-Id', 'd2').expect(200);
    });
  });
});
