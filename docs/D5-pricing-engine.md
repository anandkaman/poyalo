# D5 — Pricing, Commission & Driver Money (source of truth)

Pricing is **region × service type × vehicle type × optional zone (× trip kind for outstation)**, versioned, and computed by pure functions
(`packages/pricing`) shared by the backend and the admin simulator. **Every number below comes from admin-managed tables. Nothing is hardcoded.**

## 1. Config resolution
For a request with pickup P, drop D, service S, vehicle V, time T:
1. `region` = active region containing P. S must be enabled there and V enabled for (region, S) in `region_service_vehicles`.
2. `zone` = highest-priority active zone containing P (else containing D, if the zone type is `airport`/`railway`). City only.
3. `fare_config` = active config for (region, S, V, zone, trip_kind) at T → fall back to zone NULL. None → `VEHICLE_TYPE_UNAVAILABLE`.
4. `surge` (city only) = manual rule if active, else the auto snapshot for `h3_r8(P)`, capped at `max_multiplier`.

## 2a. City formula (integer paise, rounded at the end)
```
distance_km   = max(0, est_distance_m/1000 - included_km)
time_min      = est_duration_s / 60
base_fare     = base + distance_km*per_km + time_min*per_min
pickup_charge = max(0, approach_km - pickup_km_free) * pickup_per_km
night         = base_fare * (night_multiplier - 1)   if T in [night_start, night_end)
surge_amount  = (base_fare + night) * (surge - 1)
subtotal      = max(min_fare, base_fare + night + surge_amount) + pickup_charge + booking_fee + tolls_fees
discount      = promo(subtotal)
tax           = (subtotal - discount) * tax_pct
total         = round_to_nearest(subtotal - discount + tax, 100 paise)
```

## 2b. Outstation formula
```
one_way:    billable_km = est_km                      rate = per_km (one-way rate, already includes the empty return)
round_trip: days        = ceil((return_at - scheduled_at) / 24h)   (min 1)
            billable_km = max(est_km_total_both_ways, min_km_per_day * days)
fare        = max(min_fare, base + billable_km * per_km)
allowance   = driver_allowance_per_day * days  + night_allowance * nights_driving   # passed 100% to the driver
extras      = tolls (estimate; actuals added at end) + state_permit (if interstate) + parking (actuals)
subtotal    = fare + allowance + extras + booking_fee ; discount, tax, total as in 2a
```
Default values from market research (R3) are seeded **as editable drafts only**, e.g. min 250 km/day (mini/sedan), 300 (SUV), allowance ₹250–400/day.

`breakdown` (jsonb) stores every line. The config version is saved on the quote and the trip.

## 3. Driver monetization: commission + optional subscription (owner decision P-003)
**Commission applies to every trip.** It is resolved from `commission_rules` (most specific of region/service/vehicle), as a % and/or a flat fee with a minimum.
```
commissionable = subtotal - booking_fee - allowance - extras - tax     # platform never takes a cut of tolls/allowance/tax
commission     = max(min_commission, commissionable * pct + flat)
if driver has active subscription with commission_pct_override: pct = override (may be 0)
driver_earning = commissionable - commission + allowance + tips + extras_reimbursed
```
**Subscription plans** (`subscription_plans`, all admin-created): price + duration (e.g. ₹99/day, ₹599/week) and benefits:
- `dispatch_priority_boost`: ranked higher in city dispatch (D4 §3, bounded so the nearest driver still matters) → more trips
- outstation head start (sees bookings N minutes before others)
- optional `commission_pct_override` (e.g. 5% instead of 15%)
- optional `extra_free_rejections`
Bought with UPI or from the earnings wallet. Revenue is recorded as ledger type `subscription_fee`.
Admin can run several plans per region and switch them on/off. Without a plan, a driver just pays commission and gets normal dispatch.

## 4. Surge (city, auto)
Every 60 s per region: per H3 r8 cell (+ k-ring 1), `ratio = open_requests_5min / idle_drivers`,
`multiplier = clamp(1 + α·(ratio − 1), 1, max)`, smoothed with an EMA, step 0.1. Admins can disable it or override it manually.

## 5. Final fare at completion
- Recompute with actual distance/time (OSRM `/match`) + waiting (`max(0, wait_s − wait_free_s)/60 × wait_per_min`).
- Guard rails (city): if the actual distance is within ±10% of the estimate, charge the quote. Otherwise recompute, capped at +25% unless the route was changed; flag for review above that.
- Outstation: recompute billable km with actual km; add actual tolls/parking (driver enters them with an optional receipt photo, ops can audit).

## 6. Cash vs online: how the money moves (owner decision P-003)
Every driver has two wallets: **earnings** (trip money, can go negative) and **bonus** (incentives/referrals; penalties are deducted here).

**Online trip (UPI/card):** the rider pays the platform via Razorpay. One ledger txn:
```
debit  platform_cash_clearing   total            (money received at Razorpay)
credit driver_earnings          driver_earning
credit platform_revenue         commission
credit tax_payable              tax
(promo: debit promo_expense, so the driver's earning is unaffected by discounts)
```
**Cash trip:** the driver keeps the cash, so the platform's share is **auto-deducted from the driver's earnings wallet**:
```
debit  driver_earnings   commission + tax (+ promo-funded part is credited back to the driver)
credit platform_revenue  commission
credit tax_payable       tax
```
- If a promo was used on a cash trip, the rider paid less in cash, so the platform **credits** the promo amount to the driver's earnings.
- **Netting:** online earnings and cash deductions offset each other automatically in the same wallet.
- **Payout** (daily/weekly, admin setting): positive earnings balance → RazorpayX transfer to the driver's UPI/bank. Bonus is moved into earnings on payout (or kept separate, as admin chooses).
- **Negative balance** (driver collected more cash than they earned online):
  1. Below `payments.driver_negative_balance_warn` → in-app warning + "Pay now via UPI" (`/driver/wallets/earnings/topup`).
  2. Below `payments.driver_negative_balance_limit` → the driver cannot go online until it is settled, or until online trips (e.g. the admin forces "online-only payment" offers to this driver) bring the balance back up.
  3. Optionally a positive bonus balance is used to clear the negative earnings first (admin setting `payments.bonus_offsets_negative`).
- Reports: daily cash-collected vs commission-due per driver, and region-level reconciliation against Razorpay settlements.

## 7. Admin simulator
`POST /admin/pricing/simulate {region, service_type, trip_kind?, vehicle_type, pickup, drop, at, return_at?, surge?, driver_plan?}` →
rider breakdown + driver earning + commission under the draft and active configs.
