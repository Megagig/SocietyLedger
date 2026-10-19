// ============================================
// DOCUMENTATION SYSTEM - ADMIN ROUTES
// Mounted at /api/admin/docs
// ============================================

import { Router, Request, Response } from 'express';
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
import prisma from '../../lib/prisma';

const router: Router = Router();

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

// Stats
router.get(
  '/stats',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    try {
      const [total, published, draft, viewSum, helpSum, unhelpSum] = await Promise.all([
        prisma.docPage.count(),
        prisma.docPage.count({ where: { status: 'PUBLISHED' } }),
        prisma.docPage.count({ where: { status: 'DRAFT' } }),
        prisma.docPage.aggregate({ _sum: { viewCount: true } }),
        prisma.docPage.aggregate({ _sum: { helpfulCount: true } }),
        prisma.docPage.aggregate({ _sum: { notHelpfulCount: true } }),
      ]);
      return res.json({
        success: true,
        data: {
          totalPages: total,
          publishedPages: published,
          draftPages: draft,
          totalViews: viewSum._sum.viewCount ?? 0,
          helpfulCount: helpSum._sum.helpfulCount ?? 0,
          unhelpfulCount: unhelpSum._sum.notHelpfulCount ?? 0,
        },
      });
    } catch (error) {
      console.error('doc stats error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// Feedback stats
router.get(
  '/feedback/stats',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    try {
      const [total, helpful, unhelpful] = await Promise.all([
        prisma.docFeedback.count(),
        prisma.docFeedback.count({ where: { isHelpful: true } }),
        prisma.docFeedback.count({ where: { isHelpful: false } }),
      ]);
      return res.json({
        success: true,
        data: {
          total,
          helpful,
          unhelpful,
          helpfulRate: total > 0 ? (helpful / total) * 100 : 0,
        },
      });
    } catch (error) {
      console.error('doc feedback stats error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

export default router;
