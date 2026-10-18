# memory/DECISIONS.md — decision log (lightweight ADRs)

Format: `DEC-### — date — decision — why — alternatives — status`. Never edit a past decision; add a new one that supersedes it.

| ID | Date | Decision | Why | Alternatives | Status |
|---|---|---|---|---|---|
| DEC-001 | 2026-10-17 | Modular monolith in NestJS/TypeScript, 3 run modes (api/realtime/worker) | Small team, one language with web, can split along modules later | Go microservices, Spring | Accepted |
| DEC-002 | 2026-10-17 | PostgreSQL + PostGIS as source of truth; Redis for hot geo state | Region polygons, ACID for money; Redis GEO for sub-ms nearest-driver lookup | MongoDB, Tile38 | Accepted |
| DEC-003 | 2026-10-17 | Self-hosted OSRM for all distance/ETA/matrix/map-matching | Free and unlimited; Google Routes costs ~$5/1k beyond 10k free/month per SKU | Google Routes, Mapbox | Accepted |
| DEC-004 | 2026-10-17 | Driver navigation via the Google Maps app (intent / Maps URLs) | Free, no API key, best navigation UX in India | Google Navigation SDK (paid), in-app OSRM navigation | Accepted |
| DEC-005 | 2026-10-17 | MapLibre + free vector tiles for in-app maps | Avoids per-map-load billing | Google Maps SDK | Accepted |
| DEC-006 | 2026-10-17 | Ola Maps as the primary place search; Photon as fallback | India-focused data, large free tier | Google Places (expensive) | Accepted (verify free tier at signup) |
| DEC-007 | 2026-10-17 | REST namespaced by actor + Socket.IO; OpenAPI → generated clients | Simple authz, cacheable, typed clients for TS & Kotlin | GraphQL, gRPC | Accepted |
| DEC-008 | 2026-10-17 | Native Kotlin/Compose, two apps (rider, driver) sharing a core module | Reliable background GPS for drivers; separate store listings | Flutter, React Native, one combined app | Accepted |
| DEC-009 | 2026-10-17 | Sequential best-match dispatch in v1; batch/global matching behind a flag later | Simple, fair, and enough at midrange | Broadcast to all nearby drivers | Accepted |
| DEC-010 | 2026-10-17 | 3 rejections/day, timeouts count, block until local midnight (all configurable per region) | Owner requirement; exact behavior still open (Q4/Q5) | — | Superseded by DEC-015 |
| DEC-011 | 2026-10-17 | Integer paise + double-entry ledger | Correct money, auditable | Float balances | Accepted |
| DEC-012 | 2026-10-17 | UUIDv7 ids; monthly partitions for high-volume tables | Index locality; easy archiving | bigserial | Accepted |
| DEC-013 | 2026-10-17 | India; no hard-coded cities. Regions only via admin; seeds hold catalog defaults only | Owner (P-003): deploy to many cities | Per-city builds | Accepted |
| DEC-014 | 2026-10-17 | Two service types, `city` and `outstation` (one-way/round-trip); outstation uses claim-based dispatch | Owner (P-003) + market research R3 | Separate app for outstation | Accepted |
| DEC-015 | 2026-10-17 | 3 free rejections/day; after that each rejection deducts from the bonus wallet (rules in `rejection_penalty_rules`); optional hard block off by default | Owner (P-003) | Blocking until midnight | Accepted |
| DEC-016 | 2026-10-17 | Commission on every trip + optional subscription plans (priority boost, optional commission override), all admin-defined | Owner (P-003); Namma Yatri/Uber Auto show subscriptions work | Pure commission, pure subscription | Accepted |
| DEC-017 | 2026-10-17 | Driver has two wallets (earnings, bonus). Cash trips auto-debit commission+tax from earnings; negative-balance limit blocks going online | Owner (P-003): auto deduction for cash | Weekly manual invoicing | Accepted |
| DEC-018 | 2026-10-17 | Tamil-inspired theme; English only now; i18n-ready (resource strings, `name_i18n`), fonts with Tamil glyphs | Owner (P-003) | — | Accepted (colors pending review) |
| DEC-019 | 2026-10-18 | Develop and run on the owner's VPS with Docker Compose (public images); every port bound to 127.0.0.1, TLS reverse proxy in front later | Owner (P-006); safe by default on a public server | Native installs on the VPS | Accepted |
