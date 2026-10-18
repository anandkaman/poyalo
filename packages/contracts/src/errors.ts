/**
 * Stable machine error codes (docs/D3 §3). Clients map `code` to a localized message.
 * Never rename a code; add new ones instead.
 */
export const ErrorCodes = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REGION_NOT_SERVICEABLE: 422,
  VEHICLE_TYPE_UNAVAILABLE: 422,
  QUOTE_EXPIRED: 410,
  TRIP_NOT_FOUND: 404,
  INVALID_TRIP_STATE: 409,
  OFFER_EXPIRED: 410,
  OFFER_ALREADY_TAKEN: 409,
  DRIVER_NOT_APPROVED: 403,
  DRIVER_NEGATIVE_BALANCE: 403,
  OTP_INVALID: 400,
  OTP_RATE_LIMITED: 429,
  PAYMENT_FAILED: 402,
  IDEMPOTENCY_CONFLICT: 409,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  RATE_LIMITED: 429,
  UPGRADE_REQUIRED: 426,
  MAINTENANCE: 503,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export function httpStatusFor(code: ErrorCode): number {
  return ErrorCodes[code];
}
