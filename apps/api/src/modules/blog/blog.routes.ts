// ============================================
// BLOG & DOCUMENTATION SYSTEM - BLOG ROUTES
// ============================================

import { Router } from 'express';
import { blogController } from './blog.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';

const router = Router();

// ==========================================
// PUBLIC ENDPOINTS (No Auth Required)
// ==========================================

/**
 * @route   GET /api/blog/posts
 * @desc    List published blog posts
 * @access  Public
 */
router.get('/posts', blogController.listPosts);

/**
 * @route   GET /api/blog/posts/:slug
 * @desc    Get a single blog post by slug
 * @access  Public
 */
router.get('/posts/:slug', blogController.getPostBySlug);

/**
 * @route   GET /api/blog/posts/:id/related
 * @desc    Get related posts
 * @access  Public
 */
router.get('/posts/:id/related', blogController.getRelatedPosts);

/**
 * @route   POST /api/blog/posts/:id/view
 * @desc    Increment post view count
 * @access  Public
 */
router.post('/posts/:id/view', blogController.incrementView);

/**
 * @route   GET /api/blog/posts/:id/comments
 * @desc    List comments for a post
 * @access  Public
 */
router.get('/posts/:id/comments', blogController.listComments);

/**
 * @route   POST /api/blog/posts/:id/comments
 * @desc    Create a comment on a post
 * @access  Public (or authenticated users)
 */
router.post('/posts/:id/comments', authMiddleware, blogController.createComment);

/**
 * @route   GET /api/blog/categories
 * @desc    List all blog categories
 * @access  Public
 */
router.get('/categories', blogController.listCategories);

/**
 * @route   GET /api/blog/tags
 * @desc    List all blog tags
 * @access  Public
 */
router.get('/tags', blogController.listTags);

// ==========================================
// ADMIN ENDPOINTS (Super Admin Only)
// ==========================================

/**
 * @route   GET /api/admin/blog/posts
 * @desc    List all blog posts (including drafts)
 * @access  Super Admin
 */
router.get('/admin/blog/posts', authMiddleware, requirePermission(PERMISSIONS.BLOG_MANAGE), blogController.listAllPosts);

/**
 * @route   POST /api/admin/blog/posts
 * @desc    Create a new blog post
 * @access  Super Admin
 */
router.post('/admin/blog/posts', authMiddleware, requirePermission(PERMISSIONS.BLOG_POST_CREATE), blogController.createPost);

/**
 * @route   GET /api/admin/blog/posts/:id
 * @desc    Get a blog post by ID
 * @access  Super Admin
 */
router.get('/admin/blog/posts/:id', authMiddleware, requirePermission(PERMISSIONS.BLOG_MANAGE), blogController.getPostById);

/**
 * @route   PUT /api/admin/blog/posts/:id
 * @desc    Update a blog post
 * @access  Super Admin
 */
router.put('/admin/blog/posts/:id', authMiddleware, requirePermission(PERMISSIONS.BLOG_POST_EDIT), blogController.updatePost);

/**
 * @route   DELETE /api/admin/blog/posts/:id
 * @desc    Delete a blog post
 * @access  Super Admin
 */
router.delete('/admin/blog/posts/:id', authMiddleware, requirePermission(PERMISSIONS.BLOG_POST_DELETE), blogController.deletePost);

/**
 * @route   POST /api/admin/blog/categories
 * @desc    Create a new blog category
 * @access  Super Admin
 */
router.post('/admin/blog/categories', authMiddleware, requirePermission(PERMISSIONS.BLOG_MANAGE), blogController.createCategory);

/**
 * @route   PUT /api/admin/blog/categories/:id
 * @desc    Update a blog category
 * @access  Super Admin
 */
router.put('/admin/blog/categories/:id', authMiddleware, requirePermission(PERMISSIONS.BLOG_MANAGE), blogController.updateCategory);

/**
 * @route   DELETE /api/admin/blog/categories/:id
 * @desc    Delete a blog category
 * @access  Super Admin
 */
router.delete('/admin/blog/categories/:id', authMiddleware, requirePermission(PERMISSIONS.BLOG_MANAGE), blogController.deleteCategory);

/**
 * @route   POST /api/admin/blog/tags
 * @desc    Create a new blog tag
 * @access  Super Admin
 */
router.post('/admin/blog/tags', authMiddleware, requirePermission(PERMISSIONS.BLOG_MANAGE), blogController.createTag);

/**
 * @route   PUT /api/admin/blog/tags/:id
 * @desc    Update a blog tag
 * @access  Super Admin
 */
router.put('/admin/blog/tags/:id', authMiddleware, requirePermission(PERMISSIONS.BLOG_MANAGE), blogController.updateTag);

/**
 * @route   DELETE /api/admin/blog/tags/:id
 * @desc    Delete a blog tag
 * @access  Super Admin
 */
router.delete('/admin/blog/tags/:id', authMiddleware, requirePermission(PERMISSIONS.BLOG_MANAGE), blogController.deleteTag);

/**
 * @route   PUT /api/admin/blog/comments/:id/approve
 * @desc    Approve a comment
 * @access  Super Admin
 */
router.put('/admin/blog/comments/:id/approve', authMiddleware, requirePermission(PERMISSIONS.BLOG_COMMENT_MODERATE), blogController.approveComment);

/**
 * @route   DELETE /api/admin/blog/comments/:id
 * @desc    Delete a comment
 * @access  Super Admin
 */
router.delete('/admin/blog/comments/:id', authMiddleware, requirePermission(PERMISSIONS.BLOG_COMMENT_MODERATE), blogController.deleteComment);

export default router;
