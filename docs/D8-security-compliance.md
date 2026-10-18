# D8 — Security, Privacy & Safety (source of truth)

## Auth & sessions
- Phone OTP: 6 digits, hashed (HMAC), 5-minute expiry, at most 5 tries, rate limits from D3 §6. DLT-registered SMS templates (India TRAI rules).
- JWT access token (15 min, signed with ES256, key rotation via `kid`) + refresh token (30 days, rotated on each use, reuse → revoke the whole session family).
- Sessions are bound to `X-Device-Id`. Drivers have one active device at a time. Admins: password (argon2id) + TOTP, 8 h sessions.
- Android: Play Integrity API check at login (driver app first); certificate pinning; tokens in EncryptedSharedPreferences / DataStore + Keystore.

## Authorization
- Actor namespace guard (a rider token can never call `/driver/*`), resource ownership checks (a rider only sees their own trips), admin permission + region guards.
- The rider sees driver details only while a trip is active. Phone numbers are masked (masked calling in v1.5).

## Data protection (India DPDP Act 2023)
- PII fields encrypted at the app level (Aadhaar/DL numbers, payout accounts) with envelope encryption (KMS). Search by HMAC blind index.
- KYC files in a private R2 bucket, served only through short-lived signed URLs to `kyc_reviewer` admins; every view is audited.
- Retention: GPS traces 180 days, then aggregated; KYC per legal requirement; account deletion flow (`DELETE /rider/me`) with legal holds.
- Payment card data is never stored (Razorpay tokenization), so PCI scope is SAQ-A.
- Consent records for location and marketing.

## Fraud & abuse
- GPS spoofing: mock-location detection on Android, speed/teleport checks server-side, Play Integrity.
- Fake trips / collusion: alerts for the same device or the same payment instrument on rider and driver, very short trips, repeated rider-driver pairs.
- Promo abuse: per-device + per-phone + per-payment-instrument limits.
- Webhooks: HMAC verification, replay protection with event IDs.

## Safety
- SOS: pushes to the ops queue + emergency contacts (SMS with a live link) + shows 112. The trip is flagged and its trace kept.
- Trip share link: time-limited token, read-only.
- Start OTP stops the wrong rider from getting in. Driver photo and plate are shown to the rider.

## AppSec baseline
OWASP ASVS L2 checklist, dependency scanning (Dependabot + `pnpm audit`), SAST (CodeQL), secrets in a secret manager only, no PII in logs, regular security review before each release.
