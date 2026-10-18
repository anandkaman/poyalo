# CLAUDE.md — agent handbook for Poyalo (read fully before doing anything)

Poyalo is an Uber/Ola-style ride-hailing platform for **India**. The name is Tamil, the theme is Tamil-inspired, and the UI is English for now.
Actors: rider (Android + web), driver (Android + web portal), admin (web only). Two services: **city** and **outstation**.
The owner (GitHub `anandkaman`) gives short prompts, often with typos. Interpret the intent, and ask when something is genuinely ambiguous.

## 1. Every session: resume like this

1. Read **`memory/CONTEXT.md`** (current facts, decisions, conventions). It is short.
2. Read **`todo`** (no extension; the phase checklist). Items marked ⚠ are written but not yet verified.
3. Read the last entry of **`memory/SESSION_LOG.md`** and the last 2 prompts in **`prompts/PROMPT_LOG.md`**.
4. Open the spec in `docs/` for whatever you touch (index in `readme.md`). **Docs are the source of truth.**

## 2. Standing rules from the owner (non-negotiable)

- **Log every owner prompt verbatim** (typos included) at the bottom of `prompts/PROMPT_LOG.md` as `## P-### — date — title`, then `> prompt`, then a `**Done:**` line. Next number after the last one.
- **Keep `readme.md`, `todo`, `memory/CONTEXT.md`, `memory/SESSION_LOG.md` current** at the end of every piece of work. Record decisions in `memory/DECISIONS.md` (append-only, `DEC-###`).
- **Nothing hard-coded:** no cities/regions in code or seeds (admins create them). Commission, subscriptions, rejection penalties, fares, limits: all admin-configurable data (docs/D5, D6).
- If a behavior changes, update the relevant `docs/D*` file in the same change.
- Stop processes **only by exact PID**. Never kill by image name (e.g. `pkill node`, `taskkill /IM node.exe`). It once killed the owner's other processes.
- Docker ports bind to **127.0.0.1** only (this runs on a VPS). Never publish Postgres/Redis to `0.0.0.0`.
- Never commit secrets (`.env` files are git-ignored; only `.env.example` is tracked).
- Commit/push only when the owner asks, or when the task is clearly "push this". End commit messages with the attribution line the harness gives you.
- Report honestly: say what was verified and what was not.

## 3. Where things are

| Path                    | What                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `docs/D0…D10`           | Specs: requirements, architecture, DB schema, API, dispatch, pricing, admin, scaling, security, roadmap, theme |
| `research/R1…R3`        | Research inputs (maps cost, stack/vendors, vehicle/service categories)                                         |
| `todo`                  | Phase checklist P0…P9                                                                                          |
| `memory/`               | CONTEXT (facts), DECISIONS (ADR log), SESSION_LOG (what happened)                                              |
| `prompts/PROMPT_LOG.md` | Owner prompts, verbatim                                                                                        |
| `apps/api`              | NestJS backend, one image with `MODE=api\|realtime\|worker`                                                    |
| `packages/contracts`    | Shared headers, error codes, envelope, enums, generated `openapi.json`                                         |
| `packages/config`       | Shared tsconfig                                                                                                |
| `infra/docker`          | Compose stack (postgis, redis, minio, mailpit, api, osrm)                                                      |
| `infra/osrm`            | Routing data build script                                                                                      |
| `infra/local`           | No-Docker Windows setup (owner's PC only)                                                                      |

## 4. Run it (VPS with Docker)

```bash
corepack enable                       # provides pnpm 9 (version pinned in package.json)
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d          # postgres+postgis, redis, minio, mailpit
cp .env.example apps/api/.env
pnpm --filter @poyalo/api prisma:migrate                         # apply migrations
pnpm --filter @poyalo/api doctor                                 # ✔ postgres, postgis, redis (+GEO)
pnpm --filter @poyalo/api dev                                    # http://127.0.0.1:3000/health, Swagger at /docs
# containerised api:
docker compose -f infra/docker/docker-compose.yml --profile app up -d --build
```

Verify a change: `pnpm build && pnpm typecheck && pnpm test && pnpm format:check`.
Tests need no infra: they boot the real AppModule with in-memory fakes (`apps/api/test/helpers`).

## 5. Code conventions

- DB columns are snake_case, the same names as the API JSON. Prisma models are PascalCase with `@@map`. IDs: `@default(uuid(7))`. Money: BigInt paise. Times: timestamptz.
- PostGIS columns: `Unsupported("geography(...)")` + `@@index([col], type: Gist)`. Rows with them are written with raw SQL.
- **New migration:** edit `schema.prisma`, then generate SQL with
  `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url $SHADOW_URL --script`
  into `prisma/migrations/<timestamp>_<name>/migration.sql`, then append hand-written SQL that Prisma can't express
  (`NULLS NOT DISTINCT`, CHECKs, partitions). Never edit an applied migration.
- Errors: `throw new AppException('CODE', 'message', details)`. Codes live in `packages/contracts/src/errors.ts` (never rename one).
- Money/trip POSTs: `@Idempotent()`. Sensitive routes: `@RateLimit({ name, limit, windowS })`. Parsed D3 headers are in `req.ctx`.
- Responses are wrapped automatically as `{data, meta}`. Return `new Paginated(items, cursor)` for lists.
- After changing endpoints: `pnpm --filter @poyalo/api build && pnpm --filter @poyalo/api openapi` and commit `packages/contracts/openapi.json` (CI checks it is fresh).
- Formatting: Prettier (`pnpm format`). Docs/memory/prompts are excluded from Prettier on purpose.

## 6. Current state → see `memory/CONTEXT.md` "Status" and `todo` (do not duplicate it here).
