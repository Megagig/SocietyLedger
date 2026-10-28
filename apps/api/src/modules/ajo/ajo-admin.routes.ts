/**
 * SocietyLedger staff review of Ajo participants (T2.3), mounted at /api/admin/ajo. Mounted ahead of the SUPER_ADMIN-only /api/admin router
 * (like support), because compliance and support staff need it too:
 *  - SUPER_ADMIN, COMPLIANCE_ADMIN and SUPPORT_AGENT can view the queue and a person's details;
 *  - only SUPER_ADMIN and COMPLIANCE_ADMIN can decide.
 */
import { Request, Response, Router } from 'express';
import { PlatformRole } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { fail } from './ajo-members.controller';
import { decideVerification, getVerificationDetail, listVerificationQueue } from './ajo-verification.service';

const router: Router = Router();
const id = z.coerce.number().int().positive();

router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN, PlatformRole.COMPLIANCE_ADMIN, PlatformRole.SUPPORT_AGENT]));

const querySchema = z.object({
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
  associationId: z.coerce.number().int().positive().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

/** GET /api/admin/ajo/verifications?status=PENDING */
router.get('/verifications', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await listVerificationQueue(querySchema.parse(req.query)) });
  } catch (error) {
    return fail(res, error, 'Could not load the verification queue.');
  }
});

/** GET /api/admin/ajo/verifications/:id */
router.get('/verifications/:id', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await getVerificationDetail(id.parse(req.params.id)) });
  } catch (error) {
    return fail(res, error, 'Could not load this verification.');
  }
});

const decisionSchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  checklist: z.object({ nameMatchesAccount: z.boolean(), phoneConfirmed: z.boolean(), addressFilled: z.boolean() }),
  reason: z.string().trim().max(500).optional(),
});

/** POST /api/admin/ajo/verifications/:id/decision (SUPER_ADMIN and COMPLIANCE_ADMIN only) */
router.post('/verifications/:id/decision', requirePlatformRole([PlatformRole.SUPER_ADMIN, PlatformRole.COMPLIANCE_ADMIN]), async (req: Request, res: Response) => {
  try {
    const body = decisionSchema.parse(req.body);
    const result = await decideVerification({
      verificationId: id.parse(req.params.id),
      reviewerId: req.user!.id,
      reviewerRole: String(req.user?.platformRole ?? 'SUPER_ADMIN'),
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      ...body,
    });
    return res.json({ success: true, message: body.decision === 'VERIFIED' ? 'Verified.' : 'Rejected. The group admin has been told why.', data: result });
  } catch (error) {
    return fail(res, error, 'Could not save the decision.');
  }
});

export default router;
