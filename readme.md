# Poyalo 🚖

Ride-hailing platform (Uber/Ola/Rapido style), built midrange-first and designed to scale.

| Actor            | Clients                                         |
| ---------------- | ----------------------------------------------- |
| Rider (customer) | Android app · Website                           |
| Driver (partner) | Android app · Web portal (onboarding, earnings) |
| System admin     | Admin website only                              |

**Status (2026-10-18):** 🏗️ **P0 Foundation code done** (API skeleton, DB schema + migration, Docker stack, CI) and moved to the VPS.
**Next:** verify the ⚠ items on the VPS (Docker stack, migration, CI), then **P1 Identity & geo**. See [todo](todo).

## 👉 Start here (new agent or contributor)

1. Read **[CLAUDE.md](CLAUDE.md)**: the standing rules (log every prompt, keep the docs current, no hard-coding) and how to run and verify.
2. Read **[memory/CONTEXT.md](memory/CONTEXT.md)** (current state + decisions) and **[todo](todo)** (what's done and next).
3. Skim the last entry of [memory/SESSION_LOG.md](memory/SESSION_LOG.md) and of [prompts/PROMPT_LOG.md](prompts/PROMPT_LOG.md).
4. Bring up the stack (below), run `pnpm --filter @poyalo/api doctor`, and continue from the first unchecked item in `todo`.

## Highlights

- **India, any city:** no city is hard-coded. Ops draw a region in the admin console and switch it on.
- **Two services:** **City** (bike, auto, mini, sedan, SUV) and **Outstation** (one-way / round trip, schedulable).
- **Driver money:** commission per trip + optional subscription plans (more trips). Cash trips auto-deduct commission from earnings.
  3 free rejections/day, after which each rejection deducts from bonus earnings. All of it is admin-configurable.
- **Tamil-inspired look** (maroon, turmeric, banana-leaf green, kolam motifs). English now, multi-language ready.
- **~₹0 map cost per trip:** self-hosted OSRM for distance/ETA/matching, Ola Maps free tier for search, and driver turn-by-turn through the **Google Maps app (free intent, no API key)**. MapLibre for maps.
- **Region-first:** service-area polygons, zones (airport, etc.), pricing per region × vehicle type × zone, settings per region.
- **Dispatch:** nearest driver by real road ETA, one offer at a time (city). Outstation bookings are claimed by drivers.
- **Stack:** NestJS + PostgreSQL/PostGIS + Redis + Socket.IO · Next.js (web & admin) · Kotlin/Compose (rider & driver apps).

## Where things are

| Path                                           | What                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [docs/](docs/)                                 | **Source of truth**: specs D0–D10                                                                                    |
| [research/](research/)                         | Research notes R1–R3 (inputs to the docs)                                                                            |
| [todo](todo)                                   | Task tracker by phase                                                                                                |
| [memory/](memory/)                             | Project memory: [CONTEXT](memory/CONTEXT.md), [DECISIONS](memory/DECISIONS.md), [SESSION_LOG](memory/SESSION_LOG.md) |
| [prompts/PROMPT_LOG.md](prompts/PROMPT_LOG.md) | Every owner prompt, verbatim                                                                                         |

### Docs index

- [D0 Product requirements](docs/D0-product-requirements.md) (owner decisions Q1–Q7 + open Q8–Q10)
- [D1 Architecture](docs/D1-architecture.md)
- [D2 Database schema](docs/D2-database-schema.md)
- [D3 API design](docs/D3-api-design.md)
- [D4 Trip lifecycle & dispatch](docs/D4-trip-lifecycle-dispatch.md)
- [D5 Pricing engine](docs/D5-pricing-engine.md)
- [D6 Admin & platform controls](docs/D6-admin-platform-controls.md)
- [D7 Scaling & infra](docs/D7-scaling-infra.md)
- [D8 Security & compliance](docs/D8-security-compliance.md)
- [D9 Repo structure & roadmap](docs/D9-repo-structure-and-roadmap.md)
- [D10 Brand, theme & localization](docs/D10-brand-theme.md)

## Getting started (backend, VPS / Linux with Docker)

Needs Node 22+ and Docker with Compose. All service images come from public registries (Docker Hub, plus GHCR for OSRM).
pnpm comes through corepack (`corepack enable`).

```bash
git clone https://github.com/anandkaman/poyalo.git && cd poyalo
corepack enable && pnpm install
pnpm infra:up                                   # postgres+postgis, redis, minio, mailpit (bound to 127.0.0.1)
cp .env.example apps/api/.env
pnpm --filter @poyalo/api prisma:migrate        # apply migrations
pnpm --filter @poyalo/api doctor                # checks postgres, postgis, redis(+GEO), osrm
pnpm --filter @poyalo/api dev                   # http://127.0.0.1:3000/health · Swagger at /docs
pnpm test                                       # runs without any infra (in-memory fakes)

# api as a container instead of `dev`:
docker compose -f infra/docker/docker-compose.yml --profile app up -d --build
# routing (optional, ~1 GB download, needs ~8–16 GB RAM to build):
bash infra/osrm/prepare.sh && docker compose -f infra/docker/docker-compose.yml --profile osrm up -d
```

All ports bind to 127.0.0.1. To make the API public, put a TLS reverse proxy (Caddy/Nginx) in front of port 3000.

| Path                                     | What                                                         |
| ---------------------------------------- | ------------------------------------------------------------ |
| [apps/api](apps/api)                     | NestJS backend (`MODE=api\|realtime\|worker`)                |
| [packages/contracts](packages/contracts) | Shared headers, error codes, envelope, enums, `openapi.json` |
| [packages/config](packages/config)       | Shared tsconfig                                              |
| [infra/](infra)                          | Docker Compose, OSRM build script                            |

### Local dev without Docker (owner's Windows PC only)

1. **PostgreSQL 16** (native) + **PostGIS**: run `C:\Program Files\PostgreSQL\16\bin\stackbuilder.exe` → PostgreSQL 16 → _Spatial Extensions_ → **PostGIS 3.x Bundle**.
2. Create the dev role/database/extensions (asks for the `postgres` password):
   `"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -f infra/local/setup-db.sql`
3. **Redis** on `127.0.0.1:6379` (e.g. Memurai Developer, a Redis-compatible Windows service). Redis Insight can then connect to it.
4. `cp .env.example apps/api/.env`, then `pnpm --filter @poyalo/api doctor` should show ✔ for postgres, postgis, redis.
5. `pnpm --filter @poyalo/api prisma:migrate` and then `pnpm --filter @poyalo/api dev`.

## Roadmap

P0 Foundation → P1 Identity & geo → P2 Pricing & quotes → P3 Dispatch & trips → P4 Driver app → P5 Rider app + web → P6 Payments → P7 Admin console → P8 Growth & safety → P9 Hardening & launch.

## Working rules

The full list is in [CLAUDE.md](CLAUDE.md) §2. In short:

1. Docs are the source of truth. If a behavior changes, update the doc in the same change.
2. Log every owner prompt in `prompts/PROMPT_LOG.md`.
3. Keep `todo`, `memory/`, and this readme current.
4. Nothing hard-coded (cities, fares, commissions, limits are admin data).
