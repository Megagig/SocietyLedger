import { Router } from 'express';
import { BlogController } from './blog.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePlatformRole } from '../../middleware/rbac';
import { PlatformRole } from '@prisma/client';

const router: Router = Router();
const ctrl = new BlogController();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Blog posts
router.get('/posts', (req, res) => ctrl.getPublishedPosts(req, res));
router.get('/posts/:slug', (req, res) => ctrl.getPostBySlug(req, res));
router.post('/posts/:id/view', (req, res) => ctrl.incrementView(req, res));

// Categories & Tags
router.get('/categories', (req, res) => ctrl.getCategories(req, res));
router.get('/tags', (req, res) => ctrl.getTags(req, res));

// Comments
router.get('/posts/:id/comments', (req, res) => ctrl.getComments(req, res));
router.post('/posts/:id/comments', (req, res) => ctrl.createComment(req, res));

// Related posts
router.get('/posts/:id/related', (req, res) => ctrl.getRelatedPosts(req, res));

// ============================================
// SUPER ADMIN ROUTES (Platform admin only)
// ============================================

// Posts management
router.get(
  '/admin/posts',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.getAllPosts(req, res)
);

router.post(
  '/admin/posts',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.createPost(req, res)
);

router.get(
  '/admin/posts/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.getPostById(req, res)
);

router.put(
  '/admin/posts/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.updatePost(req, res)
);

router.delete(
  '/admin/posts/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.deletePost(req, res)
);

// Categories management
router.post(
  '/admin/categories',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.createCategory(req, res)
);

router.put(
  '/admin/categories/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.updateCategory(req, res)
);

router.delete(
  '/admin/categories/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.deleteCategory(req, res)
);

// Tags management
router.post(
  '/admin/tags',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.createTag(req, res)
);

router.put(
  '/admin/tags/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.updateTag(req, res)
);

router.delete(
  '/admin/tags/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.deleteTag(req, res)
);

// Comments moderation
router.put(
  '/admin/comments/:id/approve',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.approveComment(req, res)
);

router.delete(
  '/admin/comments/:id',
  authMiddleware,
  requirePlatformRole([PlatformRole.SUPER_ADMIN]),
  (req, res) => ctrl.deleteComment(req, res)
);

export default router;
