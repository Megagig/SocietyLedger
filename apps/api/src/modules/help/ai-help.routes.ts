// ============================================
// PHASE 21: AI HELP ROUTES
// AI-powered help and support endpoints
// ============================================

import { Router } from 'express';
import { aiHelpController } from './ai-help.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==========================================
// AI STATUS
// ==========================================

/**
 * Check AI availability
 * GET /api/help/ai/status
 */
router.get(
  '/status',
  requirePermission(PERMISSIONS.HELP_VIEW),
  aiHelpController.getStatus
);

// ==========================================
// HELP AI ENDPOINTS
// ==========================================

/**
 * Get AI-suggested articles for a query
 * POST /api/help/ai/suggest-articles
 */
router.post(
  '/suggest-articles',
  requirePermission(PERMISSIONS.HELP_VIEW),
  aiHelpController.suggestArticles
);

/**
 * Answer question from knowledge base
 * POST /api/help/ai/answer
 */
router.post(
  '/answer',
  requirePermission(PERMISSIONS.HELP_VIEW),
  aiHelpController.answerQuestion
);

// ==========================================
// SUPPORT AI ENDPOINTS
// ==========================================

/**
 * Auto-categorize ticket description
 * POST /api/help/ai/categorize
 */
router.post(
  '/categorize',
  requireAnyPermission([PERMISSIONS.SUPPORT_CREATE, PERMISSIONS.SUPPORT_MANAGE]),
  aiHelpController.categorizeTicket
);

/**
 * Analyze sentiment of text
 * POST /api/help/ai/sentiment
 */
router.post(
  '/sentiment',
  requireAnyPermission([PERMISSIONS.SUPPORT_VIEW_ALL, PERMISSIONS.SUPPORT_MANAGE]),
  aiHelpController.analyzeSentiment
);

/**
 * Generate response suggestion for ticket
 * POST /api/help/ai/suggest-response
 */
router.post(
  '/suggest-response',
  requireAnyPermission([PERMISSIONS.SUPPORT_RESPOND, PERMISSIONS.SUPPORT_MANAGE]),
  aiHelpController.suggestResponse
);

export default router;
