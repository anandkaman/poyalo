# D0 — Product Requirements (source of truth)

**Product:** Poyalo, a ride-hailing platform (Uber/Ola/Rapido style).
**Scope:** midrange MVP+ that scales. **Market:** India (confirmed). **No city is hard-coded:** cities/regions are created from the
admin console (draw polygon → configure → activate), so the same build can be deployed in any number of cities. Currency INR, money stored in paise.
**Language:** English only for now, i18n-ready (see D10). **Brand:** Poyalo (Tamil). Theme in D10.

## Service types (confirmed)
| Service | Code | What | Vehicles (default, admin-editable) |
|---|---|---|---|
| Within city | `city` | On-demand rides inside a region | bike, auto, mini, sedan, suv |
| Long journey | `outstation` | From a region to another city; `one_way` or `round_trip`; now or scheduled | mini, sedan, suv (+ optional suv_xl) |

The rider picks the service first (two tabs on the home screen: **City** | **Outstation**), then the vehicle. Source: research/R3.

## Actors

| Actor | Code | Clients | Description |
|---|---|---|---|
| Rider (customer) | `rider` | Android app, Website | Books and pays for trips |
| Driver (partner) | `driver` | Android app (main), Website (onboarding, earnings, documents) | Signs up, gets verified, accepts trips |
| System admin | `admin` | **Website only** (admin console) | Runs the platform: regions, pricing, drivers, support |

Admins have sub-roles (RBAC): `super_admin`, `ops_manager` (region-scoped), `support_agent`, `finance`, `kyc_reviewer`.

## Rider features
1. Sign up / log in with phone OTP; profile, emergency contacts, saved places (home/work).
2. Pick pickup (current GPS or search) and drop. Optional stops in v2.
3. **Fare quote** for each vehicle type available in that region and service type (distance + time from OSRM, pricing from D5). Quote is locked for 5 min.
4. City: book now. Outstation: one-way or round trip (return date), book now or schedule (up to N days ahead, set by admin). Pick a payment method: **cash or online** (UPI/card; wallet later).
5. Live status: searching → driver assigned (name, photo, vehicle, plate, rating, ETA) → arriving → arrived → **OTP to start** → on trip → completed.
6. Live driver location on the map, share trip link, **SOS** button.
7. Cancel (cancellation fee applies after a grace period / after the driver has arrived; set per region).
8. Pay, rate and tip the driver, get a receipt by email or in-app.
9. Trip history, support tickets, promo codes, referral, wallet.

## Driver features
1. Sign up with phone OTP → onboarding: personal details, DL, vehicle RC, insurance, permit, photo, bank/UPI for payouts.
2. Documents are reviewed by an admin (`pending → approved/rejected`); expiry dates tracked, with reminders.
3. Go **online/offline**; location streamed while online (foreground service).
4. Receive a **trip offer** (pickup, drop, distance, estimated fare, pickup ETA) with a 15 s countdown (configurable). Accept or reject.
5. **Rejection rule:** **3 free rejections per driver per day** (region timezone; limit set by admin). Each rejection beyond the limit **deducts from the driver's bonus earnings** (amount/percentage set by admin, see D4 §4). Offer timeouts count as rejections (confirmed).
5a. **Revenue model (confirmed):** drivers pay a **commission on every trip**. They can *also* buy a **subscription plan** that gives them more trips (dispatch priority boost) and optionally a lower commission. Plans, prices and benefits are configured by admin (D5 §3).
5b. **Cash & online (confirmed):** for cash trips the driver keeps the cash and the platform's commission is **auto-deducted from their earnings wallet**. For online trips the platform collects the money and credits the driver's share. See D5 §6.
6. After accepting: **Navigate to pickup** (opens the Google Maps app, free) → Arrived → enter rider OTP → Start → **Navigate to drop** (Google Maps) → Complete.
7. Collect cash or see a digital payment confirmation. Earnings dashboard (daily/weekly), payout history, incentives.
8. Rate the rider, SOS, support.

## Admin features (website only)
1. **Regions & zones:** draw service-area polygons on a map; set timezone, currency and enabled vehicle types; set zones such as airport or railway station, each with its own pricing.
2. **Pricing:** versioned fare configs per region × vehicle type × (optional) zone; surge rules; night charges; tolls/fees; cancellation policy; commission/subscription model.
3. **Platform controls:** feature flags and settings scoped *global → country → region*: max daily rejections, offer timeout, dispatch radius, payment methods, maintenance mode, minimum app version (force update).
4. **Driver management:** KYC review queue, approve/suspend/ban, document expiry, vehicles.
5. **Rider management:** block/unblock, refunds, wallet adjustments (audited).
6. **Live ops:** live map of online drivers and active trips, H3 demand/supply heatmap, manual dispatch/reassign.
7. **Finance:** payments, refunds, driver payouts, commission reports, ledger export.
8. **Support:** tickets, SOS alerts (top priority), trip replay (route trace).
9. **Promotions:** promo codes (region-scoped, usage limits), referral rewards, driver incentives.
10. **Audit log** of every admin action. Reports & analytics.

## Non-functional requirements
| Item | Target |
|---|---|
| Time to match a driver (p95) | < 30 s when supply is available |
| API latency p95 (non-geo) | < 200 ms |
| Location update fan-out to rider | < 2 s |
| Availability | 99.9% (core booking path) |
| Scale target (phase 1 → 3) | 1 city / 2k drivers → 10+ cities / 50k drivers / 100k trips/day |
| Map API cost | ~₹0 per trip (see R1) |
| Security | OWASP ASVS L2, encrypted PII, audit trail, DPDP Act 2023 (India) compliance |

## Out of scope for v1 (planned)
Scheduled *city* rides, multi-stop, ride pooling, hourly rentals, corporate accounts, iOS apps, parcel delivery, masked calling (v1.5), in-app chat (v1.5), Tamil/Hindi UI (later, see D10 §4).
(Outstation, including scheduled outstation, **is in scope**.)

## Owner decisions (answered 2026-10-17, prompt P-003)
| # | Question | Answer |
|---|---|---|
| Q1 | Country & city? | **India.** No city hard-coded; any number of cities via admin. Tamil-inspired theme (D10). English now, multi-language later |
| Q2 | Vehicle types? | Based on popular apps (R3): bike, auto, mini, sedan, suv. **Two services: City and Outstation (long journey)** |
| Q3 | Revenue model? | **Commission per trip + optional subscription** (more trips). All values set by admin |
| Q4 | After the 3rd rejection? | **Deduction from bonus earnings** for each further rejection. Amount/rules set by admin |
| Q5 | Timeouts count as rejections? | **Yes** |
| Q6 | Payment methods? | **Cash and online.** Cash → commission auto-deducted from the driver's earnings |
| Q7 | Brand name? | **Poyalo** |

## Still open (non-blocking)
| # | Question | Default until answered |
|---|---|---|
| Q8 | Does the 3-rejection rule apply to outstation offers too? | No. Outstation offers are broadcast and rejecting them is free (D4 §7) |
| Q9 | If the bonus balance is lower than the penalty? | Deduct down to ₹0 only; the rest is not carried forward (admin can switch to "carry as negative bonus") |
| Q10 | Theme colors OK? (D10 §1) | Use the proposal |
