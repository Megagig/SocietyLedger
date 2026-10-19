import { Router, Request, Response } from 'express';
import { BlogController } from './blog.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';
import prisma from '../../lib/prisma';

const router: Router = Router();
const ctrl = new BlogController();

// ============================================
// SUPER ADMIN ROUTES (Platform admin only)
// Mounted at /api/admin/blog
// ============================================

// Posts management
router.get(
  '/posts',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.getAllPosts(req, res)
);

router.post(
  '/posts',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.createPost(req, res)
);

router.get(
  '/posts/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.getPostById(req, res)
);

router.put(
  '/posts/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.updatePost(req, res)
);

router.delete(
  '/posts/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.deletePost(req, res)
);

// Categories management
router.get(
  '/categories',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.getCategories(req, res)
);

router.post(
  '/categories',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.createCategory(req, res)
);

router.put(
  '/categories/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.updateCategory(req, res)
);

router.delete(
  '/categories/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.deleteCategory(req, res)
);

// Tags management
router.get(
  '/tags',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.getTags(req, res)
);

router.post(
  '/tags',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.createTag(req, res)
);

router.put(
  '/tags/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.updateTag(req, res)
);

router.delete(
  '/tags/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.deleteTag(req, res)
);

// Blog stats
router.get(
  '/stats',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  async (req: Request, res: Response) => {
    try {
      const [total, published, draft, viewSum] = await Promise.all([
        prisma.blogPost.count(),
        prisma.blogPost.count({ where: { status: 'PUBLISHED' } }),
        prisma.blogPost.count({ where: { status: 'DRAFT' } }),
        prisma.blogPost.aggregate({ _sum: { viewCount: true } }),
      ]);
      return res.json({
        success: true,
        data: {
          totalPosts: total,
          publishedPosts: published,
          draftPosts: draft,
          totalViews: viewSum._sum.viewCount ?? 0,
        },
      });
    } catch (error) {
      console.error('blog stats error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
);

// Comments moderation
router.put(
  '/comments/:id/approve',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.approveComment(req, res)
);

router.delete(
  '/comments/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.deleteComment(req, res)
);

export default router;
