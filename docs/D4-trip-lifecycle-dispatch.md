# D4 — Trip Lifecycle & Dispatch (source of truth)

## 1. State machine
```
                 ┌──────────── rider cancel (free) ─────────────┐
 SEARCHING ──accept──► DRIVER_ASSIGNED ──(moving)──► DRIVER_ARRIVING ──arrived──► DRIVER_ARRIVED ──OTP ok──► IN_PROGRESS ──complete──► COMPLETED
     │                       │                              │                            │                       │
     │ timeout / no drivers  │ rider/driver/admin cancel    │                            │ no-show (wait > N min)│ admin cancel (rare)
     ▼                       ▼                              ▼                            ▼                       ▼
 NO_DRIVER_FOUND      CANCELLED_BY_*  (fee per cancellation_policies)
```
- Every transition goes through `TripStateService.transition(tripId, to, actor)`. It checks the allowed-transition table, does a
  conditional `UPDATE trips SET status=$to WHERE id=$id AND status=$from` (optimistic, so no double transitions),
  writes `trip_events`, emits a domain event, and pushes `trip:updated`.
- If a driver cancels after accepting, the trip goes **back to SEARCHING** (rider keeps the booking) unless the rider has already cancelled.
  The driver's `cancellation_rate` goes up.
- `DRIVER_ARRIVED` is only allowed within 150 m of pickup (configurable). Start needs the 4-digit rider OTP.
- No-show: after `wait_free_s` + N min the driver may cancel with `reason=rider_no_show` → the rider is charged a cancel fee and the driver gets a share.

## 2. Distances recorded on every trip
| Leg | Source | Used for |
|---|---|---|
| Quote A→B (`est_distance_m`, `est_duration_s`) | OSRM `/route` at quote time | Quote, offer screen |
| Approach driver→A (`approach_distance_m`) | OSRM `/table` at dispatch + actual GPS | Ranking, pickup charge (if over `pickup_km_free`), analytics |
| Actual A→B (`actual_distance_m`) | GPS trace → OSRM `/match` at completion (fallback: haversine sum of filtered points) | Final fare |

All of these come from our own OSRM, so they cost ₹0. Turn-by-turn for the driver is in the Google Maps app (intent), also ₹0.

## 3. Dispatch algorithm (v1: sequential best-match)
```
on TripRequested(trip):
  for attempt in 1..MAX_ATTEMPTS (default 8) and elapsed < SEARCH_TIMEOUT (default 180 s):
     radius = radius_steps[min(attempt_ring, len-1)]            # e.g. 2 km → 4 km → 6 km
     cands  = GEOSEARCH drv:geo:{region}:{vt} pickup radius COUNT 20 ASC
     cands  = filter(cands, d =>
                d.status == idle
                && !exists drv:{d}:offer                         # not already holding an offer
                && !d.offered_this_trip                          # don't ask the same driver twice
                && (daily.blocked_until(d) is null or < now)    # only if admin enabled a hard block
                && driver.earnings_balance > negative_balance_limit
                && kyc_ok && vehicle_type matches)
                # note: drivers past the free-rejection limit still get offers; further rejections cost bonus (§4)
     if empty: attempt_ring++; continue
     etas   = OSRM table(cands → pickup)                          # one call, real road ETA
     best   = argmin(score) where score = eta_s*w1 - rating*w2 - acceptance_rate*w3 - idle_time*w4
                                         - subscription.dispatch_priority_boost*w5   # subscribers get more trips
              # w5 is capped so a subscriber 3 km away never beats a non-subscriber 300 m away
              # (setting dispatch.subscription_max_eta_advantage_s, default 120 s)
     send offer(best) ; SET drv:{best}:offer trip NX EX timeout
     wait (accept | reject | timeout via delayed job)
     if accepted: assign; return
  status = NO_DRIVER_FOUND; notify rider
```
- **Accept race:** `SET trip:{id}:lock driver NX` + `UPDATE trips … WHERE status='SEARCHING'`. The loser gets `409 OFFER_ALREADY_TAKEN`.
- Each dispatch runs as a BullMQ job keyed by `trip_id` (one active job per trip). Workers scale horizontally; Redis locks keep it safe.
- **v2 options** (behind a flag): batch offers to the top-K drivers (first to accept wins), and global batch matching (Hungarian algorithm every 2 s per H3 cluster) for busy cities.

## 4. The daily rejection rule
- Counter: `driver_daily_stats(driver_id, local_date)`, where `local_date` = now in the **region timezone**. Redis mirror `drv:{id}:rej:{date}` (INCR, expires 48 h) for fast checks; DB is the source of truth.
- **Counts as a rejection:** explicit reject, offer timeout (setting `dispatch.timeout_counts_as_rejection`, default true).
  **Does not count:** offers the system cancelled (rider cancelled, someone else took it), offers made while the app was provably offline (FCM undelivered).
- **Rule (owner decision P-003):** the first `free_rejections_per_day` rejections (default **3**) are free. **Every rejection after that deducts
  from the driver's bonus wallet.** The driver keeps receiving offers; base trip earnings are never touched.
- Config: `rejection_penalty_rules` (D2 §3), resolved region+service → region → global. Admin sets:
  - `penalty_type`: `flat` (e.g. ₹10 per rejection), `percent_of_bonus_balance`, or `percent_of_day_bonus`
  - `escalation`: e.g. 4th–5th = ₹10, 6th+ = ₹25
  - `insufficient_bonus_mode`: `cap_at_zero` (default) or `carry_negative` (a later bonus pays it off first)
  - `also_block_after` (optional): hard block until local midnight after N rejections, as a safety valve. Off by default.
  - Subscriptions can add `extra_free_rejections`.
- Flow on reject/timeout: `INCR` counter → if `count > free` → compute penalty → one ledger txn `bonus_penalty`
  (debit `driver_bonus`, credit `platform_revenue`) → `driver_penalties` row → `wallet:updated` event + push "₹10 deducted from bonus".
- The offer card shows `free_rejections_left` and, once that reaches 0, **"Rejecting will deduct ₹X from your bonus"**, so the driver sees the cost before choosing.
- Admins can waive a penalty (`/admin/drivers/{id}/penalties/{pid}/waive`, audited). The waiver reverses the ledger txn.
- Applies to **city on-demand offers only**. Outstation offers use claiming (§7), so there is nothing to reject (Q8).

## 5. Timeouts & jobs
| Job | Delay | Action |
|---|---|---|
| `offer:expire:{offer}` | offer_timeout_s (15 s) | mark expired, count it, continue dispatch |
| `trip:search_timeout:{trip}` | 180 s | NO_DRIVER_FOUND |
| `trip:arrival_watch:{trip}` | ETA × 2 | ops alert `trip_stuck` |
| `trip:stale_inprogress` | every 5 min | flag trips IN_PROGRESS > 3× est duration |
| `driver:heartbeat_sweep` | every 30 s | drivers with no ping for 60 s → remove from GEO (offline-ish) |
| `stats:midnight_rollover:{region}` | local midnight | reset counters/blocks (timezone-aware) |
| `outstation:dispatch_window:{trip}` | scheduled_at − 2 h (config) | start the claim/assignment process for scheduled trips |
| `outstation:reminder:{trip}` | scheduled_at − 1 h / − 15 min | remind the confirmed driver and the rider; if the driver is not confirmed → ops alert |
| `subscription:expire` | hourly | expire plans, auto-renew if enabled and the wallet allows |

## 6. Failure handling
- Driver socket drops mid-trip: the app buffers points in Room and uploads them via `/driver/location/batch`, so the trip continues.
- Rider app killed: state comes back from `GET /rider/trips/active`.
- OSRM down: circuit breaker → Ola Maps adapter → last resort is haversine × 1.3 road factor (quote flagged `approximate`).

## 7. Outstation (long-journey) flow
- States: `SCHEDULED → DRIVER_CONFIRMED → DRIVER_ARRIVING → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED` (or cancelled). Book-now outstation skips `SCHEDULED` and starts at `SEARCHING`.
- **Claim model** (not ping-and-reject): the booking is published to eligible drivers (outstation opted in, right vehicle type, within
  `outstation.claim_radius_km` of pickup, documents valid incl. permit). Subscribers see it first (`outstation.subscriber_head_start_min`).
  The first valid `claim` wins (same Redis lock + conditional update as city). No claim within `outstation.claim_timeout_min` →
  the radius widens → ops alert (an admin can assign manually).
- A confirmed driver who cancels less than `outstation.late_cancel_hours` before pickup gets a penalty from `rejection_penalty_rules` (type `cancellation`).
- Round trip: `trip_days = ceil((return_at - scheduled_at)/24h)`. The driver stays with the rider; GPS tracking runs the whole time.
- Interstate: if the drop is in another state, the quote adds a permit/state-tax line (admin table `tolls_fees` type `state_permit`).
- Navigation is the same as city: Google Maps app intent, free.
