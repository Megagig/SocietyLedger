/**
 * Dashboard Routes
 * Phase 20: Dashboard Real-Data Integration
 * 
 * Route definitions for dashboard endpoints
 */

import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// Apply auth middleware - tenant context comes from user's associationId in JWT
// Note: tenantMiddleware is bypassed globally for /api/dashboard routes
router.use(authMiddleware);

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
