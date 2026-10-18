# D3 — API Design (source of truth)

REST over HTTPS + Socket.IO for realtime. The OpenAPI 3.1 spec is generated from the NestJS code and published at `/docs`.
Typed clients are generated for web (TS) and Android (Kotlin) from that spec.

## 1. Conventions
- Base URL: `https://api.poyalo.in/v1` (versioned in the path; breaking change → `/v2`).
- **Namespaced by actor**, so authorization is simple and each app sees only its own surface:
  - `/v1/auth/*` public (OTP, refresh)
  - `/v1/public/*` no auth (config, vehicle types, serviceability check)
  - `/v1/rider/*` role `rider`
  - `/v1/driver/*` role `driver`
  - `/v1/admin/*` role `admin` + permission + region scope (admin console only, separate subdomain `admin.poyalo.in`)
  - `/v1/webhooks/*` provider callbacks (signature-verified)
- JSON, `snake_case` fields, ISO-8601 UTC timestamps, money as `{ "amount": 15400, "currency": "INR" }` (paise).
- Pagination: cursor based, `?limit=20&cursor=…` → `meta.next_cursor`.
- Lat/lng as `{ "lat": 17.385, "lng": 78.4867 }`.

## 2. Standard request headers
| Header | Required | Purpose |
|---|---|---|
| `Authorization: Bearer <jwt>` | yes (except auth/public) | Access token, 15 min |
| `X-Client` | yes | `rider-android` \| `driver-android` \| `web` \| `admin-web` |
| `X-App-Version` | yes | Semver/build. Server may answer `426 UPGRADE_REQUIRED` (min version per region in settings) |
| `X-Device-Id` | apps | Stable install ID, bound to the session |
| `X-Region` | optional | Region code (`IN-HYD`). If missing, the server resolves it from the request's coordinates or the user's `home_region_id`. Admin: chosen region filter |
| `X-Lat`, `X-Lng` | optional | Current location, for region resolution & analytics |
| `Idempotency-Key` | **required** on money/trip POSTs | UUID; same key returns the same response for 24 h |
| `X-Request-Id` | optional | Echoed back; for tracing |
| `Accept-Language` | optional | `en`, `te`, `hi` … |

**JWT claims:** `sub` (user/admin id), `act` (`rider|driver|admin`), `rgn` (home region), `sid` (session), `perm` (admins: permission codes), `rgns` (admins: allowed region ids or `*`), `ver`.
One phone number can hold both rider and driver profiles. The token is issued **per actor** (log in from the driver app → `act=driver`).

## 3. Response envelope
```json
{ "data": { ... }, "meta": { "request_id": "…", "region": "IN-HYD", "next_cursor": null } }
```
Error:
```json
{ "error": { "code": "DRIVER_REJECTION_LIMIT_REACHED", "message": "Daily rejection limit reached", "details": { "limit": 3, "blocked_until": "2026-10-18T18:30:00Z" } },
  "meta": { "request_id": "…" } }
```
HTTP status + a stable machine `code`. Codes are listed in `packages/contracts/errors.ts`, for example:
`VALIDATION_FAILED, UNAUTHENTICATED, FORBIDDEN, REGION_NOT_SERVICEABLE, VEHICLE_TYPE_UNAVAILABLE, QUOTE_EXPIRED,
TRIP_NOT_FOUND, INVALID_TRIP_STATE, OFFER_EXPIRED, OFFER_ALREADY_TAKEN, DRIVER_REJECTION_LIMIT_REACHED,
DRIVER_NOT_APPROVED, OTP_INVALID, OTP_RATE_LIMITED, PAYMENT_FAILED, IDEMPOTENCY_CONFLICT, UPGRADE_REQUIRED, MAINTENANCE`.

## 4. Endpoints

### Auth (shared)
| Method | Path | Body → Result |
|---|---|---|
| POST | `/auth/otp/request` | `{phone, actor, purpose}` → `{request_id, resend_after_s}` |
| POST | `/auth/otp/verify` | `{request_id, code, actor, device}` → `{access_token, refresh_token, user, is_new, profile_status}` |
| POST | `/auth/refresh` | `{refresh_token}` → new token pair (rotation, reuse detection) |
| POST | `/auth/logout` | revoke session |
| POST | `/auth/admin/login` | `{email, password, totp}` → tokens (admin only) |

### Public
| GET | `/public/config?client=rider-android` | min versions, feature flags, support numbers |
| GET | `/public/serviceability?lat&lng` | `{serviceable, region, services:[{service_type:"city", vehicle_types[]}, {service_type:"outstation", vehicle_types[], trip_kinds[]}]}` |

### Rider
| Method | Path | Notes |
|---|---|---|
| GET/PATCH | `/rider/me` | profile |
| CRUD | `/rider/saved-places`, `/rider/emergency-contacts`, `/rider/payment-methods` | |
| GET | `/rider/places/autocomplete?q&lat&lng&session` | proxies Ola/Photon, cached |
| GET | `/rider/places/reverse?lat&lng` | |
| POST | `/rider/quotes` | `{service_type: "city"\|"outstation", trip_kind?: "one_way"\|"round_trip", scheduled_at?, return_at?, pickup, drop, pickup_address?, drop_address?, promo_code?}` → `{quotes:[{quote_id, service_type, trip_kind, vehicle_type, total, breakdown, est_distance_m, est_duration_s, pickup_eta_s, surge_multiplier, expires_at}], route_polyline}`. Outstation: `pickup` must be inside an active region; `drop` can be anywhere in India |
| GET | `/rider/trips/scheduled` | upcoming outstation bookings |
| POST | `/rider/trips` 🔑 | `{quote_id, payment_method, payment_method_id?}` → trip (`SEARCHING`) |
| GET | `/rider/trips/active` | current trip + driver + live location |
| GET | `/rider/trips/{id}` / `/rider/trips?cursor` | detail / history |
| POST | `/rider/trips/{id}/cancel` 🔑 | `{reason_code}` → `{cancel_fee}` |
| POST | `/rider/trips/{id}/rating` | `{stars, tags, comment, tip?}` |
| POST | `/rider/trips/{id}/share` | → public tracking link |
| POST | `/rider/trips/{id}/pay` 🔑 | create Razorpay order → `{order_id, key}` |
| POST | `/rider/sos` | `{trip_id, location}` |
| GET | `/rider/wallet`, `/rider/wallet/transactions` | |
| POST | `/rider/promos/validate` | |
| CRUD | `/rider/support/tickets` | |

### Driver
| Method | Path | Notes |
|---|---|---|
| GET/PATCH | `/driver/me` | profile, status, kyc_status, today's stats (`rejections_left`) |
| POST | `/driver/onboarding/documents/upload-url` | → signed R2 PUT URL |
| POST | `/driver/onboarding/documents` | `{type, number, file_key, expires_on}` |
| CRUD | `/driver/vehicles` | |
| POST | `/driver/status` 🔑 | `{online: true, vehicle_id, location}`. Fails if KYC not approved or blocked |
| POST | `/driver/offers/{offer_id}/accept` 🔑 | → trip. 409 `OFFER_ALREADY_TAKEN` / 410 `OFFER_EXPIRED` |
| POST | `/driver/offers/{offer_id}/reject` 🔑 | `{reason}` → `{rejections_used, free_rejections_left, penalty_applied?: {amount, bonus_balance_after}, next_penalty_amount}` |
| GET | `/driver/outstation/offers` | open outstation/scheduled bookings the driver can claim (D4 §7) |
| POST | `/driver/outstation/offers/{trip_id}/claim` 🔑 | first valid claim wins → `DRIVER_CONFIRMED` |
| GET | `/driver/subscription-plans` | plans available in the driver's region & vehicle |
| POST | `/driver/subscriptions` 🔑 | `{plan_id, pay_via: "earnings_wallet"\|"upi"}` → subscription (+ Razorpay order if UPI) |
| GET | `/driver/subscriptions/active` | current plan, expiry, benefits |
| GET | `/driver/wallets` | `{earnings: {balance}, bonus: {balance}, cash_commission_due, can_go_online}` |
| POST | `/driver/wallets/earnings/topup` 🔑 | pay a negative balance via UPI (Razorpay order) |
| GET | `/driver/penalties?from&to` | bonus deductions with reasons |
| GET | `/driver/trips/active` | |
| POST | `/driver/trips/{id}/arrived` 🔑 | geofence check (≤ 150 m of pickup) |
| POST | `/driver/trips/{id}/start` 🔑 | `{otp}` |
| POST | `/driver/trips/{id}/complete` 🔑 | `{location, odometer?}` → final fare |
| POST | `/driver/trips/{id}/cash-collected` 🔑 | |
| POST | `/driver/trips/{id}/cancel` 🔑 | counts toward the cancellation rate |
| POST | `/driver/trips/{id}/rating` | |
| GET | `/driver/trips/{id}/navigation` | `{google_maps_intent, google_maps_url}` for the current leg |
| GET | `/driver/earnings?from&to`, `/driver/payouts`, `/driver/incentives` | |
| POST | `/driver/location/batch` | offline-buffered points `[{lat,lng,at,speed,heading,accuracy}]`. Fallback when the socket is down |

### Admin (all region-scoped by `X-Region` + token `rgns`)
| Area | Paths |
|---|---|
| Regions/zones | `GET/POST/PATCH /admin/regions`, `/admin/regions/{id}/zones`, `/admin/regions/{id}/vehicle-types` |
| Catalog | `/admin/service-types`, `/admin/vehicle-types`, `/admin/regions/{id}/service-vehicles` (enable vehicle × service per region) |
| Pricing | `/admin/fare-configs` (create draft → `POST …/{id}/activate`), `/admin/surge-rules`, `/admin/cancellation-policies`, `POST /admin/pricing/simulate` |
| Driver monetization | `/admin/commission-rules`, `/admin/subscription-plans`, `/admin/rejection-penalty-rules`, `/admin/drivers/{id}/penalties/{pid}/waive`, `/admin/bonus-credits` |
| Settings | `GET/PUT /admin/settings?scope=region&scope_id=…`, `/admin/feature-flags` |
| Drivers | `/admin/drivers?status&kyc`, `/admin/drivers/{id}`, `POST …/approve`, `…/suspend`, `…/documents/{doc}/review`, `…/reset-rejections` |
| Riders | `/admin/riders`, `POST …/block`, `…/wallet-adjustments` |
| Trips | `/admin/trips?status&from&to`, `/admin/trips/{id}` (events, offers, route replay), `POST …/reassign`, `…/cancel`, `…/refund` |
| Live | `GET /admin/live/drivers?bbox`, `/admin/live/heatmap?res=8` |
| Finance | `/admin/payments`, `/admin/payouts` (`POST …/run`), `/admin/reports/{type}` (CSV export) |
| Growth | `/admin/promo-codes`, `/admin/incentives`, `/admin/referrals` |
| Support | `/admin/tickets`, `/admin/sos` |
| Access | `/admin/admin-users`, `/admin/roles`, `/admin/audit-logs` |

🔑 = `Idempotency-Key` required.

### Webhooks
`POST /webhooks/razorpay` (HMAC verify) · `POST /webhooks/msg91/dlr` · `POST /webhooks/kyc/{provider}`.

## 5. Realtime (Socket.IO)
Connect to `wss://rt.poyalo.in` with the `auth: {token}` handshake. Namespaces: `/rider`, `/driver`, `/admin`.
The server joins sockets to rooms: `user:{id}`, `trip:{id}`, `region:{id}:ops` (admins).

| Direction | Event | Payload |
|---|---|---|
| driver → server | `driver:location` | `{lat,lng,heading,speed,accuracy,at,trip_id?}` (ack-less, ~4–10 s) |
| server → driver | `offer:new` | `{offer_id, trip_id, pickup, drop, pickup_address, drop_address, est_distance_m, est_fare, pickup_eta_s, expires_at}` |
| server → driver | `offer:cancelled` | `{offer_id, reason}` |
| server → driver | `wallet:updated` | `{earnings_balance, bonus_balance, reason}` (e.g. penalty applied, cash commission deducted) |
| server → driver | `outstation:new` | new claimable outstation booking near the driver |
| server → rider | `trip:updated` | `{trip_id, status, driver?, vehicle?, eta_s?, otp? (rider only)}` |
| server → rider | `trip:driver_location` | `{lat,lng,heading,eta_s}` |
| server → both | `trip:cancelled`, `trip:completed` | `{trip_id, fare?, cancel_fee?}` |
| server → admin | `ops:sos`, `ops:trip_stuck`, `ops:metrics` | |
| server → any | `system:force_update`, `system:maintenance` | |

Each event carries `v` (schema version) and `seq` (per-trip, increasing) so clients ignore out-of-order updates.
Critical events (offer, assignment, cancellation) are **also sent via FCM** in case the socket is down. Client state is always recovered via `GET …/trips/active`.

## 6. Rate limits (defaults, configurable)
OTP request: 3 per 10 min per phone, 10 per hour per IP · quotes: 30/min/user · location batch: 1/2 s · admin: 600/min.
