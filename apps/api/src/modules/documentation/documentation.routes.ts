// ============================================
// BLOG & DOCUMENTATION SYSTEM - DOCUMENTATION ROUTES
// ============================================

import { Router } from 'express';
import {
  // Public endpoints
  listSections,
  getSectionBySlug,
  listPages,
  getPageBySlug,
  searchDocs,
  getRelatedPages,
  incrementViewCount,
  createFeedback,
  // Super Admin endpoints
  listAllPages,
  getPageById,
  createPage,
  updatePage,
  deletePage,
  createSection,
  updateSection,
  deleteSection,
  listAllFeedback,
  getFeedbackById,
  deleteFeedback,
} from './documentation.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// ============================================
// PUBLIC ENDPOINTS (No Auth Required)
// ============================================

/**
 * @route   GET /api/docs/sections
 * @desc    List all documentation sections
 * @access  Public
 */
router.get('/sections', listSections);

/**
 * @route   GET /api/docs/sections/:slug
 * @desc    Get section by slug
 * @access  Public
 */
router.get('/sections/:slug', getSectionBySlug);

/**
 * @route   GET /api/docs/pages
 * @desc    List published documentation pages
 * @access  Public
 * @query   q - Search query (optional)
 * @query   sectionId - Filter by section (optional)
 * @query   status - Filter by status (optional, default: PUBLISHED)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get('/pages', listPages);

/**
 * @route   GET /api/docs/pages/:slug
 * @desc    Get documentation page by slug
 * @access  Public
 */
router.get('/pages/:slug', getPageBySlug);

/**
 * @route   GET /api/docs/search
 * @desc    Search documentation
 * @access  Public
 * @query   q - Search query (required)
 * @query   sectionId - Filter by section (optional)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get('/search', searchDocs);

/**
 * @route   GET /api/docs/pages/:id/related
 * @desc    Get related documentation pages
 * @access  Public
 */
router.get('/pages/:id/related', getRelatedPages);

/**
 * @route   POST /api/docs/pages/:id/view
 * @desc    Increment page view count
 * @access  Public
 */
router.post('/pages/:id/view', incrementViewCount);

/**
 * @route   POST /api/docs/pages/:id/feedback
 * @desc    Submit feedback for a documentation page
 * @access  Public
 * @body    isHelpful - boolean (required)
 * @body    comment - string (optional)
 * @body    email - string (optional)
 */
router.post('/pages/:id/feedback', authMiddleware, createFeedback);

// ============================================
// SUPER ADMIN ENDPOINTS
// ============================================

/**
 * @route   GET /api/admin/docs/pages
 * @desc    List all documentation pages (including drafts)
 * @access  Super Admin
 */
router.get('/admin/docs/pages', authMiddleware, requirePermission(PERMISSIONS.DOCS_MANAGE), listAllPages);

/**
 * @route   GET /api/admin/docs/pages/:id
 * @desc    Get documentation page by ID
 * @access  Super Admin
 */
router.get('/admin/docs/pages/:id', authMiddleware, requirePermission(PERMISSIONS.DOCS_MANAGE), getPageById);

/**
 * @route   POST /api/admin/docs/pages
 * @desc    Create a new documentation page
 * @access  Super Admin
 * @body    title - string (required)
 * @body    slug - string (required)
 * @body    content - string (required)
 * @body    excerpt - string (optional)
 * @body    order - number (optional)
 * @body    scope - string (optional, default: PLATFORM)
 * @body    parentId - number (optional)
 * @body    sectionId - number (optional)
 * @body    metaTitle - string (optional)
 * @body    metaDescription - string (optional)
 * @body    version - string (optional)
 */
router.post('/admin/docs/pages', authMiddleware, requirePermission(PERMISSIONS.DOCS_PAGE_CREATE), createPage);

/**
 * @route   PUT /api/admin/docs/pages/:id
 * @desc    Update a documentation page
 * @access  Super Admin
 * @body    title - string (optional)
 * @body    slug - string (optional)
 * @body    content - string (optional)
 * @body    excerpt - string (optional)
 * @body    order - number (optional)
 * @body    parentId - number (optional)
 * @body    sectionId - number (optional)
 * @body    metaTitle - string (optional)
 * @body    metaDescription - string (optional)
 * @body    version - string (optional)
 * @body    status - string (optional)
 * @body    publishedAt - date (optional)
 */
router.put('/admin/docs/pages/:id', authMiddleware, requirePermission(PERMISSIONS.DOCS_PAGE_EDIT), updatePage);

/**
 * @route   DELETE /api/admin/docs/pages/:id
 * @desc    Delete a documentation page
 * @access  Super Admin
 */
router.delete('/admin/docs/pages/:id', authMiddleware, requirePermission(PERMISSIONS.DOCS_PAGE_DELETE), deletePage);

/**
 * @route   POST /api/admin/docs/sections
 * @desc    Create a new documentation section
 * @access  Super Admin
 * @body    name - string (required)
 * @body    slug - string (required)
 * @body    description - string (optional)
 * @body    icon - string (optional)
 * @body    order - number (optional)
 */
router.post('/admin/docs/sections', authMiddleware, requirePermission(PERMISSIONS.DOCS_MANAGE), createSection);

/**
 * @route   PUT /api/admin/docs/sections/:id
 * @desc    Update a documentation section
 * @access  Super Admin
 * @body    name - string (optional)
 * @body    slug - string (optional)
 * @body    description - string (optional)
 * @body    icon - string (optional)
 * @body    order - number (optional)
 */
router.put('/admin/docs/sections/:id', authMiddleware, requirePermission(PERMISSIONS.DOCS_MANAGE), updateSection);

/**
 * @route   DELETE /api/admin/docs/sections/:id
 * @desc    Delete a documentation section
 * @access  Super Admin
 */
router.delete('/admin/docs/sections/:id', authMiddleware, requirePermission(PERMISSIONS.DOCS_MANAGE), deleteSection);

/**
 * @route   GET /api/admin/docs/feedback
 * @desc    List all feedback
 * @access  Super Admin
 * @query   pageId - Filter by page (optional)
 * @query   limit - Items per page (default: 50)
 * @query   offset - Offset (default: 0)
 */
router.get('/admin/docs/feedback', authMiddleware, requirePermission(PERMISSIONS.DOCS_MANAGE), listAllFeedback);

/**
 * @route   GET /api/admin/docs/feedback/:id
 * @desc    Get feedback by ID
 * @access  Super Admin
 */
router.get('/admin/docs/feedback/:id', authMiddleware, requirePermission(PERMISSIONS.DOCS_MANAGE), getFeedbackById);

/**
 * @route   DELETE /api/admin/docs/feedback/:id
 * @desc    Delete feedback
 * @access  Super Admin
 */
router.delete('/admin/docs/feedback/:id', authMiddleware, requirePermission(PERMISSIONS.DOCS_MANAGE), deleteFeedback);

export default router;
