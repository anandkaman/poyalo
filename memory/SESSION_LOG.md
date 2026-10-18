# memory/SESSION_LOG.md — what happened each working session (newest at bottom)

## S-001 — 2026-10-17
- Prompts: P-001 (kickoff), P-002 (continue).
- Researched Google Maps pricing (10k free/SKU/month, then ~$5/1k), Ola Maps free tier (500k–5M/month), Google Maps URLs/intents (no key needed).
- Wrote research/R1, R2; docs/D0–D9; todo; memory/*; prompts log; readme.
- Open: owner answers to D0 Q1–Q7. Next session: start P0 Foundation.
- P-003: the owner answered Q1–Q7. Added research/R3 (vehicle/service categories) and docs/D10 (Tamil theme + i18n).
  Updated D0, D2 (service_types, outstation fields, commission_rules, subscription_plans, rejection_penalty_rules, driver_penalties, two driver wallets),
  D3, D4 (§4 bonus deduction, §7 outstation), D5 (rewritten), D6, R2. DEC-013..018 added. New open items: Q8–Q10.
- P-004 ("ok go ahead"): built P0 Foundation.
  - Machine: Node 24, git, Java 17. **No Docker/Postgres/Redis; pnpm only via `corepack pnpm`** (turbo can't find it, so verify with `corepack pnpm -r run build|typecheck`).
  - Built: monorepo, contracts pkg, NestJS api skeleton, Prisma schema D2 §1–2 + init migration, docker-compose, OSRM script, CI.
  - Verified locally: build, typecheck, 18 tests, OpenAPI generation, prettier, prisma validate, boot smoke test (/health 200, /ready 503 without deps).
  - NOT verified: migration on a real DB, docker-compose, OSRM, CI workflow.
  - Incident: a broad `taskkill /IM node.exe` during the smoke test may have closed the user's other Node processes. Told the user. Rule saved: kill by PID only.
  - Not committed (the user hasn't asked).
- P-005: owner wants a no-Docker dev setup and shared a Redis Insight config (127.0.0.1:6379).
  - Found: native PG16 service running on 5432, without PostGIS. Nothing listening on 6379 (Redis Insight is just the client). No .NET SDK, no WSL distro.
  - Added infra/local/setup-db.sql, apps/api/scripts/doctor.js (+ `doctor` script), apps/api/.env (from .env.example), readme no-Docker section.
  - Waiting on the owner: install PostGIS, start a Redis server, run setup-db.sql (needs the postgres password).
    (Superseded by P-006: the project moved to a VPS with Docker.)

## S-002 — 2026-10-18
- P-006: the owner is moving the repo to a VPS (Docker available, "everything in dockerhub").
  - Added CLAUDE.md (agent handbook + owner rules), readme "Start here", apps/api/Dockerfile, .dockerignore, compose `api` service (profile `app`).
  - Security fix: compose ports were 0.0.0.0, now 127.0.0.1 (Redis has no password).
  - todo: new section "P0.5 VPS handoff verification" = the first thing to do on the VPS.
  - First commit pushed to https://github.com/anandkaman/poyalo (main). Commit identity: anandkaman <wenviatech@gmail.com> (repo-local config on the PC).
  - Still unverified: Docker image build, compose stack, migration on a real DB, CI.
