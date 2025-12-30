// ============================================
// PHASE 21: AI HELP CONTROLLER
// AI-powered help endpoints
// ============================================

import { Request, Response } from 'express';
import { aiHelpService } from './ai-help.service';
import { aiSupportService } from '../support/ai-support.service';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const suggestArticlesSchema = z.object({
  query: z.string().min(3).max(500),
  limit: z.number().int().min(1).max(10).optional(),
});

const answerQuestionSchema = z.object({
  question: z.string().min(5).max(1000),
});

const categorizeTicketSchema = z.object({
  description: z.string().min(10).max(5000),
});

const analyzeSentimentSchema = z.object({
  text: z.string().min(5).max(5000),
});

const suggestResponseSchema = z.object({
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  category: z.string(),
});

// ============================================
// AI HELP CONTROLLER
// ============================================

export const aiHelpController = {
  /**
   * Check AI availability
   * GET /api/help/ai/status
   */
  async getStatus(req: Request, res: Response) {
    try {
      const helpAvailable = aiHelpService.isAvailable();
      const supportAvailable = aiSupportService.isAvailable();

      res.json({
        success: true,
        data: {
          available: helpAvailable && supportAvailable,
          features: {
            articleSuggestions: helpAvailable,
            knowledgeBaseQA: helpAvailable,
            ticketCategorization: supportAvailable,
            sentimentAnalysis: supportAvailable,
            responseSuggestions: supportAvailable,
          },
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to check AI status',
        message: error.message,
      });
    }
  },

  /**
   * Get AI-suggested articles for a query
   * POST /api/help/ai/suggest-articles
   */
  async suggestArticles(req: Request, res: Response) {
    try {
      const validation = suggestArticlesSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const userRole = req.user?.role || 'member';

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!aiHelpService.isAvailable()) {
        return res.status(503).json({
          success: false,
          error: 'AI service unavailable',
          message: 'AI features are not configured. Please contact support.',
        });
      }

      const suggestions = await aiHelpService.suggestArticles(
        associationId,
        userId,
        validation.data.query,
        { userRole, limit: validation.data.limit }
      );

      res.json({
        success: true,
        data: {
          suggestions,
          query: validation.data.query,
        },
      });
    } catch (error: any) {
      console.error('Error suggesting articles:', error);
      
      // Handle rate limit errors gracefully
      if (error.message?.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many AI requests. Please try again later.',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to suggest articles',
        message: error.message,
      });
    }
  },

  /**
   * Answer question from knowledge base
   * POST /api/help/ai/answer
   */
  async answerQuestion(req: Request, res: Response) {
    try {
      const validation = answerQuestionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      const userRole = req.user?.role || 'member';

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!aiHelpService.isAvailable()) {
        return res.status(503).json({
          success: false,
          error: 'AI service unavailable',
          message: 'AI features are not configured. Please contact support.',
        });
      }

      const answer = await aiHelpService.answerFromKnowledgeBase(
        associationId,
        userId,
        validation.data.question,
        { userRole }
      );

      res.json({
        success: true,
        data: answer,
      });
    } catch (error: any) {
      console.error('Error answering question:', error);
      
      if (error.message?.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many AI requests. Please try again later.',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to answer question',
        message: error.message,
      });
    }
  },

  /**
   * Auto-categorize ticket description
   * POST /api/support/ai/categorize
   */
  async categorizeTicket(req: Request, res: Response) {
    try {
      const validation = categorizeTicketSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!aiSupportService.isAvailable()) {
        // Return fallback categorization
        const fallback = aiSupportService.fallbackCategorization(validation.data.description);
        return res.json({
          success: true,
          data: {
            ...fallback,
            aiAvailable: false,
          },
        });
      }

      const result = await aiSupportService.categorizeTicket(
        associationId,
        userId,
        validation.data.description
      );

      res.json({
        success: true,
        data: {
          ...result,
          aiAvailable: true,
        },
      });
    } catch (error: any) {
      console.error('Error categorizing ticket:', error);
      
      if (error.message?.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many AI requests. Please try again later.',
        });
      }

      // Return fallback on error
      const fallback = aiSupportService.fallbackCategorization(req.body.description || '');
      res.json({
        success: true,
        data: {
          ...fallback,
          aiAvailable: false,
        },
      });
    }
  },

  /**
   * Analyze sentiment of text
   * POST /api/support/ai/sentiment
   */
  async analyzeSentiment(req: Request, res: Response) {
    try {
      const validation = analyzeSentimentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!aiSupportService.isAvailable()) {
        const fallback = aiSupportService.fallbackSentiment(validation.data.text);
        return res.json({
          success: true,
          data: {
            ...fallback,
            aiAvailable: false,
          },
        });
      }

      const result = await aiSupportService.analyzeSentiment(
        associationId,
        userId,
        validation.data.text
      );

      res.json({
        success: true,
        data: {
          ...result,
          aiAvailable: true,
        },
      });
    } catch (error: any) {
      console.error('Error analyzing sentiment:', error);
      
      if (error.message?.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many AI requests. Please try again later.',
        });
      }

      const fallback = aiSupportService.fallbackSentiment(req.body.text || '');
      res.json({
        success: true,
        data: {
          ...fallback,
          aiAvailable: false,
        },
      });
    }
  },

  /**
   * Generate response suggestion for ticket
   * POST /api/support/ai/suggest-response
   */
  async suggestResponse(req: Request, res: Response) {
    try {
      const validation = suggestResponseSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const associationId = req.user?.associationId;
      const userId = req.user?.id;

      if (!associationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      if (!aiSupportService.isAvailable()) {
        return res.status(503).json({
          success: false,
          error: 'AI service unavailable',
          message: 'AI features are not configured. Please compose your response manually.',
        });
      }

      const result = await aiSupportService.generateResponseSuggestion(
        associationId,
        userId,
        validation.data
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error suggesting response:', error);
      
      if (error.message?.includes('rate limit')) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Too many AI requests. Please try again later.',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to generate suggestion',
        message: error.message,
      });
    }
  },
};

export default aiHelpController;
