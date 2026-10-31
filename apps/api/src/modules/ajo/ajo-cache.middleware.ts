/**
 * Any Ajo write makes the association's cached Ajo answers out of date. This runs for every non-read request under /api/ajo (after sign-in, so
 * the association is known) and bumps the version BEFORE the response is sent, so the person who just saved something cannot be handed an
 * older copy by their very next read. It bumps whatever the outcome: a failed write may still have changed something, and a needless bump
 * only costs a recompute.
 */
import type { NextFunction, Request, Response } from 'express';
import { bumpAjoCache } from './ajo-cache';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function bumpAjoCacheOnWrite(req: Request, res: Response, next: NextFunction): void {
  const associationId = req.user?.associationId;
  if (READ_METHODS.has(req.method) || !associationId) return next();

  const end = res.end.bind(res) as (...args: unknown[]) => Response;
  let ended = false;
  (res as unknown as { end: (...args: unknown[]) => Response }).end = (...args: unknown[]) => {
    if (ended) return res;
    ended = true;
    // Bump first, then let the response go.
    void bumpAjoCache(associationId).finally(() => {
      end(...args);
    });
    return res;
  };
  next();
}
