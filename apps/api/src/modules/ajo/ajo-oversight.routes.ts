/**
 * SocietyLedger staff oversight of Ajo groups (T9.2), mounted at /api/admin/ajo-oversight ahead of the SUPER_ADMIN-only /api/admin router
 * (like the verification and levy routes), because finance, compliance and support staff need it too:
 *  - SUPER_ADMIN, FINANCE_ADMIN, COMPLIANCE_ADMIN and SUPPORT_AGENT can look at groups;
 *  - only SUPER_ADMIN and FINANCE_ADMIN can override: void an open payout, or move a group to another tier. Each needs a reason;
 *  - only SUPER_ADMIN can suspend or reactivate the owner of a group (the platform's one suspend path), and only SUPER_ADMIN and FINANCE_ADMIN see revenue.
 */
import { Request, Response, Router } from 'express';
import { PlatformRole } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { BillingError } from '../../services/billing/quote.service';
import type { Actor } from '../../services/billing/lifecycle.service';
import { fail } from './ajo-members.controller';
import { ajoAnalytics } from './ajo-analytics.service';
import { changeGroupTier, getGroup, listGroups, previewGroupTier, setOwnerSuspended, voidPayoutAsStaff } from './ajo-oversight.service';

const router: Router = Router();
const id = z.coerce.number().int().positive();

router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN, PlatformRole.FINANCE_ADMIN, PlatformRole.COMPLIANCE_ADMIN, PlatformRole.SUPPORT_AGENT]));
const mayOverride = requirePlatformRole([PlatformRole.SUPER_ADMIN, PlatformRole.FINANCE_ADMIN]);
const seesRevenue = mayOverride;
const superAdminOnly = requirePlatformRole([PlatformRole.SUPER_ADMIN]);

const staff = (req: Request): Actor => ({ id: req.user!.id, role: String(req.user?.platformRole ?? 'SUPER_ADMIN'), ipAddress: req.ip, userAgent: req.get('user-agent') ?? undefined });

/** A billing refusal (a downgrade blocked by the group's size, a missing subscription) is a clear message, not a server error. */
function failWith(res: Response, error: unknown, fallback: string) {
  if (error instanceof BillingError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  return fail(res, error, fallback);
}

/**
 * GET /api/admin/ajo-oversight/whoami: the signed-in staff member's platform role, so the screens know which buttons to show. The general
 * /api/admin/me is SUPER_ADMIN-only, so compliance and finance staff could not use it. The server still enforces every permission.
 */
router.get('/whoami', (req: Request, res: Response) => res.json({ success: true, data: { platformRole: String(req.user?.platformRole ?? '') } }));

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  kind: z.enum(['ASSOCIATION', 'THRIFT_GROUP']).optional(),
  status: z.enum(['DRAFT', 'OPEN', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  model: z.enum(['COLLECTOR_THRIFT', 'ROTATING_POT']).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

/** GET /api/admin/ajo-oversight/groups */
router.get('/groups', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await listGroups(listSchema.parse(req.query)) });
  } catch (error) {
    return fail(res, error, 'Could not load the groups.');
  }
});

/** GET /api/admin/ajo-oversight/groups/:id */
router.get('/groups/:id', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await getGroup(id.parse(req.params.id)) });
  } catch (error) {
    return fail(res, error, 'Could not load this group.');
  }
});

/** GET /api/admin/ajo-oversight/groups/:id/tier-preview?targetAddonId=3 */
router.get('/groups/:id/tier-preview', async (req: Request, res: Response) => {
  try {
    const { targetAddonId } = z.object({ targetAddonId: id }).parse(req.query);
    return res.json({ success: true, data: await previewGroupTier({ groupId: id.parse(req.params.id), targetAddonId }) });
  } catch (error) {
    return failWith(res, error, 'Could not check that tier change.');
  }
});

const tierSchema = z.object({ targetAddonId: id, reason: z.string() });

/** POST /api/admin/ajo-oversight/groups/:id/tier (SUPER_ADMIN and FINANCE_ADMIN only) */
router.post('/groups/:id/tier', mayOverride, async (req: Request, res: Response) => {
  try {
    const body = tierSchema.parse(req.body ?? {});
    const result = await changeGroupTier({ groupId: id.parse(req.params.id), ...body, actor: staff(req) });
    const message = result.applied === 'NOW' ? 'The tier has been changed.' : result.applied === 'PERIOD_END' ? 'The downgrade is scheduled for the end of the paid period.' : 'The waiting downgrade was cancelled.';
    return res.json({ success: true, message, data: result });
  } catch (error) {
    return failWith(res, error, 'Could not change the tier.');
  }
});

/** POST /api/admin/ajo-oversight/payouts/:id/void (SUPER_ADMIN and FINANCE_ADMIN only) */
router.post('/payouts/:id/void', mayOverride, async (req: Request, res: Response) => {
  try {
    const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
    const result = await voidPayoutAsStaff({ payoutId: id.parse(req.params.id), reason, actor: staff(req) });
    return res.json({ success: true, message: result.replayed ? 'Already cancelled.' : 'The payout has been cancelled.', data: result });
  } catch (error) {
    return fail(res, error, 'Could not cancel the payout.');
  }
});

/** GET /api/admin/ajo-oversight/analytics (revenue, so SUPER_ADMIN and FINANCE_ADMIN only) */
router.get('/analytics', seesRevenue, async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await ajoAnalytics() });
  } catch (error) {
    return fail(res, error, 'Could not load the analytics.');
  }
});

const ownerSchema = z.object({ reason: z.string() });
const ownerStatus = (suspend: boolean) => async (req: Request, res: Response) => {
  try {
    const { reason } = ownerSchema.parse(req.body ?? {});
    const result = await setOwnerSuspended({ groupId: id.parse(req.params.id), suspend, reason, actor: staff(req) });
    return res.json({ success: true, message: suspend ? 'Suspended.' : 'Reactivated.', data: result });
  } catch (error) {
    return fail(res, error, suspend ? 'Could not suspend.' : 'Could not reactivate.');
  }
};

/** POST /api/admin/ajo-oversight/groups/:id/owner/suspend and /reactivate (SUPER_ADMIN only) */
router.post('/groups/:id/owner/suspend', superAdminOnly, ownerStatus(true));
router.post('/groups/:id/owner/reactivate', superAdminOnly, ownerStatus(false));

export default router;
