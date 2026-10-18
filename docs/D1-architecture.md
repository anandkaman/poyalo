# D1 — System Architecture (source of truth)

## 1. High-level view

```
 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 │ Rider Android│  │Driver Android│  │ Web (Next.js)│  │ Admin (Next) │
 └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
        │ HTTPS REST + WebSocket (Socket.IO)│                 │
 ───────┴─────────────────┴─────────────────┴─────────────────┴────────
                 CDN / WAF (Cloudflare) → Load balancer (L7)
 ──────────────────────────────────────────────────────────────────────
  ┌───────────────────────── api (NestJS, stateless, N pods) ─────────┐
  │ auth │ users │ regions │ pricing │ trips │ dispatch │ payments    │
  │ drivers/kyc │ promotions │ ratings │ support │ admin │ settings   │
  └───────────────┬─────────────────────────────┬─────────────────────┘
  ┌───────────────┴──────────┐  ┌───────────────┴─────────────────────┐
  │ realtime (Socket.IO pods)│  │ workers (BullMQ): dispatch loop,     │
  │ + Redis adapter          │  │ offer timeouts, payouts, notifs,     │
  │ driver pings in/out      │  │ surge calc, doc expiry, reports      │
  └───────────────┬──────────┘  └───────────────┬─────────────────────┘
       ┌──────────┴───────┐   ┌───────────┐  ┌──┴──────────┐  ┌──────────┐
       │ Redis (GEO, pub/ │   │ Postgres  │  │ OSRM        │  │ R2 / S3  │
       │ sub, streams, Q) │   │ + PostGIS │  │ (self-host) │  │ KYC docs │
       └──────────────────┘   └───────────┘  └─────────────┘  └──────────┘
  External: MSG91 (OTP) · FCM (push) · Razorpay (pay/payout) · Ola Maps (search)
            · Google Maps app (driver navigation via intent, free) · Sentry
```

**One codebase, three run modes** of the same NestJS app: `MODE=api | realtime | worker`.
They scale separately and can later become separate services along the module lines.

## 2. Backend modules (bounded contexts)

| Module | Owns tables | Notes |
|---|---|---|
| `auth` | otp_requests, sessions, refresh_tokens | Phone OTP, JWT, device binding |
| `users` | users, riders, emergency_contacts, saved_places | |
| `drivers` | drivers, driver_documents, vehicles, driver_daily_stats | KYC, online state |
| `geo` | countries, regions, zones | Region lookup by lat/lng (PostGIS `ST_Contains`, cached by H3 cell in Redis) |
| `maps` | — | `MapsProvider` interface: OSRM / Ola / Google adapters |
| `pricing` | fare_configs, surge_rules, cancellation_policies, fare_quotes | Pure functions + versioned configs |
| `trips` | trips, trip_events, trip_stops, trip_routes | State machine (D4) |
| `dispatch` | trip_offers | Matching loop, rejection rule |
| `location` | (Redis only) + trip_location_points | Driver pings, ETA |
| `payments` | payments, wallets, ledger_entries, payouts, payment_methods | Double-entry ledger |
| `promotions` | promo_codes, promo_redemptions, referrals, incentives | |
| `ratings` | ratings | |
| `support` | support_tickets, sos_events | |
| `notifications` | notifications, device_tokens | FCM, SMS, email |
| `settings` | platform_settings, feature_flags | Scoped global→country→region |
| `admin` | admin_users, admin_roles, admin_permissions, audit_logs | RBAC, region-scoped |

Rule: modules talk through **service interfaces + domain events** (in-process EventEmitter now, Redis Streams/Kafka later), never through each other's tables.

## 3. Key flows

### Booking → dispatch
1. Rider `POST /v1/rider/quotes` → region resolved from pickup → OSRM `route(A,B)` → pricing → `fare_quote` (TTL 5 min) per vehicle type.
2. Rider `POST /v1/rider/trips {quote_id}` → trip `SEARCHING` → job `dispatch:trip:{id}`.
3. Dispatch worker: Redis `GEOSEARCH drivers:{region}:{vehicle_type} FROMLONLAT … BYRADIUS r` → filter (online, idle, not blocked, rejections < limit, KYC ok) → OSRM `/table` for real ETA → rank → offer to the best driver (one at a time; batch mode is an option later).
4. Offer sent over WebSocket + FCM high-priority push; timeout 15 s handled by a delayed BullMQ job.
5. Accept → **atomic lock** (Redis `SET trip:{id}:driver NX` + DB row update `WHERE status='SEARCHING'`) → `DRIVER_ASSIGNED`.
6. Reject/timeout → increment `driver_daily_stats.rejections` → next candidate; widen radius by step; give up after N attempts or 3 min → `NO_DRIVER_FOUND`.

### Live tracking
Driver app sends `driver:location` every 4 s on a trip, 10 s when idle → realtime pod → `GEOADD` + `HSET driver:{id}` (heading, speed, ts) → if on a trip, publish to room `trip:{id}` → rider receives it. On a trip, points are also appended to Redis stream `trip:{id}:points`, which is flushed to `trip_location_points` and an encoded polyline at completion.

### Trip end → fare
`COMPLETE` → OSRM `/match` on the GPS trace → actual distance & duration → pricing `finalize()` with guard rails (D5 §5) → payment capture / cash ledger entry → receipt → ratings.

### Navigation (free)
The driver app opens the Google Maps app with intent `google.navigation:q={lat},{lng}&mode=d` (bike: `mode=l`). Web fallback: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=driving`. Our app keeps the foreground service running, so GPS pings continue while Google Maps is in front.

## 4. Data placement

| Data | Store | Why |
|---|---|---|
| Driver live location, online state | Redis GEO + hash (TTL 60 s) | Changes very often, short-lived |
| Active trip state cache | Redis hash + Postgres (Postgres is the source of truth) | |
| Offers in flight, locks, rate limits, OTP attempts | Redis | |
| Everything durable | Postgres | |
| GPS trace | Redis stream → Postgres partitioned table (monthly) → archive to R2 as Parquet after 90 days | |
| Documents & images | R2 (private, signed URLs) | |

## 5. Cross-cutting concerns
- **Region everywhere:** every durable business row has `region_id`; every request resolves a region (D3 §2); admin queries are filtered by the admin's allowed regions.
- **Idempotency:** `Idempotency-Key` header on all money/trip-mutating POSTs (stored 24 h in Redis).
- **Time:** stored as UTC `timestamptz`; "day" for limits and reports uses the region's `timezone`.
- **IDs:** UUIDv7 (time-ordered, index-friendly). Public trip code: short `PYL-7K3M9Q`.
- **Money:** `bigint` minor units + `currency` char(3). No floats.
- **Observability:** OpenTelemetry traces, Prometheus metrics (`dispatch_match_seconds`, `offers_rejected_total`, …), structured JSON logs with `request_id`, `region_id`, `actor`.
