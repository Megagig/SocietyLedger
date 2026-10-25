/**
 * Dashboard Routes
 * Phase 20: Dashboard Real-Data Integration
 * 
 * Route definitions for dashboard endpoints
 */

import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

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
// Association-wide revenue, dues and member names: officers only. Members hold ledger.view_own, not ledger.view.
router.get('/overview', requirePermission(PERMISSIONS.LEDGER_VIEW), dashboardController.getOverview);

/**
 * GET /api/dashboard/attention
 * Counts of work waiting on the signed-in officer (proofs, approvals, overdue charges, ...), limited to what they may open.
 */
router.get('/attention', dashboardController.getAttention);

export default router;
