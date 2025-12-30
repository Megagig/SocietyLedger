// ============================================
// PHASE 21: HELP CONTROLLER
// Knowledge base articles and FAQs endpoints
// ============================================

import { Request, Response } from 'express';
import { helpService } from './help.service';
import { quickActionsService } from './quick-actions.service';
import {
  createArticleSchema,
  updateArticleSchema,
  searchArticlesSchema,
  createFAQSchema,
  updateFAQSchema,
  markHelpfulSchema,
  listFAQsQuerySchema,
} from './help.validation';
import { prisma } from '../../lib/prisma';

// ============================================
// HELP CONTROLLER
// ============================================

export const helpController = {
  // ==========================================
  // HELP CENTER
  // ==========================================

  /**
   * Get help center homepage data
   * GET /api/help
   */
  async getHelpCenter(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userRole = req.user?.role || 'member';
      const isSuper = req.user?.platformRole === 'SUPER_ADMIN';

      console.log('[Help] getHelpCenter called - associationId:', associationId, 'userRole:', userRole, 'isSuper:', isSuper);

      const data = await helpService.getHelpCenterData({
        associationId: associationId || undefined,
        userRole,
        isSuper,
      });

      console.log('[Help] Data fetched - articles:', data.featuredArticles.length, 'faqs:', data.topFAQs.length);

      // Add quick actions based on role
      data.quickActions = quickActionsService.getQuickActionsForRole(userRole);

      res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      console.error('Error getting help center:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load help center',
        message: error.message,
      });
    }
  },

  // ==========================================
  // ARTICLES
  // ==========================================

  /**
   * List articles
   * GET /api/help/articles
   */
  async listArticles(req: Request, res: Response) {
    try {
      const validation = searchArticlesSchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userRole = req.user?.role || 'member';
      const isSuper = req.user?.platformRole === 'SUPER_ADMIN';

      const result = await helpService.listArticles({
        ...validation.data,
        associationId: associationId || undefined,
        userRole,
        isSuper,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error listing articles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list articles',
        message: error.message,
      });
    }
  },

  /**
   * Search articles
   * GET /api/help/articles/search
   */
  async searchArticles(req: Request, res: Response) {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters',
        });
      }

      const associationId = req.user?.associationId;
      const userRole = req.user?.role || 'member';
      const isSuper = req.user?.platformRole === 'SUPER_ADMIN';
      const limit = parseInt(req.query.limit as string) || 10;

      const articles = await helpService.searchArticles(query, {
        associationId: associationId || undefined,
        userRole,
        limit,
        isSuper,
      });

      res.json({
        success: true,
        data: { articles, query },
      });
    } catch (error: any) {
      console.error('Error searching articles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search articles',
        message: error.message,
      });
    }
  },

  /**
   * Get article by slug
   * GET /api/help/articles/:slug
   */
  async getArticle(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const associationId = req.user?.associationId;
      const userRole = req.user?.role || 'member';
      const isSuper = req.user?.platformRole === 'SUPER_ADMIN';

      const article = await helpService.getArticleBySlug(slug, {
        associationId: associationId || undefined,
        userRole,
        incrementView: true,
        isSuper,
      });

      if (!article) {
        return res.status(404).json({
          success: false,
          error: 'Article not found',
        });
      }

      res.json({
        success: true,
        data: article,
      });
    } catch (error: any) {
      console.error('Error getting article:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get article',
        message: error.message,
      });
    }
  },

  /**
   * Mark article as helpful/not helpful
   * POST /api/help/articles/:id/helpful
   */
  async markArticleHelpful(req: Request, res: Response) {
    try {
      const articleId = parseInt(req.params.id);
      if (isNaN(articleId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid article ID',
        });
      }

      const validation = markHelpfulSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const result = await helpService.markArticleHelpful(
        articleId,
        validation.data.helpful
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error marking article helpful:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit feedback',
        message: error.message,
      });
    }
  },

  /**
   * Create article (admin only)
   * POST /api/help/articles
   */
  async createArticle(req: Request, res: Response) {
    try {
      const validation = createArticleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;

      const article = await helpService.createArticle(
        validation.data,
        associationId || undefined
      );

      // Audit log
      if (associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId,
            userId: req.user.id,
            action: 'help_article_created',
            tableName: 'help_articles',
            recordId: article.id,
            newValues: { title: article.title, category: article.category },
          },
        });
      }

      res.status(201).json({
        success: true,
        data: article,
      });
    } catch (error: any) {
      console.error('Error creating article:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create article',
        message: error.message,
      });
    }
  },

  /**
   * Update article (admin only)
   * PUT /api/help/articles/:id
   */
  async updateArticle(req: Request, res: Response) {
    try {
      const articleId = parseInt(req.params.id);
      if (isNaN(articleId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid article ID',
        });
      }

      const validation = updateArticleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const article = await helpService.updateArticle(articleId, validation.data);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'help_article_updated',
            tableName: 'help_articles',
            recordId: article.id,
            newValues: validation.data,
          },
        });
      }

      res.json({
        success: true,
        data: article,
      });
    } catch (error: any) {
      console.error('Error updating article:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update article',
        message: error.message,
      });
    }
  },

  /**
   * Delete article (admin only)
   * DELETE /api/help/articles/:id
   */
  async deleteArticle(req: Request, res: Response) {
    try {
      const articleId = parseInt(req.params.id);
      if (isNaN(articleId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid article ID',
        });
      }

      await helpService.deleteArticle(articleId);

      // Audit log
      if (req.user?.associationId && req.user?.id) {
        await prisma.auditLog.create({
          data: {
            associationId: req.user.associationId,
            userId: req.user.id,
            action: 'help_article_deleted',
            tableName: 'help_articles',
            recordId: articleId,
          },
        });
      }

      res.json({
        success: true,
        message: 'Article deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting article:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete article',
        message: error.message,
      });
    }
  },

  // ==========================================
  // FAQs
  // ==========================================

  /**
   * List FAQs
   * GET /api/help/faqs
   */
  async listFAQs(req: Request, res: Response) {
    try {
      const validation = listFAQsQuerySchema.safeParse(req.query);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userRole = req.user?.role || 'member';
      const isSuper = req.user?.platformRole === 'SUPER_ADMIN';

      const faqs = await helpService.listFAQs({
        associationId: associationId || undefined,
        userRole,
        category: validation.data.category,
        isSuper,
      });

      res.json({
        success: true,
        data: faqs,
      });
    } catch (error: any) {
      console.error('Error listing FAQs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list FAQs',
        message: error.message,
      });
    }
  },

  /**
   * Get FAQs grouped by category
   * GET /api/help/faqs/by-category
   */
  async getFAQsByCategory(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userRole = req.user?.role || 'member';
      const isSuper = req.user?.platformRole === 'SUPER_ADMIN';

      const grouped = await helpService.getFAQsByCategory({
        associationId: associationId || undefined,
        userRole,
        isSuper,
      });

      res.json({
        success: true,
        data: grouped,
      });
    } catch (error: any) {
      console.error('Error getting FAQs by category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get FAQs',
        message: error.message,
      });
    }
  },

  /**
   * Create FAQ (admin only)
   * POST /api/help/faqs
   */
  async createFAQ(req: Request, res: Response) {
    try {
      const validation = createFAQSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;

      const faq = await helpService.createFAQ(
        validation.data,
        associationId || undefined
      );

      res.status(201).json({
        success: true,
        data: faq,
      });
    } catch (error: any) {
      console.error('Error creating FAQ:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create FAQ',
        message: error.message,
      });
    }
  },

  /**
   * Update FAQ (admin only)
   * PUT /api/help/faqs/:id
   */
  async updateFAQ(req: Request, res: Response) {
    try {
      const faqId = parseInt(req.params.id);
      if (isNaN(faqId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid FAQ ID',
        });
      }

      const validation = updateFAQSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const faq = await helpService.updateFAQ(faqId, validation.data);

      res.json({
        success: true,
        data: faq,
      });
    } catch (error: any) {
      console.error('Error updating FAQ:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update FAQ',
        message: error.message,
      });
    }
  },

  /**
   * Delete FAQ (admin only)
   * DELETE /api/help/faqs/:id
   */
  async deleteFAQ(req: Request, res: Response) {
    try {
      const faqId = parseInt(req.params.id);
      if (isNaN(faqId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid FAQ ID',
        });
      }

      await helpService.deleteFAQ(faqId);

      res.json({
        success: true,
        message: 'FAQ deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting FAQ:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete FAQ',
        message: error.message,
      });
    }
  },

  // ==========================================
  // QUICK ACTIONS
  // ==========================================

  /**
   * Get quick actions for current user
   * GET /api/help/quick-actions
   */
  async getQuickActions(req: Request, res: Response) {
    try {
      const userRole = req.user?.role || 'member';
      const actions = quickActionsService.getQuickActionsForRole(userRole);

      res.json({
        success: true,
        data: actions,
      });
    } catch (error: any) {
      console.error('Error getting quick actions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get quick actions',
        message: error.message,
      });
    }
  },

  // ==========================================
  // CATEGORIES
  // ==========================================

  /**
   * Get article categories
   * GET /api/help/categories/articles
   */
  async getArticleCategories(req: Request, res: Response) {
    try {
      const categories = await helpService.getArticleCategories();
      res.json({
        success: true,
        data: categories,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to get categories',
      });
    }
  },

  /**
   * Get FAQ categories
   * GET /api/help/categories/faqs
   */
  async getFAQCategories(req: Request, res: Response) {
    try {
      const categories = await helpService.getFAQCategories();
      res.json({
        success: true,
        data: categories,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to get categories',
      });
    }
  },
};

export default helpController;
