// ============================================
// PHASE 21: HELP ROUTES
// Knowledge base articles and FAQs
// ============================================

import { Router } from 'express';
import { helpController } from './help.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==========================================
// HELP CENTER
// ==========================================

/**
 * Get help center homepage data
 * GET /api/help
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.getHelpCenter
);

// ==========================================
// QUICK ACTIONS
// ==========================================

/**
 * Get quick actions for current user
 * GET /api/help/quick-actions
 */
router.get(
  '/quick-actions',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.getQuickActions
);

// ==========================================
// CATEGORIES
// ==========================================

/**
 * Get article categories
 * GET /api/help/categories/articles
 */
router.get(
  '/categories/articles',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.getArticleCategories
);

/**
 * Get FAQ categories
 * GET /api/help/categories/faqs
 */
router.get(
  '/categories/faqs',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.getFAQCategories
);

// ==========================================
// ARTICLES
// ==========================================

/**
 * List articles
 * GET /api/help/articles
 */
router.get(
  '/articles',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.listArticles
);

/**
 * Search articles
 * GET /api/help/articles/search
 */
router.get(
  '/articles/search',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.searchArticles
);

/**
 * Create article (admin only)
 * POST /api/help/articles
 */
router.post(
  '/articles',
  requirePermission(PERMISSIONS.HELP_MANAGE),
  helpController.createArticle
);

/**
 * Get article by slug
 * GET /api/help/articles/:slug
 */
router.get(
  '/articles/:slug',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.getArticle
);

/**
 * Update article (admin only)
 * PUT /api/help/articles/:id
 */
router.put(
  '/articles/:id',
  requirePermission(PERMISSIONS.HELP_MANAGE),
  helpController.updateArticle
);

/**
 * Delete article (admin only)
 * DELETE /api/help/articles/:id
 */
router.delete(
  '/articles/:id',
  requirePermission(PERMISSIONS.HELP_MANAGE),
  helpController.deleteArticle
);

/**
 * Mark article as helpful/not helpful
 * POST /api/help/articles/:id/helpful
 */
router.post(
  '/articles/:id/helpful',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.markArticleHelpful
);

// ==========================================
// FAQs
// ==========================================

/**
 * List FAQs
 * GET /api/help/faqs
 */
router.get(
  '/faqs',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.listFAQs
);

/**
 * Get FAQs grouped by category
 * GET /api/help/faqs/by-category
 */
router.get(
  '/faqs/by-category',
  requirePermission(PERMISSIONS.HELP_VIEW),
  helpController.getFAQsByCategory
);

/**
 * Create FAQ (admin only)
 * POST /api/help/faqs
 */
router.post(
  '/faqs',
  requirePermission(PERMISSIONS.HELP_MANAGE),
  helpController.createFAQ
);

/**
 * Update FAQ (admin only)
 * PUT /api/help/faqs/:id
 */
router.put(
  '/faqs/:id',
  requirePermission(PERMISSIONS.HELP_MANAGE),
  helpController.updateFAQ
);

/**
 * Delete FAQ (admin only)
 * DELETE /api/help/faqs/:id
 */
router.delete(
  '/faqs/:id',
  requirePermission(PERMISSIONS.HELP_MANAGE),
  helpController.deleteFAQ
);

export default router;
