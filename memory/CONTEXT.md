# memory/CONTEXT.md — project memory (read this first in every session)

Short, current facts. Specs live in `docs/`. This file holds the *why*, the defaults in effect, and where things stand.

## Project
- **Poyalo** (Tamil name): Uber-like ride hailing in **India**. Actors: rider (Android + web), driver (Android + web portal), admin (web only).
- Goal: midrange (many cities), scalable, ~₹0 map cost per trip. **No city hard-coded.** Regions are created in admin; seeds hold only country/service/vehicle defaults.
- English UI now, i18n-ready (strings in resource files, `name_i18n` jsonb). Tamil-inspired theme (D10: maroon/turmeric/banana-leaf/jasmine, kolam motifs, Catamaran + Mukta Malar fonts).
- Owner: wenviatech@gmail.com. Every owner prompt is logged in `prompts/PROMPT_LOG.md`.

## Key decisions (details in DECISIONS.md)
- Stack: NestJS (TS) modular monolith · Postgres16+PostGIS · Redis · Socket.IO · Next.js (web, admin) · Kotlin/Compose (two Android apps) · pnpm+Turborepo.
- Maps: OSRM self-hosted (distance/ETA/matrix/map-match) · Ola Maps (autocomplete) · Google Maps **app intent / Maps URL** for driver navigation (free) · MapLibre for display.
- API: REST `/v1/{auth|public|rider|driver|admin}` + Socket.IO; headers `X-Client`, `X-App-Version`, `X-Region`, `Idempotency-Key`.
- **Two service types:** `city` (bike, auto, mini, sedan, suv) and `outstation` (one_way / round_trip, scheduled, claim-based dispatch; mini/sedan/suv).
- **Revenue:** commission on every trip + optional admin-defined subscription plans (priority boost → more trips, optional lower commission).
- **Rejections:** 3 free/day (region timezone), timeouts count; each further rejection deducts from the **bonus wallet** (admin rules). City offers only.
- **Cash & online:** cash → commission + tax auto-debited from the driver's earnings wallet; online → driver share credited. Netting, payouts, and a negative-balance limit (D5 §6).

## Open (non-blocking, defaults in D0): Q8 outstation exempt from the rejection rule · Q9 penalty capped at a ₹0 bonus balance · Q10 theme colors.

## Status
- 2026-10-17: Planning complete and owner answers merged (P-003).
- 2026-10-17: **P0 Foundation code done** (P-004). Migration, compose, OSRM, CI are unverified (the PC had no Docker).
- 2026-10-18: **Moved to the owner's VPS** (P-006). Repo: https://github.com/anandkaman/poyalo (branch `main`). The VPS has Docker, so use the compose stack.
  **Next:** `todo` → "P0.5 VPS handoff verification", then P1 Identity & geo.
- Agent rules live in `CLAUDE.md` (auto-loaded by Claude Code). The owner's earlier machine-local memory rules are copied there.

## Environments
- **VPS (primary from 2026-10-18):** Linux + Docker. Stack = `infra/docker/docker-compose.yml` (ports on 127.0.0.1). Details of the VPS (size, OS, domain) are not recorded yet; note them here when known.

## Old dev machine (owner's Windows PC), no Docker (P-005). Kept for reference
- PostgreSQL 16 is a native Windows service (`postgresql-x64-16`, port 5432, `C:\Program Files\PostgreSQL\16`). citext/pgcrypto present; **PostGIS not yet installed** (StackBuilder). Dev role/db is `poyalo/poyalo` via `infra/local/setup-db.sql`.
- Redis: the owner uses the Redis Insight extension (client) pointed at 127.0.0.1:6379, no auth. **No Redis server was running on 2026-10-17.**
- `pnpm --filter @poyalo/api doctor` checks postgres/postgis/migrations/redis(+GEO)/osrm.

## Codebase conventions (P0)
- DB columns are snake_case, the same names as the API JSON. Prisma models are PascalCase with `@@map`. IDs use `@default(uuid(7))`.
- PostGIS columns are `Unsupported(...)` + `@@index(..., type: Gist)`. Rows with them are written by raw SQL. Migrations are generated with `prisma migrate diff`, then hand additions (NULLS NOT DISTINCT, CHECK) are appended.
- Throw `AppException(code, message, details)`; codes live in `packages/contracts/src/errors.ts`.
- `@Idempotent()` on money/trip POSTs; `@RateLimit({name, limit, windowS})` on sensitive routes; `req.ctx` holds the parsed D3 headers.
- Tests boot the real AppModule with FakeRedis/FakePrisma (`test/helpers`), so they need no infra.
