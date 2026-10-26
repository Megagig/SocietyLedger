import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { getEntitlements } from '../services/billing/entitlements.service';

/**
 * Plan limits are enforced here, from the tenant's entitlements (its plan version plus add-ons), not from a loose JSON column on the plan.
 * Whether the tenant may use the app at all (expired, locked out) is decided earlier, by the access check in the auth middleware.
 */

/** How many active members the tenant has and how many its plan allows (null = unlimited). */
export async function memberCapacity(associationId: number): Promise<{ limit: number | null; count: number }> {
  const [entitlements, count] = await Promise.all([
    getEntitlements(associationId),
    prisma.member.count({ where: { associationId, status: 'active' } }),
  ]);
  const limit = entitlements.limits.members;
  return { limit: limit === undefined ? null : limit, count };
}

/**
 * Refuse a request that would take the association past its member limit.
 * `adding` says how many members the request creates (1 for a single add, the list length for a bulk import).
 */
export function memberLimitMiddleware(adding: (req: Request) => number = () => 1) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return next();

      const { limit, count } = await memberCapacity(associationId);
      if (limit === null) return next();

      const wanted = Math.max(0, adding(req));
      if (count + wanted > limit) {
        return res.status(403).json({
          success: false,
          message: `Your plan allows ${limit} active members and you have ${count}. Upgrade your plan or add the Extra members add-on to add more.`,
          code: 'MEMBER_LIMIT_REACHED',
          requiresUpgrade: true,
          limit,
          currentCount: count,
        });
      }
      next();
    } catch (error) {
      // A failure of the check itself must not stop an association from managing its own members.
      console.error('Member limit middleware error:', error);
      next();
    }
  };
}
