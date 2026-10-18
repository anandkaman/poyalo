import type { ErrorCode } from './errors';

/** Response envelope (docs/D3 §3). */
export interface ResponseMeta {
  request_id: string;
  region?: string | null;
  next_cursor?: string | null;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  error: ErrorBody;
  meta: ResponseMeta;
}

/** Money is always integer minor units (paise) + ISO currency. */
export interface Money {
  amount: number;
  currency: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}
