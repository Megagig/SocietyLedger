/**
 * Settings Routes
 * Phase 18: Settings Page Architecture
 * 
 * All routes require authentication and appropriate permissions
 */

import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Association Profile Routes
 */

// GET /api/settings/association/profile - Get association profile
router.get(
  '/association/profile',
  requireAnyPermission([PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT]),
  SettingsController.getAssociationProfile
);

// PATCH /api/settings/association/profile - Update association profile
router.patch(
  '/association/profile',
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  SettingsController.updateAssociationProfile
);

/**
 * Export Route
 */

// GET /api/settings/export - Export all settings
router.get(
  '/export',
  requirePermission(PERMISSIONS.SETTINGS_VIEW),
  SettingsController.exportSettings
);

/**
 * Category-based Settings Routes
 * 
 * Permission mapping:
 * - association: settings.view / settings.edit
 * - members_access: settings.view / settings.edit
 * - financial: settings.view / settings.edit (with extra caution)
 * - payments: settings.billing
 * - notifications: settings.view / settings.edit
 * - integrations: settings.integrations
 * - data_privacy: settings.view / settings.edit
 * - platform: super admin only (handled separately)
 */

// GET /api/settings/:category - Get settings for a category
router.get(
  '/:category',
  requireAnyPermission([
    PERMISSIONS.SETTINGS_VIEW, 
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.SETTINGS_BILLING,
    PERMISSIONS.SETTINGS_INTEGRATIONS
  ]),
  SettingsController.getSettings
);

// PATCH /api/settings/:category - Update settings for a category
router.patch(
  '/:category',
  requireAnyPermission([
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.SETTINGS_BILLING,
    PERMISSIONS.SETTINGS_INTEGRATIONS
  ]),
  SettingsController.updateSettings
);

export default router;
