/**
 * Dashboard Routes
 * Phase 20: Dashboard Real-Data Integration
 * 
 * Route definitions for dashboard endpoints
 */

import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';

const router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// ==========================================
// DASHBOARD ROUTES
// ==========================================

/**
 * TASK-DASH-008: Dashboard Overview
 * GET /api/dashboard/overview
 * 
 * Returns aggregated dashboard data including:
 * - Member statistics
 * - Financial summary
 * - Revenue trend (6 months)
 * - Payment methods distribution
 * - Recent transactions
 * - Quick stats with month-over-month comparison
 */
router.get('/overview', dashboardController.getOverview);

export default router;
