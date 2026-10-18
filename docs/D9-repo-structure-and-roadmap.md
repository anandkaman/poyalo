# D9 — Repository Structure & Build Roadmap (source of truth)

## 1. Monorepo layout (target)
```
poyalo/
├─ readme.md                 project overview (kept up to date)
├─ todo                      task tracker (phase checklist)
├─ memory/                   project memory: decisions, context, session log
├─ prompts/PROMPT_LOG.md     every owner prompt, verbatim
├─ research/                 R* research notes (inputs)
├─ docs/                     D* source-of-truth specs (+ adr/, runbooks/)
├─ apps/
│  ├─ api/                   NestJS (MODE=api|realtime|worker)
│  ├─ web/                   Next.js: rider booking web, driver portal, landing pages
│  ├─ admin/                 Next.js: admin console
│  └─ android/               Gradle: core/, rider-app/, driver-app/
├─ packages/
│  ├─ contracts/             OpenAPI-generated TS types, error codes, socket event types
│  ├─ pricing/               pure fare functions (shared api + admin simulator)
│  ├─ geo/                   H3 helpers, polyline, haversine
│  ├─ ui/                    shared React components (web + admin)
│  └─ config/                eslint, tsconfig, prettier
├─ infra/
│  ├─ docker/                docker-compose.yml (postgis, redis, osrm, minio, mailpit)
│  ├─ osrm/                  extract scripts (Geofabrik → osrm-extract/partition/customize)
│  ├─ terraform/             cloud infra
│  └─ k8s/                   helm charts (S2)
└─ .github/workflows/        CI
```

## 2. Roadmap (phases → exit criteria)

| Phase | Name | Scope | Exit criteria |
|---|---|---|---|
| **P0** | Foundation | Monorepo, Docker Compose, OSRM with an India/Telangana extract, NestJS skeleton (config, logging, errors, envelope, headers, idempotency, rate limit), Prisma + PostGIS migrations, CI | `docker compose up` + `/health` green; OSRM answers `/route` |
| **P1** | Identity & geo | OTP auth (MSG91 + dev stub), JWT/refresh, users/riders/drivers, regions/zones/vehicle types, settings service, admin login + RBAC skeleton | Can log in as rider/driver/admin; serviceability endpoint works |
| **P2** | Pricing & quotes | `packages/pricing`, fare configs, quote endpoint (OSRM), maps provider abstraction (OSRM + Ola autocomplete), admin pricing CRUD + simulator | Quote for A→B in < 300 ms with breakdown |
| **P3** | Dispatch & trips | Realtime gateway, driver location ingest, Redis GEO, dispatch worker, offers, **3-rejection rule**, state machine, OTP start, completion with `/match` | End-to-end trip with simulated drivers (script) |
| **P4** | Driver Android | Onboarding + doc upload, online/offline foreground service, offer screen with countdown, Google Maps intent navigation, trip flow, earnings | A real phone completes a trip |
| **P5** | Rider Android + Web | Booking, live tracking (MapLibre), cancel, rate, history; web booking parity; driver web portal (docs/earnings) | Rider books on app & web |
| **P6** | Payments | Razorpay UPI/card, webhooks, ledger, wallets, cash flow, receipts, refunds, payouts (RazorpayX) | Money reconciles: ledger balanced, test payouts |
| **P7** | Admin console | All D6 screens, live map, KYC queue, audit, maker-checker | Ops can run a city from the console |
| **P8** | Growth & safety | Promos, referrals, incentives, SOS, share trip, support tickets, surge auto | — |
| **P9** | Hardening & launch | Load tests (k6), security review, observability/alerts, staging soak, Play Store release, runbooks | D7 §6 targets met |

Phases P4/P5/P7 can run in parallel once the P3 APIs are stable (contracts first).

## 3. Definition of done (every task)
Code + unit tests, plus integration tests on touched endpoints, OpenAPI updated, docs updated if behavior changed, `todo` ticked, `memory/` updated if a decision was made.
