/**
 * Settings Routes
 * Phase 18: Settings Page Architecture
 * 
 * All routes require authentication and appropriate permissions
 */

import { Router } from 'express';
import multer from 'multer';
import { SettingsController } from './settings.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// Configure multer for logo uploads (memory storage for processing)
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

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
 * Logo Upload Routes (TASK-SET-007)
 */

// POST /api/settings/association/logo - Upload association logo
router.post(
  '/association/logo',
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  logoUpload.single('logo'),
  SettingsController.uploadLogo
);

// DELETE /api/settings/association/logo - Delete association logo
router.delete(
  '/association/logo',
  requirePermission(PERMISSIONS.SETTINGS_EDIT),
  SettingsController.deleteLogo
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
 * Audit Log Route (G51)
 */

// GET /api/settings/audit-logs - tenant-scoped audit log listing
router.get(
  '/audit-logs',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  SettingsController.getAuditLogs
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
