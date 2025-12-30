// ============================================
// PHASE 21: AI HELP SERVICE
// AI-powered help features using OpenRouter
// ============================================

import { prisma } from '../../lib/prisma';
import openRouterClient from '../../lib/openrouter';
import { aiRateLimiter } from '../ai/tools/rate-limiter';
import { validateAIOutput } from '../ai/tools/safety-guards';
import { HelpArticle } from './help.types';

// ============================================
// TYPES
// ============================================

export interface ArticleSuggestion {
  article: HelpArticle;
  relevanceScore: number;
  matchReason: string;
}

export interface KnowledgeBaseAnswer {
  answer: string;
  confidence: number;
  sources: { title: string; slug: string; excerpt: string }[];
  suggestTicket: boolean;
}

// ============================================
// AI HELP SERVICE
// ============================================

export const aiHelpService = {
  /**
   * Check if AI is available
   */
  isAvailable(): boolean {
    return openRouterClient.isConfigured();
  },

  /**
   * Suggest relevant articles based on user query
   * Uses semantic matching to find the most relevant help articles
   */
  async suggestArticles(
    associationId: number,
    userId: number,
    query: string,
    options: { userRole?: string; limit?: number } = {}
  ): Promise<ArticleSuggestion[]> {
    const { userRole = 'member', limit = 5 } = options;

    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

    // Get all published articles visible to user's role
    const articles = await prisma.helpArticle.findMany({
      where: {
        isPublished: true,
        OR: [
          { associationId: null },
          { associationId: associationId },
        ],
        roleVisibility: { has: userRole },
      },
      take: 50, // Get top 50 for AI to rank
    });

    if (articles.length === 0) {
      return [];
    }

    // Build prompt for AI to rank articles
    const articleSummaries = articles.map((a, i) => 
      `[${i}] "${a.title}" (${a.category}): ${a.excerpt || a.content.substring(0, 150)}`
    ).join('\n');

    const prompt = `
You are a help center assistant. A user is searching for help with the following query:

USER QUERY: "${query}"

Here are the available help articles:
${articleSummaries}

Rank the TOP ${limit} most relevant articles for this query. For each, provide:
1. The article index number [X]
2. A relevance score from 0.0 to 1.0
3. A brief reason why it's relevant (1 sentence)

Format your response as JSON array:
[
  {"index": 0, "score": 0.95, "reason": "Directly addresses the user's question about..."},
  ...
]

Only include articles that are actually relevant (score > 0.3). If no articles are relevant, return an empty array [].
`;

    try {
      const response = await openRouterClient.chat(
        [
          { role: 'system', content: 'You are a helpful assistant that ranks help articles by relevance. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.2, maxTokens: 500 }
      );

      // Validate and parse response
      const safeContent = validateAIOutput(response.content, {
        type: 'article_suggestion',
        associationId,
      });

      // Extract JSON from response
      const jsonMatch = safeContent.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('AI response did not contain valid JSON array');
        return [];
      }

      const rankings = JSON.parse(jsonMatch[0]) as { index: number; score: number; reason: string }[];

      // Map rankings to articles
      const suggestions: ArticleSuggestion[] = rankings
        .filter(r => r.index >= 0 && r.index < articles.length && r.score > 0.3)
        .slice(0, limit)
        .map(r => ({
          article: articles[r.index] as HelpArticle,
          relevanceScore: r.score,
          matchReason: r.reason,
        }));

      // Log AI usage
      await this.logAIUsage(associationId, userId, 'article_suggestion', response.tokensUsed.total, response.costUsd);

      return suggestions;
    } catch (error) {
      console.error('Error in AI article suggestion:', error);
      // Fallback to simple text search
      return this.fallbackArticleSearch(articles, query, limit);
    }
  },

  /**
   * Answer question from knowledge base
   * AI generates answer using help articles as context
   */
  async answerFromKnowledgeBase(
    associationId: number,
    userId: number,
    question: string,
    options: { userRole?: string } = {}
  ): Promise<KnowledgeBaseAnswer> {
    const { userRole = 'member' } = options;

    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

    // Get relevant articles first
    const suggestions = await this.suggestArticles(associationId, userId, question, {
      userRole,
      limit: 3,
    });

    if (suggestions.length === 0) {
      return {
        answer: "I couldn't find any relevant information in our help center for your question. Would you like to create a support ticket so our team can assist you?",
        confidence: 0,
        sources: [],
        suggestTicket: true,
      };
    }

    // Build context from top articles
    const context = suggestions.map(s => 
      `ARTICLE: "${s.article.title}"\n${s.article.content}`
    ).join('\n\n---\n\n');

    const prompt = `
You are a helpful assistant for SocietyLedger, a platform for managing association finances.

Based ONLY on the following help articles, answer the user's question. If the articles don't contain enough information to fully answer the question, say so and suggest creating a support ticket.

HELP ARTICLES:
${context}

USER QUESTION: ${question}

Provide a clear, helpful answer. If you're not confident the articles fully address the question, indicate that the user should create a support ticket for personalized help.

Format your response as JSON:
{
  "answer": "Your helpful answer here...",
  "confidence": 0.85,
  "suggestTicket": false
}

Confidence should be 0.0-1.0 based on how well the articles address the question.
`;

    try {
      const response = await openRouterClient.chat(
        [
          { role: 'system', content: 'You are a helpful assistant that answers questions using provided documentation. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.3, maxTokens: 1000 }
      );

      const safeContent = validateAIOutput(response.content, {
        type: 'knowledge_base_answer',
        associationId,
      });

      // Parse JSON response
      const jsonMatch = safeContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as { answer: string; confidence: number; suggestTicket: boolean };

      // Log AI usage
      await this.logAIUsage(associationId, userId, 'knowledge_base_qa', response.tokensUsed.total, response.costUsd);

      return {
        answer: parsed.answer,
        confidence: parsed.confidence,
        sources: suggestions.map(s => ({
          title: s.article.title,
          slug: s.article.slug,
          excerpt: s.article.excerpt || s.article.content.substring(0, 150),
        })),
        suggestTicket: parsed.suggestTicket || parsed.confidence < 0.5,
      };
    } catch (error) {
      console.error('Error in AI knowledge base answer:', error);
      return {
        answer: "I'm having trouble processing your question right now. Please try again or create a support ticket for assistance.",
        confidence: 0,
        sources: suggestions.map(s => ({
          title: s.article.title,
          slug: s.article.slug,
          excerpt: s.article.excerpt || s.article.content.substring(0, 150),
        })),
        suggestTicket: true,
      };
    }
  },

  /**
   * Fallback article search using simple text matching
   */
  fallbackArticleSearch(
    articles: any[],
    query: string,
    limit: number
  ): ArticleSuggestion[] {
    const queryWords = query.toLowerCase().split(/\s+/);
    
    const scored = articles.map(article => {
      const text = `${article.title} ${article.content} ${article.tags?.join(' ') || ''}`.toLowerCase();
      const matchCount = queryWords.filter(word => text.includes(word)).length;
      const score = matchCount / queryWords.length;
      
      return {
        article: article as HelpArticle,
        relevanceScore: score,
        matchReason: `Matches ${matchCount} of ${queryWords.length} search terms`,
      };
    });

    return scored
      .filter(s => s.relevanceScore > 0.2)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
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
          tokensInput: Math.floor(tokensUsed * 0.7), // Approximate split
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

export default aiHelpService;
