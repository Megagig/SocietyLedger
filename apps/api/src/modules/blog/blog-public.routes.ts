import { Router } from 'express';
import { BlogController } from './blog.controller';

const router = Router();
const ctrl = new BlogController();

// ============================================
// PUBLIC ROUTES (No authentication required)
// Mounted at /api/blog
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

export default router;
