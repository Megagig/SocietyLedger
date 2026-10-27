/**
 * /api/ajo: the Thrift (Ajo) add-on. Every route sits behind sign-in, the tenant and `requireAjoAccess()`, so a tenant without the add-on
 * gets MODULE_DISABLED and one whose add-on expired can read and export but not write (ADDON_EXPIRED). Later phases add their routes here.
 */
import { Request, Response, Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { AJO_MODULE, requireAjoAccess, type AjoRequest } from './ajo-access';
import { contributorCapacity } from './ajo-capacity';

const router: Router = Router();

router.use(authMiddleware);
router.use(requireAjoAccess());

/**
 * GET /api/ajo/status: what the signed-in tenant can do with Ajo right now, and how much of its contributor quota is used.
 * The apps read this to decide whether to show the write buttons, the "expired" banner and the "upgrade" prompt.
 */
router.get(
  '/status',
  requireAnyPermission([PERMISSIONS.AJO_VIEW_OWN, PERMISSIONS.AJO_MANAGE, PERMISSIONS.AJO_COLLECT]),
  async (req: Request, res: Response) => {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const capacity = await contributorCapacity(associationId);
      const access = (req as AjoRequest).ajoAccess ?? 'FULL';
      return res.json({
        success: true,
        data: {
          module: AJO_MODULE,
          access,
          readOnly: access === 'READ_ONLY',
          contributors: { limit: capacity.limit, count: capacity.count, remaining: capacity.limit === null ? null : Math.max(0, capacity.limit - capacity.count) },
        },
      });
    } catch (error) {
      console.error('Ajo status error:', error);
      return res.status(500).json({ success: false, message: 'Could not load your Ajo status.' });
    }
  },
);

export default router;
