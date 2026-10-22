// ============================================
// PHASE 21: SUPPORT ROUTES
// Ticket management endpoints
// ============================================

import { Router } from 'express';
import { supportController } from './support.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { attachFiles } from './support-upload';

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
  attachFiles,
  supportController.createTicket
);

/**
 * Get ticket by ID
 * GET /api/support/tickets/:id
 */
/**
 * Get a link to open one attachment
 * GET /api/support/attachments/:id
 */
/**
 * Contact SocietyLedger support (Tier 2) — an association admin's own ticket to the platform
 * POST /api/support/platform-tickets
 */
router.post(
  '/platform-tickets',
  requirePermission(PERMISSIONS.SUPPORT_ESCALATE),
  attachFiles,
  supportController.createPlatformTicket
);

router.get(
  '/attachments/:id',
  requireAnyPermission([PERMISSIONS.SUPPORT_VIEW_OWN, PERMISSIONS.SUPPORT_VIEW_ALL]),
  supportController.getAttachment
);

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
  attachFiles,
  supportController.addResponse
);

/**
 * Close ticket
 * POST /api/support/tickets/:id/close
 */
/**
 * Escalate a member's ticket to SocietyLedger support (opens a new Tier 2 ticket; shares nothing of the member's)
 * POST /api/support/tickets/:id/escalate
 */
router.post(
  '/tickets/:id/escalate',
  requirePermission(PERMISSIONS.SUPPORT_ESCALATE),
  attachFiles,
  supportController.escalateTicket
);

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
