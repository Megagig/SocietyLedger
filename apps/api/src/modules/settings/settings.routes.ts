/**
 * Settings Routes
 * Phase 18: Settings Page Architecture
 * 
 * All routes require authentication and appropriate permissions
 */

import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { SettingsController } from './settings.controller';
import { SETTINGS_READ_PERMISSIONS, SETTINGS_WRITE_PERMISSIONS } from './settings.schema';
import type { SettingsCategory } from './settings.types';
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

/**
 * Each category has its own permission: any of the three settings permissions used to be enough to change any category, so a
 * billing officer could switch off member sign-up. `platform` is SocietyLedger staff only and never reachable from here.
 */
function categoryGate(kind: 'read' | 'write'): RequestHandler {
  return (req, res, next) => {
    const category = req.params.category as SettingsCategory;
    const permissions = (kind === 'read' ? SETTINGS_READ_PERMISSIONS : SETTINGS_WRITE_PERMISSIONS)[category];
    if (!permissions) {
      const known = category === 'platform';
      res.status(known ? 403 : 400).json({
        success: false,
        code: known ? 'SETTINGS_NOT_EDITABLE' : 'INVALID_CATEGORY',
        message: known ? 'These settings belong to SocietyLedger and cannot be changed here.' : 'That settings page does not exist.',
      });
      return;
    }
    requireAnyPermission(permissions)(req, res, next);
  };
}

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
  (req, res, next) => {
    // A rejected file answers 400 in plain words, not the default error page.
    logoUpload.single('logo')(req, res, (error: unknown) => {
      if (!error) return next();
      const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({
        success: false,
        code: tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_FILE',
        message: tooLarge ? 'The picture is larger than 2MB.' : 'Use a JPEG, PNG or WebP picture.',
      });
    });
  },
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

// GET /api/settings/audit-logs/filters - the kinds of activity recorded, for filter choices
router.get(
  '/audit-logs/filters',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  SettingsController.getAuditFilters
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
router.get('/:category', categoryGate('read'), SettingsController.getSettings);

// PATCH /api/settings/:category - Update settings for a category
router.patch('/:category', categoryGate('write'), SettingsController.updateSettings);

export default router;
