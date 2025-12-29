/**
 * Platform Settings Routes
 * Phase 18: TASK-SET-025
 * 
 * Super Admin only routes for platform management
 */

import { Router } from 'express';
import { PlatformSettingsController } from './platform-settings.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireSuperAdmin } from '../../middleware/rbac';

const router = Router();

// All routes require authentication and super admin role
router.use(authMiddleware);
router.use(requireSuperAdmin);

/**
 * Platform Settings
 */

// GET /api/admin/settings/platform - Get platform settings and stats
router.get('/settings/platform', PlatformSettingsController.getSettings);

// PATCH /api/admin/settings/platform - Update platform settings
router.patch('/settings/platform', PlatformSettingsController.updateSettings);

// GET /api/admin/settings/platform/stats - Get platform stats only
router.get('/settings/platform/stats', PlatformSettingsController.getStats);

/**
 * Association Overrides
 */

// GET /api/admin/associations/:id/override - Get association overrides
router.get('/associations/:id/override', PlatformSettingsController.getAssociationOverride);

// POST /api/admin/associations/:id/override - Set association overrides
router.post('/associations/:id/override', PlatformSettingsController.setAssociationOverride);

export default router;
