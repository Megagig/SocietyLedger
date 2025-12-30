/**
 * Dashboard Controller
 * Phase 20: Dashboard Real-Data Integration
 * Phase 12: Caching & Performance - Uses cached service
 * 
 * HTTP handlers for dashboard endpoints
 */

import { Request, Response } from 'express';
import { cachedDashboardService } from './dashboard-cached.service';

// ============================================
// DASHBOARD CONTROLLER
// ============================================

export const dashboardController = {
  /**
   * TASK-DASH-007: Get dashboard overview
   * GET /api/dashboard/overview
   * 
   * Returns all dashboard data in a single aggregated response
   * Uses cached service for improved performance (5 min TTL)
   */
  async getOverview(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      
      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const overview = await cachedDashboardService.getDashboardOverview(associationId);

      return res.status(200).json({
        success: true,
        data: overview,
      });
    } catch (error) {
      console.error('Error fetching dashboard overview:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard data',
      });
    }
  },
};
