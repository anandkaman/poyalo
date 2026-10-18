# D6 — Admin Console & Platform Controls (source of truth)

Admin is **web only** (`admin.poyalo.in`), behind email + password + TOTP MFA. An IP allowlist is optional. Every write is audited.

## 1. Settings hierarchy
`effective(key, region) = region value ?? country value ?? global value ?? code default`.
Settings are cached in Redis (TTL 60 s) and invalidated by pub/sub on change, so all pods pick up a change within seconds without a redeploy.

| Key | Default | Meaning |
|---|---|---|
| *(rejection penalties)* | `rejection_penalty_rules` table | 3 free/day, then bonus deduction (flat/percent/escalating), set per region/service. See D4 §4 |
| `dispatch.timeout_counts_as_rejection` | true | confirmed by owner |
| `dispatch.subscription_max_eta_advantage_s` | 120 | caps the subscriber priority boost |
| `outstation.enabled` | true | per region |
| `outstation.max_advance_days` | 7 | how far ahead riders can schedule |
| `outstation.dispatch_window_min` | 120 | claiming opens this long before pickup |
| `outstation.claim_radius_km` | 15 | |
| `outstation.claim_timeout_min` | 20 | then widen radius / alert ops |
| `outstation.subscriber_head_start_min` | 10 | |
| `outstation.late_cancel_hours` | 3 | |
| `payments.driver_negative_balance_warn` | -20000 (₹-200) | |
| `payments.bonus_offsets_negative` | true | |
| `payments.payout_schedule` | `weekly` | `daily` / `weekly` |
| `i18n.enabled_locales` | ["en"] | add "ta", "hi" later |
| `dispatch.offer_timeout_s` | 15 | |
| `dispatch.radius_steps_m` | [2000,4000,6000] | |
| `dispatch.search_timeout_s` | 180 | |
| `dispatch.max_attempts` | 8 | |
| `trip.arrival_geofence_m` | 150 | |
| `trip.quote_ttl_s` | 300 | |
| `trip.no_show_wait_min` | 5 | |
| `payments.methods` | ["cash","upi"] | |
| `payments.driver_negative_balance_limit` | -50000 (₹-500) | blocks going online |
| `maps.route_provider` | `osrm` | `olamaps` / `google` |
| `maps.search_provider` | `olamaps` | `photon` |
| `surge.auto_enabled` | true | |
| `surge.max_multiplier` | 2.0 | |
| `app.min_version.{client}` | — | force update |
| `system.maintenance` | false | read-only mode with a banner |
| `safety.sos_numbers` | ["112"] | |

## 2. RBAC
Permission codes look like `<area>.<action>`: `regions.write, pricing.write, pricing.activate, settings.write, drivers.read,
drivers.approve, drivers.suspend, riders.block, trips.read, trips.cancel, trips.reassign, refunds.create, wallet.adjust,
payouts.run, promos.write, support.handle, sos.handle, admins.manage, audit.read`.
Role → permissions is seeded, and `super_admin` can edit it. `admin_user_roles.region_id` limits a role to one region (city ops manager).
Guards: `@Permissions('pricing.write') @RegionScoped()` on every admin route.

## 3. Screens (admin web)
1. Dashboard: live KPIs per region (online drivers, active trips, match rate, avg ETA, cancellations, GMV today).
2. Live map: drivers (colored by status), active trips, SOS pins, H3 heatmap layer (demand / supply / surge).
3. Regions & zones: polygon drawing (MapLibre + terra-draw), timezone, vehicle types, launch/pause.
4. Catalog: service types (City / Outstation), vehicle types, which vehicles are enabled per region × service.
4a. Pricing: fare configs for city and outstation (draft → simulate → activate, with version history & diff), surge rules, cancellation policies, tolls/state permits.
4b. Driver monetization: commission rules, subscription plans (price, duration, priority boost, commission override), rejection-penalty rules, bonus credits/waivers, cash-commission reconciliation.
5. Settings & feature flags per scope.
6. Drivers: list/filter, KYC review queue (document viewer with signed URLs, approve/reject with reason), stats, rejection reset, suspend.
7. Riders: search, trips, block, wallet adjustments.
8. Trips: search, detail with timeline (`trip_events`), offers list (who was offered and what they answered), route replay, refund, cancel, reassign.
9. Finance: payments, refunds, payouts (batch run), ledger export, commission report.
10. Growth: promo codes, incentives, referrals.
11. Support & SOS queue (SOS rings an alarm + realtime `ops:sos`).
12. Admin users, roles, audit log viewer.

## 4. Safety controls
- Two-person approval (maker-checker) for: activating pricing configs, refunds above a threshold, payouts runs, wallet adjustments above a threshold.
- An audit log entry is written in the same DB transaction as the change (before/after JSON).
