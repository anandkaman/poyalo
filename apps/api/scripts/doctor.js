// Checks that local dev dependencies are reachable: `pnpm --filter @poyalo/api doctor`
// Reads apps/api/.env (via --env-file-if-exists). Exits 1 if anything required is missing.
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

const results = [];
const check = async (name, required, fn) => {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (err) {
    const lines = String(err.message)
      .trim()
      .split('\n')
      .filter((l) => l.trim());
    results.push({ name, ok: false, required, detail: lines.pop() ?? String(err) });
  }
};

async function main() {
  const prisma = new PrismaClient();
  await check('postgres', true, async () => {
    const [row] =
      await prisma.$queryRaw`SELECT current_database() AS db, current_user AS usr, version() AS v`;
    return `${row.usr}@${row.db} · ${row.v.split(',')[0]}`;
  });
  await check('postgis', true, async () => {
    const [row] = await prisma.$queryRaw`SELECT extversion FROM pg_extension WHERE extname = 'postgis'`;
    if (!row) throw new Error('extension not created in this database (run infra/local/setup-db.sql)');
    return `postgis ${row.extversion}`;
  });
  await check('migrations', false, async () => {
    const rows =
      await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at`;
    return `${rows.length} applied`;
  });
  await prisma.$disconnect();

  const redis = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  redis.on('error', () => undefined);
  await check('redis', true, async () => {
    await redis.connect();
    const info = await redis.info('server');
    const version = /redis_version:(\S+)/.exec(info)?.[1] ?? '?';
    await redis.geoadd('doctor:geo', 80.2707, 13.0827, 'chennai');
    const near = await redis.geosearch('doctor:geo', 'FROMLONLAT', 80.27, 13.08, 'BYRADIUS', 5, 'km', 'ASC');
    await redis.del('doctor:geo');
    return `v${version} · GEO ok (${near.length} hit)`;
  });
  redis.disconnect();

  await check('osrm', false, async () => {
    const url = `${process.env.OSRM_CAR_URL}/route/v1/driving/80.2707,13.0827;80.2209,13.0067?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    const body = await res.json();
    if (body.code !== 'Ok') throw new Error(body.code);
    return `${(body.routes[0].distance / 1000).toFixed(1)} km Chennai Central → T Nagar`;
  });

  for (const r of results) {
    const mark = r.ok ? '✔' : r.required ? '✘' : '–';
    console.log(`${mark} ${r.name.padEnd(11)} ${r.detail}`);
  }
  process.exit(results.some((r) => !r.ok && r.required) ? 1 : 0);
}

main();
