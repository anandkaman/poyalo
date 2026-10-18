import type { RedisClient } from '../../src/infra/redis.module';

/** Minimal in-memory Redis for tests (only the commands RedisClient exposes). */
export class FakeRedis {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();
  failPing = false;

  private live(key: string) {
    const e = this.store.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return e;
  }

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ...args: (string | number)[]): Promise<'OK' | null> {
    const nx = args.includes('NX');
    const exIdx = args.indexOf('EX');
    const ttl = exIdx >= 0 ? Number(args[exIdx + 1]) : null;
    if (nx && this.live(key)) return null;
    this.store.set(key, { value, expiresAt: ttl ? Date.now() + ttl * 1000 : null });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    return keys.reduce((n, k) => n + (this.store.delete(k) ? 1 : 0), 0);
  }

  async incr(key: string): Promise<number> {
    const e = this.live(key);
    const next = (e ? Number(e.value) : 0) + 1;
    this.store.set(key, { value: String(next), expiresAt: e?.expiresAt ?? null });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const e = this.live(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const e = this.live(key);
    if (!e) return -2;
    return e.expiresAt === null ? -1 : Math.ceil((e.expiresAt - Date.now()) / 1000);
  }

  async ping(): Promise<string> {
    if (this.failPing) throw new Error('redis down');
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }

  asClient(): RedisClient {
    return this as unknown as RedisClient;
  }
}
