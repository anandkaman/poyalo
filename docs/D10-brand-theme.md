# D10 — Brand, Theme & Localization (source of truth)

**Poyalo** comes from Tamil (roughly "let's go"). The look should feel familiar and warm to Tamil users without being a costume.
The theme draws on things people see every day in Tamil Nadu: turmeric (*manjal*), kumkum and temple maroon, jasmine (*malli*) white,
banana-leaf (*vaazhai ilai*) green, temple-tower (*gopuram*) gold, and *kolam* line patterns.

## 1. Color tokens (proposal, open for owner review)
| Token | Name | Light | Dark | Use |
|---|---|---|---|---|
| `--brand` | Arakku (temple maroon) | `#8C1D40` | `#E57A9A` | Primary buttons, headers, brand mark |
| `--accent` | Manjal (turmeric) | `#F2A900` | `#FFC94D` | Highlights, the "Book" CTA on dark backgrounds, auto category |
| `--go` | Vaazhai ilai (banana leaf) | `#2E7D32` | `#6BCB77` | Success, "Accept", online status, trip started |
| `--danger` | Kumkum red | `#C62828` | `#FF6B6B` | SOS, reject, errors |
| `--gold` | Gopuram gold | `#B8862B` | `#D9AE5C` | Ratings, rewards, subscription badges |
| `--bg` | Malli (jasmine) | `#FFF9F0` | `#141012` | App background |
| `--surface` | | `#FFFFFF` | `#1E191B` | Cards, sheets |
| `--text` | | `#1F1A1C` | `#F3ECEE` | Body text |
| `--muted` | | `#6B6266` | `#A79CA0` | Secondary text |

Rules: text on `--accent` is always `--text` (dark). Never put white text on turmeric. All pairs must pass WCAG AA (≥ 4.5:1 for body text).
Run a contrast check when the tokens are put into code.

**Driver app defaults to dark mode** (night driving, OLED battery). The rider app follows the system setting.

## 2. Motifs & imagery
- **Kolam** dot-grid line art for empty states, loading animations (a kolam line drawing itself), splash screen, and receipt borders. Use it sparingly.
- Map pins: maroon pickup and banana-green drop. Vehicle icons are flat, with a turmeric-yellow auto (a familiar sight in Tamil Nadu cities).
- Illustrations show real Tamil Nadu streetscapes (auto stands, tea stalls, temple towers on the skyline), never stock western cities.
- Tone of copy: friendly and short, like a local friend ("Ready to go? Let's *poyalam*!"). English only for now.

## 3. Typography
Pick font families that already include **Tamil glyphs**, so adding Tamil later needs no redesign:
- Headings: **Catamaran** (designed for Tamil + Latin).
- Body/UI: **Mukta Malar** or **Hind Madurai** (Latin + Tamil, very readable at small sizes).
- Numbers (fares, OTP, ETA): tabular figures.
- Android: bundle them as downloadable Google Fonts. Web: Google Fonts with `display=swap`.

## 4. Localization: English now, multi-language later (i18n-ready from day 1)
- **No hard-coded UI strings.** Android uses `strings.xml` (only `values/` for now; `values-ta/` later). Web/admin use `next-intl` message files (`en.json`; `ta.json`, `hi.json`, `te.json` later).
- The API takes `Accept-Language`. Error responses carry a stable `code`, and the client renders the localized message.
- Admin-entered display text (vehicle type names, zone names, promo titles, notification templates) is stored as `jsonb` maps, e.g. `name_i18n = {"en":"Auto"}`. Clients pick their language and fall back to `en`.
- `users.locale` defaults to `en`.
- Dates, currency (₹, Indian digit grouping: 1,00,000), and distance are formatted through locale-aware formatters, never string concatenation.
- SMS/notification templates are keyed by `(template, locale)`. DLT registration is needed per language when Tamil is added.

## 5. Brand assets to produce (later, in P5/P7)
Logo (wordmark with a subtle kolam loop), app icons (rider: maroon background, driver: turmeric background, so drivers can tell them apart), splash screens, Play Store graphics.
