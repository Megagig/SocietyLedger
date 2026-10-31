/**
 * Default cache headers for /api.
 *
 *   reads   `private, no-cache`  the browser or app may keep a copy but must ask the server if it changed (Express already sends an ETag, so an
 *                                unchanged answer is a tiny 304). `private` means a shared cache or CDN may never store it, so one
 *                                association's answer cannot be served to another.
 *   writes  `no-store`
 *
 * No `max-age` on purpose: a person who has just saved something must see it on the next read, and a browser holding a fresh copy would
 * hide it. Freshness windows belong to the apps' query cache, which is told to refresh after a change.
 *
 * Set before the route runs, so a handler that sets its own Cache-Control (public pricing, a signed link, a download) simply overrides it.
 * `Vary` lists what the answer depends on, so a cache that is allowed to keep it keeps one copy per person and per association.
 */
import type { NextFunction, Request, Response } from 'express';

const READ_METHODS = new Set(['GET', 'HEAD']);

export function apiCacheHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', READ_METHODS.has(req.method) ? 'private, no-cache' : 'no-store');
  res.vary('Authorization');
  res.vary('X-Tenant');
  next();
}
