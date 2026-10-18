# R2 — Tech stack & third-party vendors

Goal: **midrange** (one city growing to ~10 cities, roughly 10k–100k trips/day), **scalable later** without a rewrite,
buildable by a small team. Market: **India** (confirmed). The name "Poyalo" is Tamil; theme in `docs/D10`. No city is hard-coded.

## Chosen stack

| Layer | Choice | Why | Rejected alternatives |
|---|---|---|---|
| Backend language | **TypeScript (Node 22 LTS)** | Same language as web; big hiring pool; fast to build | Go (faster, but two languages), Java/Spring (heavy) |
| Backend framework | **NestJS**, as a **modular monolith** | Clear module boundaries that can become separate services later | Express (no structure), microservices on day 1 (too much ops) |
| ORM / migrations | **Prisma** for CRUD + raw SQL for PostGIS | Type-safe; raw SQL where geo needs it | TypeORM |
| Primary DB | **PostgreSQL 16 + PostGIS** | Region polygons, geo queries, strong consistency for money | MongoDB (weak for ledgers) |
| Hot geo state / cache / queues | **Redis 7** (GEO sets, pub/sub, streams, BullMQ) | Nearest-driver lookup in under 1 ms; job queues | — |
| Geo indexing | **Uber H3** (res 8 for surge cells, res 9 for demand heatmap) | Same hexagons in analytics and pricing | Geohash |
| Realtime | **Socket.IO** + Redis adapter (horizontal scale) | Reconnects and fallbacks built in; Android client available | Raw WS, MQTT (possible later for driver pings) |
| Event bus (phase 2 of scale) | Redis Streams → **Redpanda/Kafka** when needed | Start simple | — |
| Web (rider + driver portal) | **Next.js 15 (React, TS)**, Tailwind, MapLibre GL | SSR for SEO landing pages, booking web app | — |
| Admin console | **Next.js** separate app, shadcn/ui, TanStack Table | Admin is internal and kept apart from the public app | React-Admin |
| Android | **Kotlin + Jetpack Compose**, multi-module: `core`, `rider-app`, `driver-app` | The driver app needs reliable background location (foreground service) | Flutter/RN (background GPS is less reliable) |
| Android libs | Hilt, Retrofit+OkHttp, Room, WorkManager, Socket.IO-client-java, MapLibre Native, FusedLocationProvider | Standard choices | — |
| Monorepo | **pnpm + Turborepo** (TS apps + shared `packages/contracts`); Android in `apps/android` (Gradle) | Shared API types | Nx |
| API contract | **OpenAPI 3.1** generated from NestJS → TS client + Kotlin client (openapi-generator) | One source of truth for request/response shapes | GraphQL (harder to cache, rate-limit, scope by region) |
| Object storage | **Cloudflare R2** / S3 (driver KYC docs, profile photos) | R2 has no egress fees | — |

## Vendors (India)

| Need | Primary | Fallback / notes |
|---|---|---|
| OTP SMS | **MSG91** (DLT-registered templates) | Twilio Verify; WhatsApp OTP via Gupshup later |
| Push | **Firebase Cloud Messaging** (free) | — |
| Payments (UPI, cards, wallets) | **Razorpay** (Orders + UPI intent + webhooks) | Cashfree / PhonePe PG |
| Driver payouts | **RazorpayX Payouts** | Cashfree Payouts |
| KYC (DL, RC, Aadhaar/PAN) | **IDfy / Signzy / HyperVerge** API, manual admin review in v1 | DigiLocker |
| Maps | See `R1` (OSRM + Ola Maps + Google app intents) | — |
| Email | AWS SES / Resend | — |
| Error tracking | **Sentry** (backend, web, Android) | — |
| Metrics/logs | **Prometheus + Grafana + Loki** (self-hosted) or Grafana Cloud free tier | — |
| Feature flags | DB-backed `platform_settings` (built in-house, region-scoped) | Unleash |
| Masked calling (rider↔driver) | Exotel / Knowlarity virtual numbers | Phase 2 |

## Hosting

- **Region:** AWS `ap-south-1` (Mumbai), or DigitalOcean BLR1 to keep it cheap. India data-locality rules apply to payment data.
- **Stage 1 (launch, one city):** 1 app VM ×2 (or ECS Fargate), managed Postgres (RDS/DO), managed Redis, OSRM VM. About $300–600/month.
- **Stage 2 (multi-city):** Kubernetes (EKS/DOKS), HPA on API + realtime pods, Postgres read replicas, partitioned tables, PgBouncer.
- **Stage 3:** split services (dispatch, location, pricing, payments) and add Kafka. See `docs/D7-scaling-infra.md`.
- CI/CD: GitHub Actions → container registry → deploy. IaC: Terraform.
