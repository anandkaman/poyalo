/** Standard request headers (docs/D3 §2). Lower-case, as Node exposes them. */
export const Headers = {
  authorization: 'authorization',
  client: 'x-client',
  appVersion: 'x-app-version',
  deviceId: 'x-device-id',
  region: 'x-region',
  lat: 'x-lat',
  lng: 'x-lng',
  idempotencyKey: 'idempotency-key',
  requestId: 'x-request-id',
  acceptLanguage: 'accept-language',
} as const;

export const CLIENTS = ['rider-android', 'driver-android', 'web', 'admin-web'] as const;
export type ClientKind = (typeof CLIENTS)[number];

export function isClientKind(value: unknown): value is ClientKind {
  return typeof value === 'string' && (CLIENTS as readonly string[]).includes(value);
}
