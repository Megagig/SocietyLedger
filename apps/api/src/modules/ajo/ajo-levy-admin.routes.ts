/**
 * SocietyLedger staff view of the Ajo platform levy (T5.4), mounted at /api/admin/ajo-levy ahead of the SUPER_ADMIN-only /api/admin router
 * (like the verification routes), because finance and support staff need it too:
 *  - SUPER_ADMIN, FINANCE_ADMIN and SUPPORT_AGENT can see the levy and the report;
 *  - only SUPER_ADMIN and FINANCE_ADMIN can waive or void a levy.
 * The report is the levy on its own, apart from subscription payments.
 */
import { Request, Response, Router } from 'express';
import { PlatformRole } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { fail } from './ajo-members.controller';
import { levyReport, listLevy, setLevyStatus } from './ajo-levy.service';

const router: Router = Router();
const id = z.coerce.number().int().positive();

router.use(authMiddleware, requirePlatformRole([PlatformRole.SUPER_ADMIN, PlatformRole.FINANCE_ADMIN, PlatformRole.SUPPORT_AGENT]));

const querySchema = z.object({
  status: z.enum(['ACCRUED', 'BILLED', 'PAID', 'WAIVED', 'VOID']).optional(),
  associationId: z.coerce.number().int().positive().optional(),
  groupId: z.coerce.number().int().positive().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

/** GET /api/admin/ajo-levy?status=ACCRUED&associationId=5 */
router.get('/', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: await listLevy(querySchema.parse(req.query)) });
  } catch (error) {
    return fail(res, error, 'Could not load the levy.');
  }
});

/** GET /api/admin/ajo-levy/report: the levy per association and status, apart from subscription payments. */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const { associationId } = z.object({ associationId: z.coerce.number().int().positive().optional() }).parse(req.query);
    return res.json({ success: true, data: await levyReport({ associationId }) });
  } catch (error) {
    return fail(res, error, 'Could not load the levy report.');
  }
});

const change = (to: 'WAIVED' | 'VOID') => async (req: Request, res: Response) => {
  try {
    const { reason } = z.object({ reason: z.string() }).parse(req.body ?? {});
    const result = await setLevyStatus({ id: id.parse(req.params.id), to, reason, staffId: req.user!.id, staffRole: String(req.user?.platformRole ?? 'SUPER_ADMIN'), ipAddress: req.ip, userAgent: req.get('user-agent') ?? undefined });
    return res.json({ success: true, message: result.replayed ? 'Already done.' : to === 'WAIVED' ? 'Waived.' : 'Voided.', data: result });
  } catch (error) {
    return fail(res, error, 'Could not change the levy.');
  }
};

const mayChange = requirePlatformRole([PlatformRole.SUPER_ADMIN, PlatformRole.FINANCE_ADMIN]);
router.post('/:id/waive', mayChange, change('WAIVED'));
router.post('/:id/void', mayChange, change('VOID'));

export default router;
