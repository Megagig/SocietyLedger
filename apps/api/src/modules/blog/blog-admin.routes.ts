import { Router } from 'express';
import { BlogController } from './blog.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';

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
