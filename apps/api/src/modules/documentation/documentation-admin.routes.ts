// ============================================
// DOCUMENTATION SYSTEM - ADMIN ROUTES
// Mounted at /api/admin/docs
// ============================================

import { Router } from 'express';
import {
  listSections,
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
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';

const router = Router();

// ============================================
// SUPER ADMIN ENDPOINTS
// All routes require SUPER_ADMIN platform role
// ============================================

// Pages management
router.get(
  '/pages',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  listAllPages
);

router.get(
  '/pages/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  getPageById
);

router.post(
  '/pages',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  createPage
);

router.put(
  '/pages/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  updatePage
);

router.delete(
  '/pages/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  deletePage
);

// Sections management
router.get(
  '/sections',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  listSections
);

router.post(
  '/sections',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  createSection
);

router.put(
  '/sections/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  updateSection
);

router.delete(
  '/sections/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  deleteSection
);

// Feedback management
router.get(
  '/feedback',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  listAllFeedback
);

router.get(
  '/feedback/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  getFeedbackById
);

router.delete(
  '/feedback/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  deleteFeedback
);

export default router;
