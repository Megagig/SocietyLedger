// ============================================
// BLOG & DOCUMENTATION SYSTEM - BLOG CONTROLLER
// ============================================

import { Request, Response } from 'express';
import { blogService } from './blog.service';
import {
  createPostSchema,
  updatePostSchema,
  searchPostsSchema,
  incrementViewSchema,
  createCategorySchema,
  updateCategorySchema,
  createTagSchema,
  updateTagSchema,
  createCommentSchema,
  updateCommentSchema,
  listCommentsSchema,
  getRelatedPostsSchema,
  listPostsQuerySchema,
  listCategoriesQuerySchema,
  listTagsQuerySchema,
} from './blog.validation';
import { prisma } from '../../lib/prisma';

// ============================================
// BLOG CONTROLLER
// ============================================

export const blogController = {
  // ==========================================
  // PUBLIC ENDPOINTS (No Auth Required)
  // ==========================================

  /**
   * List published posts
   * GET /api/blog/posts
   */
  async listPosts(req: Request, res: Response) {
    try {
      const validation = searchPostsSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const result = await blogService.listPosts({
        ...validation.data,
        status: 'PUBLISHED',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error listing blog posts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list posts',
        message: error.message,
      });
    }
  },

  /**
   * Get post by slug
   * GET /api/blog/posts/:slug
   */
  async getPostBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      const post = await blogService.getPostBySlug(slug, true);

      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found',
        });
      }

      res.json({
        success: true,
        data: post,
      });
    } catch (error: any) {
      console.error('Error getting blog post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get post',
        message: error.message,
      });
    }
  },

  /**
   * Get related posts
   * GET /api/blog/posts/:id/related
   */
  async getRelatedPosts(req: Request, res: Response) {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        });
      }

      const validation = getRelatedPostsSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const relatedPosts = await blogService.getRelatedPosts(
        postId,
        validation.data.limit
      );

      res.json({
        success: true,
        data: relatedPosts,
      });
    } catch (error: any) {
      console.error('Error getting related posts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get related posts',
        message: error.message,
      });
    }
  },

  /**
   * Increment post view count
   * POST /api/blog/posts/:id/view
   */
  async incrementView(req: Request, res: Response) {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        });
      }

      const validation = incrementViewSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      await blogService.incrementViewCount(validation.data);

      res.json({
        success: true,
        message: 'View count incremented',
      });
    } catch (error: any) {
      console.error('Error incrementing view count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to increment view count',
        message: error.message,
      });
    }
  },

  /**
   * List comments for a post
   * GET /api/blog/posts/:id/comments
   */
  async listComments(req: Request, res: Response) {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        });
      }

      const validation = listCommentsSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const comments = await blogService.listComments({
        postId,
        ...validation.data,
      });

      res.json({
        success: true,
        data: comments,
      });
    } catch (error: any) {
      console.error('Error listing comments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list comments',
        message: error.message,
      });
    }
  },

  /**
   * Create comment (public)
   * POST /api/blog/posts/:id/comments
   */
  async createComment(req: Request, res: Response) {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        });
      }

      const validation = createCommentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const authorId = req.user?.id;

      const comment = await blogService.createComment(
        {
          ...validation.data,
          postId,
        },
        authorId
      );

      res.status(201).json({
        success: true,
        data: comment,
        message: 'Comment submitted for moderation',
      });
    } catch (error: any) {
      console.error('Error creating comment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create comment',
        message: error.message,
      });
    }
  },

  /**
   * List categories
   * GET /api/blog/categories
   */
  async listCategories(req: Request, res: Response) {
    try {
      const validation = listCategoriesQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const categories = await blogService.listCategories(validation.data.limit);

      res.json({
        success: true,
        data: categories,
      });
    } catch (error: any) {
      console.error('Error listing categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list categories',
        message: error.message,
      });
    }
  },

  /**
   * List tags
   * GET /api/blog/tags
   */
  async listTags(req: Request, res: Response) {
    try {
      const validation = listTagsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const tags = await blogService.listTags(validation.data.limit);

      res.json({
        success: true,
        data: tags,
      });
    } catch (error: any) {
      console.error('Error listing tags:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list tags',
        message: error.message,
      });
    }
  },

  // ==========================================
  // ADMIN ENDPOINTS (Super Admin Only)
  // ==========================================

  /**
   * List all posts (including drafts)
   * GET /api/admin/blog/posts
   */
  async listAllPosts(req: Request, res: Response) {
    try {
      const validation = searchPostsSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const result = await blogService.listPosts(validation.data);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error listing all blog posts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list posts',
        message: error.message,
      });
    }
  },

  /**
   * Create post
   * POST /api/admin/blog/posts
   */
  async createPost(req: Request, res: Response) {
    try {
      const validation = createPostSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      const post = await blogService.createPost(validation.data, req.user.id);

      // Audit log
      await prisma.auditLog.create({
        data: {
          associationId: req.user.associationId || null,
          userId: req.user.id,
          action: 'blog_post_created',
          tableName: 'blog_posts',
          recordId: post.id,
          newValues: { title: post.title, status: post.status },
        },
      });

      res.status(201).json({
        success: true,
        data: post,
      });
    } catch (error: any) {
      console.error('Error creating blog post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create post',
        message: error.message,
      });
    }
  },

  /**
   * Get post by ID (admin)
   * GET /api/admin/blog/posts/:id
   */
  async getPostById(req: Request, res: Response) {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        });
      }

      const post = await blogService.getPostById(postId);

      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found',
        });
      }

      res.json({
        success: true,
        data: post,
      });
    } catch (error: any) {
      console.error('Error getting blog post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get post',
        message: error.message,
      });
    }
  },

  /**
   * Update post
   * PUT /api/admin/blog/posts/:id
   */
  async updatePost(req: Request, res: Response) {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        });
      }

      const validation = updatePostSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const post = await blogService.updatePost(postId, validation.data);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_post_updated',
            tableName: 'blog_posts',
            recordId: post.id,
            newValues: validation.data,
          },
        });
      }

      res.json({
        success: true,
        data: post,
      });
    } catch (error: any) {
      console.error('Error updating blog post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update post',
        message: error.message,
      });
    }
  },

  /**
   * Delete post
   * DELETE /api/admin/blog/posts/:id
   */
  async deletePost(req: Request, res: Response) {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid post ID',
        });
      }

      await blogService.deletePost(postId);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_post_deleted',
            tableName: 'blog_posts',
            recordId: postId,
          },
        });
      }

      res.json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting blog post:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete post',
        message: error.message,
      });
    }
  },

  /**
   * Create category
   * POST /api/admin/blog/categories
   */
  async createCategory(req: Request, res: Response) {
    try {
      const validation = createCategorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const category = await blogService.createCategory(validation.data);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_category_created',
            tableName: 'blog_categories',
            recordId: category.id,
            newValues: { name: category.name },
          },
        });
      }

      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error: any) {
      console.error('Error creating blog category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create category',
        message: error.message,
      });
    }
  },

  /**
   * Update category
   * PUT /api/admin/blog/categories/:id
   */
  async updateCategory(req: Request, res: Response) {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID',
        });
      }

      const validation = updateCategorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const category = await blogService.updateCategory(categoryId, validation.data);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_category_updated',
            tableName: 'blog_categories',
            recordId: category.id,
            newValues: validation.data,
          },
        });
      }

      res.json({
        success: true,
        data: category,
      });
    } catch (error: any) {
      console.error('Error updating blog category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update category',
        message: error.message,
      });
    }
  },

  /**
   * Delete category
   * DELETE /api/admin/blog/categories/:id
   */
  async deleteCategory(req: Request, res: Response) {
    try {
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid category ID',
        });
      }

      await blogService.deleteCategory(categoryId);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_category_deleted',
            tableName: 'blog_categories',
            recordId: categoryId,
          },
        });
      }

      res.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting blog category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete category',
        message: error.message,
      });
    }
  },

  /**
   * Create tag
   * POST /api/admin/blog/tags
   */
  async createTag(req: Request, res: Response) {
    try {
      const validation = createTagSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const tag = await blogService.createTag(validation.data);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_tag_created',
            tableName: 'blog_tags',
            recordId: tag.id,
            newValues: { name: tag.name },
          },
        });
      }

      res.status(201).json({
        success: true,
        data: tag,
      });
    } catch (error: any) {
      console.error('Error creating blog tag:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create tag',
        message: error.message,
      });
    }
  },

  /**
   * Update tag
   * PUT /api/admin/blog/tags/:id
   */
  async updateTag(req: Request, res: Response) {
    try {
      const tagId = parseInt(req.params.id);
      if (isNaN(tagId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tag ID',
        });
      }

      const validation = updateTagSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const tag = await blogService.updateTag(tagId, validation.data);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_tag_updated',
            tableName: 'blog_tags',
            recordId: tag.id,
            newValues: validation.data,
          },
        });
      }

      res.json({
        success: true,
        data: tag,
      });
    } catch (error: any) {
      console.error('Error updating blog tag:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update tag',
        message: error.message,
      });
    }
  },

  /**
   * Delete tag
   * DELETE /api/admin/blog/tags/:id
   */
  async deleteTag(req: Request, res: Response) {
    try {
      const tagId = parseInt(req.params.id);
      if (isNaN(tagId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tag ID',
        });
      }

      await blogService.deleteTag(tagId);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_tag_deleted',
            tableName: 'blog_tags',
            recordId: tagId,
          },
        });
      }

      res.json({
        success: true,
        message: 'Tag deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting blog tag:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete tag',
        message: error.message,
      });
    }
  },

  /**
   * Approve comment
   * PUT /api/admin/blog/comments/:id/approve
   */
  async approveComment(req: Request, res: Response) {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid comment ID',
        });
      }

      const comment = await blogService.approveComment(commentId);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_comment_approved',
            tableName: 'blog_comments',
            recordId: comment.id,
          },
        });
      }

      res.json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      console.error('Error approving comment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve comment',
        message: error.message,
      });
    }
  },

  /**
   * Delete comment
   * DELETE /api/admin/blog/comments/:id
   */
  async deleteComment(req: Request, res: Response) {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid comment ID',
        });
      }

      await blogService.deleteComment(commentId);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'blog_comment_deleted',
            tableName: 'blog_comments',
            recordId: commentId,
          },
        });
      }

      res.json({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete comment',
        message: error.message,
      });
    }
  },
};

export default blogController;
