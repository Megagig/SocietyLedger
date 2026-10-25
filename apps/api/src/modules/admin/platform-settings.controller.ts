/**
 * Platform Settings Controller
 * Phase 18: TASK-SET-025
 * 
 * Super Admin only endpoints for platform management
 */

import { Request, Response } from 'express';
import { PlatformSettingsService } from './platform-settings.service';
import { aiSettingsService } from '../ai/ai-settings.service';
import { aiAdminService } from '../ai/ai-admin.service';
import { AiCreditsError, DEFAULT_AI_SETTINGS } from '../ai/ai-credits-rules';

export class PlatformSettingsController {
  /**
   * GET /api/admin/settings/platform
   * Get platform settings and stats
   */
  static async getSettings(req: Request, res: Response) {
    try {
      const [settings, stats] = await Promise.all([
        PlatformSettingsService.getSettings(),
        PlatformSettingsService.getStats()
      ]);

      res.json({
        success: true,
        data: { settings, stats }
      });
    } catch (error) {
      console.error('Error fetching platform settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch platform settings'
      });
    }
  }

  /**
   * PATCH /api/admin/settings/platform
   * Update platform settings
   */
  static async updateSettings(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const settings = req.body;

      if (!settings || Object.keys(settings).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No settings provided'
        });
      }

      const updatedSettings = await PlatformSettingsService.updateSettings(settings, userId);

      res.json({
        success: true,
        message: 'Platform settings updated',
        data: updatedSettings
      });
    } catch (error) {
      console.error('Error updating platform settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update platform settings'
      });
    }
  }

  /**
   * GET /api/admin/settings/platform/stats
   * Get platform statistics only
   */
  static async getStats(req: Request, res: Response) {
    try {
      const stats = await PlatformSettingsService.getStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch platform stats'
      });
    }
  }

  /** GET /api/admin/settings/ai */
  static async getAiSettings(_req: Request, res: Response) {
    try {
      res.json({ success: true, data: { settings: await aiSettingsService.get(), defaults: DEFAULT_AI_SETTINGS } });
    } catch (error) {
      console.error('Error fetching AI settings:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch AI settings' });
    }
  }

  /** PATCH /api/admin/settings/ai */
  static async updateAiSettings(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    try {
      const settings = await aiSettingsService.update(req.body, userId);
      res.json({ success: true, message: 'AI settings updated', data: { settings, defaults: DEFAULT_AI_SETTINGS } });
    } catch (error) {
      if (error instanceof AiCreditsError) {
        return res.status(error.status).json({ success: false, message: error.message, code: error.code });
      }
      console.error('Error updating AI settings:', error);
      res.status(500).json({ success: false, message: 'Failed to update AI settings' });
    }
  }

  /** GET /api/admin/ai/usage?days=30 */
  static async getAiUsage(req: Request, res: Response) {
    try {
      const days = req.query.days ? Number(req.query.days) : undefined;
      res.json({ success: true, data: await aiAdminService.usage(Number.isFinite(days) ? days : undefined) });
    } catch (error) {
      console.error('Error fetching AI usage:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch AI usage' });
    }
  }

  /**
   * POST /api/admin/associations/:id/override
   * Set limit overrides for an association
   */
  static async setAssociationOverride(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = parseInt(req.params.id);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (isNaN(associationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid association ID'
        });
      }

      const { maxMembers, maxUsers, customFeatures, notes } = req.body;

      await PlatformSettingsService.setAssociationOverride(
        { associationId, maxMembers, maxUsers, customFeatures, notes },
        userId
      );

      res.json({
        success: true,
        message: 'Association overrides updated'
      });
    } catch (error: any) {
      console.error('Error setting association override:', error);
      res.status(error.message === 'Association not found' ? 404 : 500).json({
        success: false,
        message: error.message || 'Failed to set association override'
      });
    }
  }

  /**
   * GET /api/admin/associations/:id/override
   * Get limit overrides for an association
   */
  static async getAssociationOverride(req: Request, res: Response) {
    try {
      const associationId = parseInt(req.params.id);

      if (isNaN(associationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid association ID'
        });
      }

      const override = await PlatformSettingsService.getAssociationOverride(associationId);

      res.json({
        success: true,
        data: override
      });
    } catch (error) {
      console.error('Error fetching association override:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch association override'
      });
    }
  }
}
