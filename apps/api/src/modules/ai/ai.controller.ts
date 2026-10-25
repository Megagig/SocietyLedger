// ============================================
// PHASE 17: AI INTEGRATION CONTROLLER
// Express route handlers for AI features
// ============================================

import { Request, Response } from 'express';
import { aiService } from './ai.service';
import { assistantService } from './ai-assistant.service';
import { aiCredits } from './ai-credits.service';
import { AiCreditsError } from './ai-credits-rules';
import {
  financialQuerySchema,
  reminderSuggestionsSchema,
  aiReportSchema,
  nlQuerySchema,
  usageStatsQuerySchema,
  aiChatSchema,
} from './ai.validation';
import { validateUserInput } from './tools/safety-guards';
import { RateLimitError } from './tools/rate-limiter';
import { z } from 'zod';

// ============================================
// AI CONTROLLER
// ============================================

export const aiController = {
  /**
   * Check if AI is available
   * GET /api/ai/status
   */
  async getStatus(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const isAvailable = aiService.isAvailable();
      const rateLimitStatus = await aiService.getRateLimitStatus(associationId);

      return res.status(200).json({
        success: true,
        data: {
          available: isAvailable,
          rateLimit: rateLimitStatus,
        },
      });
    } catch (error) {
      console.error('Error checking AI status:', error);
      return res.status(500).json({ success: false, message: 'Failed to check AI status' });
    }
  },

  /**
   * TASK-AI-004: AI Financial Assistant
   * POST /api/ai/financial/ask
   */
  async askFinancialQuestion(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Validate request body
      const validatedData = financialQuerySchema.parse(req.body);

      // Validate user input for safety
      const inputCheck = validateUserInput(validatedData.question);
      if (!inputCheck.isValid) {
        return res.status(400).json({ 
          success: false, 
          message: inputCheck.reason || 'Invalid input' 
        });
      }

      // Check if AI is available
      if (!aiService.isAvailable()) {
        return res.status(503).json({ 
          success: false, 
          message: 'AI service is not configured. Please contact support.' 
        });
      }

      // Process the question
      const response = await assistantService.ask(associationId, userId, {
        question: validatedData.question,
        history: validatedData.history,
        period: validatedData.period,
      });

      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      return handleAIError(error, res);
    }
  },

  /**
   * TASK-AI-006: Smart Reminders
   * GET /api/ai/reminders/suggestions
   */
  async getReminderSuggestions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Validate query params
      const validatedData = reminderSuggestionsSchema.parse(req.query);

      // Check if AI is available
      if (!aiService.isAvailable()) {
        return res.status(503).json({ 
          success: false, 
          message: 'AI service is not configured' 
        });
      }

      const response = await assistantService.reminders(associationId, userId, {
        limit: validatedData.limit,
        minDaysOverdue: validatedData.minDaysOverdue,
        maxDaysOverdue: validatedData.maxDaysOverdue,
      });

      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      return handleAIError(error, res);
    }
  },

  /**
   * TASK-AI-005: Generate AI Report
   * POST /api/ai/reports/generate
   */
  async generateReport(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Validate request body
      const validatedData = aiReportSchema.parse(req.body);

      // Check if AI is available
      if (!aiService.isAvailable()) {
        return res.status(503).json({ 
          success: false, 
          message: 'AI service is not configured' 
        });
      }

      const response = await assistantService.report(
        associationId,
        userId,
        {
          reportType: validatedData.reportType,
          period: validatedData.period ? {
            startDate: new Date(validatedData.period.startDate),
            endDate: new Date(validatedData.period.endDate),
          } : undefined,
          includeRecommendations: validatedData.includeRecommendations,
        }
      );

      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      return handleAIError(error, res);
    }
  },

  /**
   * TASK-AI-007: Natural Language Query
   * POST /api/ai/query
   */
  async executeNaturalLanguageQuery(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Validate request body
      const validatedData = nlQuerySchema.parse(req.body);

      // Validate user input for safety
      const inputCheck = validateUserInput(validatedData.query);
      if (!inputCheck.isValid) {
        return res.status(400).json({ 
          success: false, 
          message: inputCheck.reason || 'Invalid input' 
        });
      }

      // Check if AI is available
      if (!aiService.isAvailable()) {
        return res.status(503).json({ 
          success: false, 
          message: 'AI service is not configured' 
        });
      }

      const response = await aiService.executeNaturalLanguageQuery(
        associationId,
        userId,
        { query: validatedData.query }
      );

      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      return handleAIError(error, res);
    }
  },

  /**
   * TASK-AI-012: Get AI Usage Statistics
   * GET /api/ai/usage
   */
  async getUsageStats(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      // Validate query params
      const validatedData = usageStatsQuerySchema.parse(req.query);

      const stats = await aiService.getUsageStats(associationId, {
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        groupBy: validatedData.groupBy,
      });

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error getting AI usage stats:', error);
      return res.status(500).json({ success: false, message: 'Failed to get AI usage statistics' });
    }
  },

  /**
   * Get Rate Limit Status
   * GET /api/ai/rate-limit
   */
  async getRateLimitStatus(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const status = await aiService.getRateLimitStatus(associationId);

      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return res.status(500).json({ success: false, message: 'Failed to get rate limit status' });
    }
  },

  /**
   * What a purchase of credits costs, what is left, and what has been bought
   * GET /api/ai/credits
   */
  async getCredits(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const [status, purchases] = await Promise.all([aiCredits.getStatus(associationId), aiCredits.purchases(associationId, 10)]);
      return res.status(200).json({ success: true, data: { status, purchases } });
    } catch (error) {
      return handleAIError(error, res);
    }
  },

  /**
   * Start buying credits (opens Paystack)
   * POST /api/ai/credits/purchase  { credits, platform? }
   */
  async purchaseCredits(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      if (!associationId || !userId) return res.status(400).json({ success: false, message: 'Authentication required' });
      const platform = req.body?.platform === 'mobile' ? 'mobile' : 'web';
      const data = await aiCredits.startPurchase(associationId, userId, req.body?.credits, platform);
      return res.status(200).json({ success: true, message: 'Payment initialized successfully', data });
    } catch (error) {
      return handleAIError(error, res);
    }
  },

  /**
   * Ask whether a payment has gone through; credits it if it has (a webhook may already have)
   * GET /api/ai/credits/verify/:reference
   */
  async verifyCredits(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) return res.status(400).json({ success: false, message: 'Association ID is required' });
      const data = await aiCredits.verifyPurchase(associationId, req.params.reference);
      return res.status(200).json({ success: true, data: { ...data, usage: await aiCredits.getStatus(associationId) } });
    } catch (error) {
      return handleAIError(error, res);
    }
  },

  /**
   * Simple AI Chat
   * POST /api/ai/chat
   */
  async chat(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const userId = req.user?.id;
      
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Validate request body
      const validatedData = aiChatSchema.parse(req.body);

      // Validate user input for safety
      const inputCheck = validateUserInput(validatedData.message);
      if (!inputCheck.isValid) {
        return res.status(400).json({ 
          success: false, 
          message: inputCheck.reason || 'Invalid input' 
        });
      }

      // Check if AI is available
      if (!aiService.isAvailable()) {
        return res.status(503).json({ 
          success: false, 
          message: 'AI service is not configured' 
        });
      }

      const response = await aiService.chat(
        associationId,
        userId,
        validatedData.message,
        validatedData.feature
      );

      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      return handleAIError(error, res);
    }
  },
};

// ============================================
// ERROR HANDLER
// ============================================

function handleAIError(error: unknown, res: Response) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation error', 
      errors: error.errors 
    });
  }
  
  if (error instanceof RateLimitError) {
    return res.status(429).json({ 
      success: false, 
      code: 'AI_ALLOWANCE_EXHAUSTED',
      message: error.message,
      rateLimit: error.status,
    });
  }

  // A rule the request broke (assistant switched off, a purchase below the minimum) answers with its own status and plain words
  if (error instanceof AiCreditsError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  
  if (error instanceof Error) {
    // Check for specific error types
    if (error.name === 'AISecurityError') {
      return res.status(400).json({ 
        success: false, 
        message: 'AI response failed safety validation' 
      });
    }
    
    if (error.message.includes('OpenRouter')) {
      return res.status(503).json({ 
        success: false, 
        message: 'AI service temporarily unavailable. Please try again later.' 
      });
    }
  }
  
  console.error('AI Controller Error:', error);
  return res.status(500).json({ 
    success: false, 
    message: 'An error occurred while processing your AI request' 
  });
}

export default aiController;
