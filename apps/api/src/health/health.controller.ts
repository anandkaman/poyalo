import { Controller, Get, HttpCode, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ENV, type Env } from '../config/env';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../infra/prisma.service';
import { REDIS, type RedisClient } from '../infra/redis.module';

type Check = 'ok' | 'fail';

async function probe(fn: () => Promise<unknown>, timeoutMs = 1500): Promise<Check> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    return 'ok';
  } catch {
    return 'fail';
  } finally {
    clearTimeout(timer);
  }
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: RedisClient,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Liveness: the process is up. No dependency checks. */
  @Get()
  live(): { status: 'ok'; mode: Env['MODE'] } {
    return { status: 'ok', mode: this.env.MODE };
  }

  /** Readiness: Postgres and Redis answer. The load balancer only sends traffic when this is 200. */
  @Get('ready')
  @HttpCode(200)
  async ready(): Promise<{ status: 'ok'; checks: Record<string, Check> }> {
    const [postgres, redis] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(() => this.redis.ping()),
    ]);
    const checks = { postgres, redis };
    if (postgres === 'fail' || redis === 'fail') {
      throw new AppException('MAINTENANCE', 'Dependencies not ready', { checks });
    }
    return { status: 'ok', checks };
  }
}
