import { loadEnv } from '../src/config/env';

describe('loadEnv', () => {
  const base = { DATABASE_URL: 'postgresql://a:b@localhost:5432/c', REDIS_URL: 'redis://localhost:6379' };

  it('applies defaults', () => {
    const env = loadEnv(base);
    expect(env.MODE).toBe('api');
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it('splits CORS origins', () => {
    expect(loadEnv({ ...base, CORS_ORIGINS: 'http://a.test, http://b.test' }).CORS_ORIGINS).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('fails fast with a readable message', () => {
    expect(() => loadEnv({ MODE: 'batch' })).toThrow(/MODE: Invalid enum value/);
    expect(() => loadEnv({ MODE: 'batch' })).toThrow(/DATABASE_URL: Required/);
  });
});
