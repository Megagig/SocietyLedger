// ============================================
// PHASE 21: SUPPORT ROUTES
// Ticket management endpoints
// ============================================

import { Router } from 'express';
import { supportController } from './support.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router: Router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==========================================
// STATISTICS (must be before :id routes)
// ==========================================

/**
 * Get ticket statistics
 * GET /api/support/tickets/stats
 */
router.get(
  '/tickets/stats',
  requireAnyPermission([PERMISSIONS.SUPPORT_VIEW_ALL, PERMISSIONS.SUPPORT_MANAGE]),
  supportController.getStats
);

/**
 * Get open ticket count
 * GET /api/support/tickets/count
 */
router.get(
  '/tickets/count',
  requireAnyPermission([PERMISSIONS.SUPPORT_VIEW_OWN, PERMISSIONS.SUPPORT_VIEW_ALL]),
  supportController.getOpenCount
);

// ==========================================
// TICKETS
// ==========================================

/**
 * List tickets
 * GET /api/support/tickets
 */
router.get(
  '/tickets',
  requireAnyPermission([PERMISSIONS.SUPPORT_VIEW_OWN, PERMISSIONS.SUPPORT_VIEW_ALL]),
  supportController.listTickets
);

/**
 * Create ticket
 * POST /api/support/tickets
 */
router.post(
  '/tickets',
  requirePermission(PERMISSIONS.SUPPORT_CREATE),
  supportController.createTicket
);

/**
 * Get ticket by ID
 * GET /api/support/tickets/:id
 */
router.get(
  '/tickets/:id',
  requireAnyPermission([PERMISSIONS.SUPPORT_VIEW_OWN, PERMISSIONS.SUPPORT_VIEW_ALL]),
  supportController.getTicket
);

/**
 * Update ticket
 * PATCH /api/support/tickets/:id
 */
router.patch(
  '/tickets/:id',
  requirePermission(PERMISSIONS.SUPPORT_MANAGE),
  supportController.updateTicket
);

/**
 * Add response to ticket
 * POST /api/support/tickets/:id/respond
 */
router.post(
  '/tickets/:id/respond',
  requireAnyPermission([PERMISSIONS.SUPPORT_CREATE, PERMISSIONS.SUPPORT_RESPOND]),
  supportController.addResponse
);

/**
 * Close ticket
 * POST /api/support/tickets/:id/close
 */
router.post(
  '/tickets/:id/close',
  requireAnyPermission([PERMISSIONS.SUPPORT_CREATE, PERMISSIONS.SUPPORT_MANAGE]),
  supportController.closeTicket
);

/**
 * Reopen ticket
 * POST /api/support/tickets/:id/reopen
 */
router.post(
  '/tickets/:id/reopen',
  requireAnyPermission([PERMISSIONS.SUPPORT_CREATE, PERMISSIONS.SUPPORT_MANAGE]),
  supportController.reopenTicket
);

export default router;
