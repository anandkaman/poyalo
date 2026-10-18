# R1 — Maps, Routing & Distance: getting it (nearly) free

Researched 2026-10-17. Prices change, so check the linked pages again before launch.

## The problem
Every trip needs: (1) place search / autocomplete, (2) A→B distance + ETA for the quote, (3) nearest-driver ETA,
(4) live map display, (5) turn-by-turn navigation for the driver, (6) the actual distance driven, for the final fare.
If Google Maps Platform APIs did all six, cost would grow with every trip. Most of it can be done for free.

## Findings

| Need | Paid route | Free / cheap route (chosen) |
|---|---|---|
| Distance/ETA A→B, driver→A | Google Routes: 10k free/month per SKU, then ~$5/1000 | **OSRM self-hosted** on an OpenStreetMap India extract (Geofabrik). No per-call cost; one 8–16 GB RAM VM covers India car+bike profiles. |
| Distance matrix (many drivers → pickup) | Google Route Matrix, same pricing | **OSRM `/table`**, same server. |
| Actual driven distance | — | GPS pings from driver app → **OSRM `/match`** (map-matching) at trip end → billed distance. |
| Driver turn-by-turn navigation | Google Navigation SDK (paid) | **Google Maps app via intent / Maps URLs: no API key, no cost.** Android: `google.navigation:q=lat,lng&mode=d` (mode `l` = two-wheeler). Web: `https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=driving`. |
| Map display (rider tracking, admin live map) | Google Maps JS/SDK (dynamic map loads billed) | **MapLibre GL JS (web) + MapLibre Native (Android)** with free vector tiles (OpenFreeMap, or self-hosted Protomaps PMTiles on object storage). |
| Autocomplete / geocoding | Google Places (expensive per session) | **Ola Maps** (India-focused; free tier 500k–5M calls/month per API depending on current plan) as primary. **Photon/Nominatim self-hosted** as fallback. Cache results in Redis / `saved_places`. |
| Fallback routing | — | Ola Maps Directions/Distance Matrix free tier if OSRM is down. |

### Key rules
- Code against a **MapsProvider interface** (`route()`, `matrix()`, `match()`, `autocomplete()`, `reverseGeocode()`) so providers can be swapped per region from admin settings. Implementations: `osrm`, `olamaps`, `google` (disabled by default).
- Do **not** use the public `tile.openstreetmap.org` / public OSRM demo server in production; their usage policies forbid heavy use.
- OSM attribution ("© OpenStreetMap contributors") must be visible on maps.
- Re-import OSM data weekly (cron job), with zero-downtime swap of the OSRM container.

## Estimated monthly cost at midrange (≈ 50k trips/day)
- OSRM VM (16 GB): ~$60–90 · Photon VM (optional): ~$40 · Tiles: ~$0–20 (R2/S3 + CDN)
- Ola Maps: ₹0 inside the free tier · Google navigation via app intent: ₹0
- The same volume on Google APIs only would cost thousands of $/month.

## Sources
- Google Maps Platform pricing: https://developers.google.com/maps/billing-and-pricing/pricing
- Google Maps URLs (no key needed): https://developers.google.com/maps/documentation/urls/guide
- Maps URL referral architecture: https://developers.google.com/maps/architecture/maps-url
- Ola Maps pricing: https://maps.olakrutrim.com/pricing · announcement: https://tech.olakrutrim.com/ola-maps-made-for-india-priced-for-india/
- OSRM: https://project-osrm.org · Geofabrik India extract: https://download.geofabrik.de/asia/india.html
- MapLibre: https://maplibre.org · OpenFreeMap: https://openfreemap.org · Protomaps: https://protomaps.com
