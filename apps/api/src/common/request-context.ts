import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { type ClientKind, Headers, isClientKind } from '@poyalo/contracts';
import { newId } from './ids';

/** Parsed standard headers (docs/D3 §2), attached to every request as `req.ctx`. */
export interface RequestContext {
  requestId: string;
  client: ClientKind | null;
  appVersion: string | null;
  deviceId: string | null;
  /** Region code from `X-Region`. Resolution from lat/lng or the user's home region comes in P1. */
  regionCode: string | null;
  lat: number | null;
  lng: number | null;
  locale: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx: RequestContext;
    }
  }
}

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;
const REGION_RE = /^[A-Z]{2}-[A-Z0-9]{2,10}$/;

function header(req: Request, name: string): string | null {
  const v = req.headers[name];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : null;
}

function coord(raw: string | null, limit: number): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

export function buildRequestContext(req: Request): RequestContext {
  const incomingId = header(req, Headers.requestId);
  const pinoId = typeof req.id === 'string' ? req.id : null;
  const client = header(req, Headers.client);
  const region = header(req, Headers.region)?.toUpperCase() ?? null;
  // English only for now (docs/D10 §4); the language tag is still read so the plumbing exists.
  const lang = header(req, Headers.acceptLanguage)?.split(',')[0]?.split('-')[0]?.toLowerCase();

  return {
    requestId: incomingId && REQUEST_ID_RE.test(incomingId) ? incomingId : (pinoId ?? newId()),
    client: isClientKind(client) ? client : null,
    appVersion: header(req, Headers.appVersion),
    deviceId: header(req, Headers.deviceId),
    regionCode: region && REGION_RE.test(region) ? region : null,
    lat: coord(header(req, Headers.lat), 90),
    lng: coord(header(req, Headers.lng), 180),
    locale: lang || 'en',
  };
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    req.ctx = buildRequestContext(req);
    res.setHeader('X-Request-Id', req.ctx.requestId);
    next();
  }
}
