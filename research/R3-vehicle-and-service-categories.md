# R3 — Vehicle & service categories (how popular Indian apps do it)

Researched 2026-10-17. Market figures are from blogs/forums. Use them as a guide, not a rate card.

## What competitors offer
| App | City categories | Long-distance |
|---|---|---|
| Uber India | Moto (bike), Auto, Go (hatchback), Go Sedan / Premier, XL (SUV 6–7 seats) | Intercity (one-way / round trip), Rentals (hourly packages) |
| Ola | Bike, Auto, Mini, Prime Sedan, Prime SUV | Outstation (one-way, round trip), Rental |
| Rapido | Bike, Auto, Cab Economy, Cab Premium (+ Parcel) | — |
| Namma Yatri | Auto, cabs (direct-to-driver / zero commission) | — |

Market notes: bike taxis and autos make up most ride volume in India (one 2025 estimate: 56% bike, 31% auto, 14% cab).
Uber moved Auto to a SaaS/no-commission model in Feb 2025, and Namma Yatri uses a subscription model. This supports our **hybrid commission + subscription** model.

## Long-journey ("outstation") norms
- **One-way drop** and **round trip**, usually booked ahead (scheduled).
- Round trip: **minimum km/day**, typically 250 km (hatch/sedan) and 300 km (SUV). Billed = max(actual, min × days).
- **Driver allowance ("bata")** per day: ₹250 (hatch), ₹300 (sedan), ₹350–400 (SUV). Plus a **night allowance** when driving between ~22:00 and 06:00.
- Extras passed through: **tolls, interstate permit/state tax, parking**.
- Per-km rates (third-party examples): hatch ₹10/km round trip, ₹15/km one-way; sedan ₹10.25 / ₹15.25; SUV ₹15 / ₹22. One-way costs more per km because the car returns empty.
- Bike and auto are not offered for outstation.

## Decision for Poyalo (all admin-configurable, nothing hardcoded)
Two **service types**:
1. `city`: on-demand, within a region. Vehicles: `bike`, `auto`, `mini` (hatchback), `sedan`, `suv` (6–7 seats). A `premium` sedan tier can be added later through admin.
2. `outstation`: long journey from a region to any destination. Sub-type `one_way` | `round_trip`; book now or scheduled. Vehicles: `mini`, `sedan`, `suv` (and an optional `suv_xl` / Innova class).

Vehicle types and their availability per region × service type are **data in the DB**, managed from the admin console. The seed contains only sensible defaults.

## Sources
- Ola outstation (Chennai–Vellore example, ₹250 day allowance): https://blog.olacabs.com/tag/out-of-town/ · https://blog.olacabs.com/tag/cabs-for-outstation/
- Ola one-way fares: https://www.freepressjournal.in/business/ola-outstation-brings-one-way-trip-fares
- Outstation cost norms: https://cabbazar.com/blog/how-much-does-an-outstation-cab-cost-in-india/ · https://www.trivenicabs.in/outstation-cabs
- Ride type comparison: https://www.coherentlab.com/blog/top-ride-sharing-apps · https://www.equentis.com/blog/is-rapido-set-to-outpace-ola-uber/
- Team-BHP 2025 thread: https://www.team-bhp.com/forum/street-experiences/301740-2025-thread-rapido-vs-uber-vs-ola.html
