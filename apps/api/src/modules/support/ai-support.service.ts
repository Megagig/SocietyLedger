// ============================================
// PHASE 21: AI SUPPORT SERVICE
// AI-powered ticket categorization and sentiment analysis
// ============================================

import { prisma } from '../../lib/prisma';
import openRouterClient from '../../lib/openrouter';
import { aiRateLimiter } from '../ai/tools/rate-limiter';
import { validateAIOutput } from '../ai/tools/safety-guards';
import { TicketCategory, TicketPriority } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface CategorizationResult {
  category: TicketCategory;
  confidence: number;
  suggestedPriority: TicketPriority;
  reasoning: string;
}

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent';
  score: number; // -1 to 1
  escalationRecommended: boolean;
  reasoning: string;
}

export interface ResponseSuggestion {
  suggestion: string;
  confidence: number;
  tone: 'friendly' | 'professional' | 'apologetic';
  sources: string[];
}

// ============================================
// AI SUPPORT SERVICE
// ============================================

export const aiSupportService = {
  /**
   * Check if AI is available
   */
  isAvailable(): boolean {
    return openRouterClient.isConfigured();
  },

  /**
   * Auto-categorize ticket based on description
   */
  async categorizeTicket(
    associationId: number,
    userId: number,
    description: string
  ): Promise<CategorizationResult> {
    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

    const categories = Object.values(TicketCategory);
    const categoryDescriptions = {
      ACCESS: 'Login issues, permission problems, account access',
      PAYMENTS: 'Payment processing, reconciliation, transaction issues',
      REPORTS: 'Report generation, exports, data display issues',
      MEMBERS: 'Member management, profiles, membership issues',
      TECHNICAL: 'Technical issues, system errors, performance problems',
      BUG: 'Software bugs, unexpected behavior, crashes',
      FEATURE_REQUEST: 'New feature requests, enhancement suggestions',
      OTHER: 'General inquiries that don\'t fit other categories',
    };

    const prompt = `
You are a support ticket categorization system for SocietyLedger, a platform for managing association finances.

Analyze the following support ticket description and categorize it.

TICKET DESCRIPTION:
"${description}"

AVAILABLE CATEGORIES:
${Object.entries(categoryDescriptions).map(([cat, desc]) => `- ${cat}: ${desc}`).join('\n')}

Determine:
1. The most appropriate category
2. Your confidence level (0.0-1.0)
3. Suggested priority (LOW, MEDIUM, HIGH, URGENT) based on urgency indicators
4. Brief reasoning for your choice

Respond in JSON format:
{
  "category": "CATEGORY_NAME",
  "confidence": 0.85,
  "suggestedPriority": "MEDIUM",
  "reasoning": "Brief explanation..."
}
`;

    try {
      const response = await openRouterClient.chat(
        [
          { role: 'system', content: 'You are a support ticket categorization assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.2, maxTokens: 300 }
      );

      const safeContent = validateAIOutput(response.content, {
        type: 'ticket_categorization',
        associationId,
      });

      const jsonMatch = safeContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate category
      const category = categories.includes(parsed.category) 
        ? parsed.category as TicketCategory 
        : TicketCategory.OTHER;

      // Validate priority
      const priorities = Object.values(TicketPriority);
      const priority = priorities.includes(parsed.suggestedPriority)
        ? parsed.suggestedPriority as TicketPriority
        : TicketPriority.MEDIUM;

      // Log AI usage
      await this.logAIUsage(associationId, userId, 'ticket_categorization', response.tokensUsed.total, response.costUsd);

      return {
        category,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        suggestedPriority: priority,
        reasoning: parsed.reasoning || 'Categorized based on content analysis',
      };
    } catch (error) {
      console.error('Error in AI categorization:', error);
      // Fallback to keyword-based categorization
      return this.fallbackCategorization(description);
    }
  },

  /**
   * Analyze sentiment of ticket/message
   */
  async analyzeSentiment(
    associationId: number,
    userId: number,
    text: string
  ): Promise<SentimentResult> {
    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

    const prompt = `
Analyze the sentiment of the following support ticket message. Consider:
- Emotional tone (frustrated, angry, confused, satisfied, neutral)
- Urgency indicators (words like "urgent", "immediately", "critical", "broken")
- Politeness level
- Whether escalation to a human agent is recommended

MESSAGE:
"${text}"

Respond in JSON format:
{
  "sentiment": "positive|neutral|negative|urgent",
  "score": 0.5,
  "escalationRecommended": false,
  "reasoning": "Brief explanation..."
}

Score ranges:
- -1.0 to -0.5: Very negative/frustrated
- -0.5 to 0: Slightly negative
- 0 to 0.5: Neutral to slightly positive
- 0.5 to 1.0: Positive/satisfied

Use "urgent" sentiment for messages that indicate critical issues or extreme frustration.
`;

    try {
      const response = await openRouterClient.chat(
        [
          { role: 'system', content: 'You are a sentiment analysis assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.2, maxTokens: 200 }
      );

      const safeContent = validateAIOutput(response.content, {
        type: 'sentiment_analysis',
        associationId,
      });

      const jsonMatch = safeContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate sentiment
      const validSentiments = ['positive', 'neutral', 'negative', 'urgent'];
      const sentiment = validSentiments.includes(parsed.sentiment) 
        ? parsed.sentiment as SentimentResult['sentiment']
        : 'neutral';

      // Log AI usage
      await this.logAIUsage(associationId, userId, 'sentiment_analysis', response.tokensUsed.total, response.costUsd);

      return {
        sentiment,
        score: Math.min(1, Math.max(-1, parsed.score || 0)),
        escalationRecommended: parsed.escalationRecommended || sentiment === 'urgent' || parsed.score < -0.7,
        reasoning: parsed.reasoning || 'Sentiment analyzed based on content',
      };
    } catch (error) {
      console.error('Error in AI sentiment analysis:', error);
      // Fallback to keyword-based sentiment
      return this.fallbackSentiment(text);
    }
  },

  /**
   * Generate response suggestion for staff
   */
  async generateResponseSuggestion(
    associationId: number,
    userId: number,
    ticket: { subject: string; description: string; category: string },
    pastResponses?: string[]
  ): Promise<ResponseSuggestion> {
    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

    const contextFromPast = pastResponses?.length 
      ? `\nPREVIOUS SIMILAR RESPONSES:\n${pastResponses.slice(0, 3).join('\n---\n')}`
      : '';

    const prompt = `
You are a support agent for SocietyLedger, a platform for managing association finances in Africa.

Generate a helpful response suggestion for the following support ticket:

SUBJECT: ${ticket.subject}
CATEGORY: ${ticket.category}
DESCRIPTION: ${ticket.description}
${contextFromPast}

Write a professional, helpful response that:
1. Acknowledges the user's issue
2. Provides clear guidance or next steps
3. Is culturally appropriate for African associations
4. Uses Nigerian Naira (₦) if discussing money
5. Is concise but thorough

Respond in JSON format:
{
  "suggestion": "Your suggested response here...",
  "confidence": 0.8,
  "tone": "friendly|professional|apologetic",
  "sources": ["Any relevant help article topics referenced"]
}

Choose tone based on the issue:
- "friendly" for general questions
- "professional" for technical/financial issues
- "apologetic" for bugs or service issues
`;

    try {
      const response = await openRouterClient.chat(
        [
          { role: 'system', content: 'You are a helpful support agent assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.5, maxTokens: 800 }
      );

      const safeContent = validateAIOutput(response.content, {
        type: 'response_suggestion',
        associationId,
      });

      const jsonMatch = safeContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Log AI usage
      await this.logAIUsage(associationId, userId, 'response_suggestion', response.tokensUsed.total, response.costUsd);

      return {
        suggestion: parsed.suggestion || 'Unable to generate suggestion',
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        tone: ['friendly', 'professional', 'apologetic'].includes(parsed.tone) ? parsed.tone : 'professional',
        sources: parsed.sources || [],
      };
    } catch (error) {
      console.error('Error generating response suggestion:', error);
      return {
        suggestion: 'Unable to generate AI suggestion at this time. Please compose your response manually.',
        confidence: 0,
        tone: 'professional',
        sources: [],
      };
    }
  },

  /**
   * Fallback categorization using keywords
   */
  fallbackCategorization(description: string): CategorizationResult {
    const text = description.toLowerCase();
    
    const categoryKeywords: Record<TicketCategory, string[]> = {
      ACCESS: ['login', 'password', 'access', 'permission', 'locked', 'account', 'sign in', 'cant log'],
      PAYMENTS: ['payment', 'pay', 'transaction', 'money', 'transfer', 'receipt', 'invoice', 'naira', '₦'],
      REPORTS: ['report', 'export', 'download', 'pdf', 'excel', 'statement', 'summary'],
      MEMBERS: ['member', 'profile', 'user', 'registration', 'invite', 'join'],
      TECHNICAL: ['error', 'slow', 'loading', 'crash', 'not working', 'broken', 'issue'],
      BUG: ['bug', 'glitch', 'wrong', 'incorrect', 'mistake', 'unexpected'],
      FEATURE_REQUEST: ['feature', 'request', 'suggest', 'would be nice', 'add', 'improve', 'enhancement'],
      OTHER: [],
    };

    let bestCategory = TicketCategory.OTHER;
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matches = keywords.filter(kw => text.includes(kw)).length;
      const score = keywords.length > 0 ? matches / keywords.length : 0;
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category as TicketCategory;
      }
    }

    return {
      category: bestCategory,
      confidence: Math.min(0.7, bestScore + 0.3), // Cap at 0.7 for fallback
      suggestedPriority: text.includes('urgent') || text.includes('critical') 
        ? TicketPriority.HIGH 
        : TicketPriority.MEDIUM,
      reasoning: 'Categorized using keyword matching (AI unavailable)',
    };
  },

  /**
   * Fallback sentiment analysis using keywords
   */
  fallbackSentiment(text: string): SentimentResult {
    const lowerText = text.toLowerCase();
    
    const urgentWords = ['urgent', 'immediately', 'critical', 'emergency', 'asap', 'now'];
    const negativeWords = ['frustrated', 'angry', 'terrible', 'awful', 'worst', 'hate', 'useless', 'broken'];
    const positiveWords = ['thank', 'great', 'excellent', 'helpful', 'appreciate', 'good', 'love'];

    const urgentCount = urgentWords.filter(w => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;

    let sentiment: SentimentResult['sentiment'] = 'neutral';
    let score = 0;

    if (urgentCount > 0 || negativeCount >= 2) {
      sentiment = urgentCount > 0 ? 'urgent' : 'negative';
      score = -0.5 - (negativeCount * 0.1);
    } else if (negativeCount > 0) {
      sentiment = 'negative';
      score = -0.3;
    } else if (positiveCount > 0) {
      sentiment = 'positive';
      score = 0.3 + (positiveCount * 0.1);
    }

    return {
      sentiment,
      score: Math.min(1, Math.max(-1, score)),
      escalationRecommended: sentiment === 'urgent' || score < -0.5,
      reasoning: 'Sentiment analyzed using keyword matching (AI unavailable)',
    };
  },

  /**
   * Log AI usage for auditing
   */
  async logAIUsage(
    associationId: number,
    userId: number,
    promptType: string,
    tokensUsed: number,
    costUsd: number
  ): Promise<void> {
    try {
      await prisma.aIAuditLog.create({
        data: {
          associationId,
          userId,
          promptType,
          modelUsed: 'openai/gpt-4-turbo-preview',
          tokensInput: Math.floor(tokensUsed * 0.7),
          tokensOutput: Math.floor(tokensUsed * 0.3),
          costUsd,
          outputSummary: `${promptType} request`,
          status: 'success',
        },
      });
    } catch (error) {
      console.error('Error logging AI usage:', error);
    }
  },
};

export default aiSupportService;
