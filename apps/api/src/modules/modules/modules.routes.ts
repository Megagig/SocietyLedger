import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { ModuleFeatureService } from '../../services/module-feature.service';

const router: Router = Router();

router.use(authMiddleware);

/**
 * Get the caller's own association's enabled modules/features (G13) — the
 * tenant-facing equivalent of platform-admin.controller.ts's getModulesAndFeatures,
 * which is platform-only and takes an arbitrary associationId. Used by the Sidebar
 * to show real plan-driven badges instead of hardcoded ones.
 * GET /api/modules/mine
 */
router.get('/mine', async (req: AuthRequest, res: Response) => {
  try {
    const associationId = req.user?.associationId;
    if (!associationId) {
      return res.status(400).json({ success: false, message: 'Association ID is required' });
    }

    const [modules, features] = await Promise.all([
      ModuleFeatureService.getEnabledModules(associationId),
      ModuleFeatureService.getEnabledFeatures(associationId),
    ]);

    return res.json({ success: true, data: { modules, features } });
  } catch (error) {
    console.error('Error fetching own modules/features:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch modules' });
  }
});

export default router;
