# D7 — Scaling & Infrastructure (source of truth)

## 1. Stages

| Stage | Load | Infra | Est. cost/mo |
|---|---|---|---|
| **S0 Dev** | local | Docker Compose: postgres+postgis, redis, osrm (state extract), minio, mailpit | ₹0 |
| **S1 Launch** (1 city) | ≤ 2k drivers, ≤ 10k trips/day, ~500 pings/s | 2× app VM (api+realtime+worker containers) behind LB, managed Postgres (2 vCPU/8 GB + standby), managed Redis 2 GB, OSRM VM 16 GB, R2 | ~$400–700 |
| **S2 Multi-city** (≤ 10 cities) | ≤ 20k drivers, ≤ 100k trips/day, ~5k pings/s | Kubernetes (EKS/DOKS) with HPA: api ×3–10, realtime ×3–6, workers ×2–6; Postgres 8 vCPU + 2 read replicas + PgBouncer; Redis cluster; OSRM ×2 | ~$2–4k |
| **S3 Large** | 100k+ drivers | Split services: location (Go, MQTT/WebSocket gateway), dispatch, pricing, payments; Kafka; region-sharded Postgres (Citus); ClickHouse for analytics | — |

## 2. Scaling the hot paths
- **Location ingest** is the largest write load. Pings go to Redis only (GEOADD + HSET), never per-ping DB writes. Points for active trips are batched to Postgres every 30 s or at trip end.
  At S3 this moves to a dedicated Go gateway + Kafka topic `driver-locations`, partitioned by region.
- **Realtime:** Socket.IO pods behind sticky sessions (LB cookie or `transports: ['websocket']` only) + Redis adapter. Room fan-out stays inside the region.
- **Dispatch:** stateless workers; one job per trip; Redis locks. Queues are partitioned per region (`dispatch:{region}`) so one busy city cannot starve the others.
- **DB:** monthly partitions; hot indexes only; read replicas for history and admin; `statement_timeout` per role; connection pooling.
- **Caching:** region lookup by H3 cell, settings, fare configs (invalidated on change), autocomplete results (24 h), quotes.
- **OSRM:** CPU-bound and stateless, so add replicas behind an internal LB. Use the MLD algorithm for fast weekly re-imports. Profiles: `car` (auto/mini/sedan/suv), `bike` (a tuned motorbike profile).

## 3. Reliability
- Health/readiness probes; graceful shutdown drains sockets and finishes jobs.
- Circuit breakers + timeouts for every external call (OSRM 800 ms, Ola 1.5 s, Razorpay 5 s, MSG91 3 s).
- Outbox pattern for domain events → notifications/webhooks (no lost events if a pod dies).
- Backups: Postgres PITR (7–30 days), daily logical dump to R2. Redis is a cache plus rebuildable state (drivers re-ping within 10 s).
- RTO 1 h / RPO 5 min (S1). Runbooks live in `docs/runbooks/` (to be written).

## 4. Environments & delivery
`local → dev → staging → prod`. GitHub Actions: lint, typecheck, unit tests, integration tests (Testcontainers: PostGIS, Redis, OSRM fixture), build images, deploy.
DB migrations run as a separate job before the deploy, written to be backward compatible (expand/contract).
Android: Gradle CI → internal testing track on Play Console → production with staged rollout. Rider and driver apps have separate package IDs:
`in.poyalo.rider`, `in.poyalo.driver`.

## 5. Observability
- Metrics: request rate/latency/errors per route & region; `dispatch_time_to_match_seconds`, `offers_total{result}`, `active_trips`, `online_drivers`, `osrm_latency`, `ws_connections`.
- Alerts: match rate < 70% for 10 min in a region, OSRM error rate, payment webhook failures, SOS not acknowledged within 60 s.
- Tracing: OpenTelemetry → Tempo/Jaeger. Logs: Loki. Errors: Sentry. Uptime: external probe.

## 6. Load-test targets before launch (k6)
5k concurrent driver sockets each pinging every 4 s, 50 quotes/s, 10 trip requests/s. p95 match < 30 s, API p95 < 200 ms, zero lost assignments.
