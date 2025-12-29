/**
 * Settings Controller
 * Phase 18: Settings Page Architecture
 * 
 * Handles HTTP requests for settings management
 */

import { Request, Response } from 'express';
import { SettingsService } from './settings.service';
import { SettingsCategory } from './settings.types';

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

      const settings = req.body;

      if (!settings || Object.keys(settings).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No settings provided'
        });
      }

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

      const profile = req.body;

      if (!profile || Object.keys(profile).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No profile data provided'
        });
      }

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
      console.error('Error updating association profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update association profile'
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
}
