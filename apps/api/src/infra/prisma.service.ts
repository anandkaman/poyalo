import { Global, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Prisma connects lazily on the first query; raw SQL is used where PostGIS needs it (docs/R2). */
@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
