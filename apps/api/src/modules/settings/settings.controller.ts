/**
 * Settings Controller
 * Phase 18: Settings Page Architecture
 * 
 * Handles HTTP requests for settings management
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { SettingsService } from './settings.service';
import { LogoService } from './logo.service';
import { SettingsCategory } from './settings.types';
import { validateSettings } from './settings.schema';
import { RuleError } from '../finance/rule-error';

const VALID_CATEGORIES: SettingsCategory[] = [
  'association', 'members_access', 'financial', 'payments',
  'notifications', 'integrations', 'data_privacy', 'platform'
];

export class SettingsController {
  /**
   * GET /api/settings/:category
   * Get all settings for a category
   */
  static async getSettings(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      if (!VALID_CATEGORIES.includes(category as SettingsCategory)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Valid categories: ${VALID_CATEGORIES.join(', ')}`
        });
      }

      const settings = await SettingsService.getSettings(
        associationId, 
        category as SettingsCategory
      );

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch settings'
      });
    }
  }

  /**
   * PATCH /api/settings/:category
   * Update settings for a category
   */
  static async updateSettings(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      if (!VALID_CATEGORIES.includes(category as SettingsCategory)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Valid categories: ${VALID_CATEGORIES.join(', ')}`
        });
      }

      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SETTINGS',
          message: 'No settings provided'
        });
      }

      // Only keys and values this category knows are saved; anything else is refused with a plain message.
      const settings = validateSettings(category as SettingsCategory, req.body);

      const updatedSettings = await SettingsService.updateSettings(
        associationId,
        category as SettingsCategory,
        settings,
        userId
      );

      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: updatedSettings
      });
    } catch (error) {
      if (error instanceof RuleError) {
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      }
      console.error('Error updating settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update settings'
      });
    }
  }

  /**
   * GET /api/settings/association/profile
   * Get association profile (combines association + settings)
   */
  static async getAssociationProfile(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      const profile = await SettingsService.getAssociationProfile(associationId);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error fetching association profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch association profile'
      });
    }
  }

  /**
   * PATCH /api/settings/association/profile
   * Update association profile
   */
  static async updateAssociationProfile(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SETTINGS',
          message: 'No profile data provided'
        });
      }

      const profile = validateSettings('association', req.body);

      const updatedProfile = await SettingsService.updateAssociationProfile(
        associationId,
        profile,
        userId
      );

      res.json({
        success: true,
        message: 'Association profile updated successfully',
        data: updatedProfile
      });
    } catch (error) {
      if (error instanceof RuleError) {
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      }
      console.error('Error updating association profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update association profile'
      });
    }
  }

  /**
   * GET /api/settings/audit-logs
   * G51: tenant-scoped audit log listing — the only prior frontend caller
   * hit a platform-only route and always got "Platform access denied."
   * This one is filtered to the caller's own association.
   */
  static async getAuditLogs(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Number(req.query.limit) || 20);
      const skip = (page - 1) * limit;
      const action = req.query.action as string | undefined;
      const tableName = req.query.tableName as string | undefined;
      const search = req.query.search as string | undefined;

      const whereClause: any = { associationId };
      if (action) {
        whereClause.action = { contains: action, mode: 'insensitive' };
      }
      if (tableName) {
        whereClause.tableName = tableName;
      }
      if (search) {
        whereClause.OR = [
          { action: { contains: search, mode: 'insensitive' } },
          { tableName: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                email: true,
                member: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
        prisma.auditLog.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch audit logs'
      });
    }
  }

  /**
   * GET /api/settings/export
   * Export all settings for the association
   */
  static async exportSettings(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      const allSettings = await SettingsService.exportAllSettings(associationId);

      res.json({
        success: true,
        data: allSettings
      });
    } catch (error) {
      console.error('Error exporting settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export settings'
      });
    }
  }

  /**
   * POST /api/settings/association/logo
   * Upload association logo
   */
  static async uploadLogo(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const result = await LogoService.uploadLogo(associationId, file, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: { logoUrl: result.logoUrl }
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload logo'
      });
    }
  }

  /**
   * DELETE /api/settings/association/logo
   * Delete association logo
   */
  static async deleteLogo(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(400).json({
          success: false,
          message: 'Association context required'
        });
      }

      const result = await LogoService.deleteLogo(associationId, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error deleting logo:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete logo'
      });
    }
  }
}
