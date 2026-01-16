// ============================================
// DOCUMENTATION SYSTEM - PUBLIC ROUTES
// Mounted at /api/docs
// ============================================

import { Router } from 'express';
import {
  listSections,
  getSectionBySlug,
  listPages,
  getPageBySlug,
  searchDocs,
  getRelatedPages,
  incrementViewCount,
  createFeedback,
} from './documentation.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

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
 * @access  Public (optional auth)
 */
router.post('/pages/:id/feedback', authMiddleware, createFeedback);

export default router;
