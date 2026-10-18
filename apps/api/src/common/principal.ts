import type { Request } from 'express';

/**
 * Key that identifies "who is calling" for idempotency and rate limits.
 * Until auth lands (P1) this is the device id, falling back to the IP address.
 */
export function principalKey(req: Request): string {
  const user = (req as Request & { user?: { sub?: string; act?: string } }).user;
  if (user?.sub) return `${user.act ?? 'u'}:${user.sub}`;
  if (req.ctx?.deviceId) return `dev:${req.ctx.deviceId}`;
  return `ip:${req.ip ?? 'unknown'}`;
}
