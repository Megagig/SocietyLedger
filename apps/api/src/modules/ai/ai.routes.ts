// ============================================
// PHASE 17: AI INTEGRATION ROUTES
// Express route definitions for AI features
// ============================================

import { Router } from 'express';
import { aiController } from './ai.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { tenantMiddleware } from '../../middleware/tenant.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { requireModule, requireFeature } from '../../middleware/module-feature.middleware';

const router: Router = Router();

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Phase 19: Apply module check to all AI routes (Enterprise tier)
// In shadow mode, this logs but doesn't block; in enforce mode, it blocks access
router.use(requireModule('ai')); // G13: was 'ai_assistant', which never matched the seeded code 'ai' — always silently ungated

// ==========================================
// AI STATUS & CONFIGURATION
// ==========================================

/**
 * Check AI service status and rate limits
 * GET /api/ai/status
 * Requires: Any authenticated user
 */
router.get('/status', aiController.getStatus);

/**
 * Get rate limit status
 * GET /api/ai/rate-limit
 * Requires: Any authenticated user
 */
router.get('/rate-limit', aiController.getRateLimitStatus);

// ==========================================
// AI CREDITS: bought on top of the plan's daily allowance
// ==========================================

/** What is left, the price, and recent purchases */
router.get('/credits', requirePermission(PERMISSIONS.FINANCE_VIEW), aiController.getCredits);

/** Buying spends the association's money, so it needs the permission to approve payments or to manage billing */
router.post('/credits/purchase', requireAnyPermission([PERMISSIONS.FINANCE_APPROVE, PERMISSIONS.SETTINGS_BILLING]), aiController.purchaseCredits);
router.get('/credits/verify/:reference', requireAnyPermission([PERMISSIONS.FINANCE_APPROVE, PERMISSIONS.SETTINGS_BILLING]), aiController.verifyCredits);

/**
 * Get AI usage statistics
 * GET /api/ai/usage
 * Query params: startDate, endDate, groupBy
 * Requires: FINANCE_VIEW permission (admins/treasurers)
 */
router.get(
  '/usage',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  aiController.getUsageStats
);

// ==========================================
// AI FINANCIAL ASSISTANT
// ==========================================

/**
 * TASK-AI-004: Ask financial question
 * POST /api/ai/financial/ask
 * Body: { question: string, context?: { memberId?, categoryId?, dateRange? } }
 * Requires: FINANCE_VIEW permission
 */
router.post(
  '/financial/ask',
  requireFeature('ai.financial_assistant'),
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  aiController.askFinancialQuestion
);

// ==========================================
// AI SMART REMINDERS
// ==========================================

/**
 * TASK-AI-006: Get AI-powered reminder suggestions
 * GET /api/ai/reminders/suggestions
 * Query params: limit, minDaysOverdue, maxDaysOverdue
 * Requires: FINANCE_VIEW permission
 */
router.get(
  '/reminders/suggestions',
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  aiController.getReminderSuggestions
);

// ==========================================
// AI REPORT GENERATION
// ==========================================

/**
 * TASK-AI-005: Generate AI-powered report
 * POST /api/ai/reports/generate
 * Body: { reportType: string, period?: { startDate, endDate }, includeRecommendations?: boolean }
 * Requires: REPORT_VIEW permission
 */
router.post(
  '/reports/generate',
  requireFeature('ai.smart_reports'),
  requirePermission(PERMISSIONS.REPORT_VIEW),
  aiController.generateReport
);

// ==========================================
// NATURAL LANGUAGE QUERY
// ==========================================

/**
 * TASK-AI-007: Execute natural language query
 * POST /api/ai/query
 * Body: { query: string }
 * Requires: FINANCE_VIEW permission
 */
router.post(
  '/query',
  requireFeature('ai.financial_assistant'),
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  aiController.executeNaturalLanguageQuery
);

// ==========================================
// AI CHAT
// ==========================================

/**
 * Simple AI chat interface
 * POST /api/ai/chat
 * Body: { message: string, feature: 'financial' | 'document_qa' | 'general' }
 * Requires: FINANCE_VIEW permission for financial, MEMBER_VIEW for general
 */
router.post(
  '/chat',
  requireFeature('ai.financial_assistant'),
  requirePermission(PERMISSIONS.FINANCE_VIEW),
  aiController.chat
);

export default router;
