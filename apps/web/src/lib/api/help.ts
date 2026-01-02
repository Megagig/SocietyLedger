// ============================================
// PHASE 21: HELP API CLIENT
// Frontend API functions for help center
// ============================================

import api from '@/lib/axios';
import { API_ROUTES } from '@/utils/constants';

// Get base path for help routes (strip the base URL since axios already has it)
const getHelpPath = (fullUrl: string) => {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  return fullUrl.replace(`${apiBase}/api`, '');
};

// ============================================
// TYPES
// ============================================

export interface HelpArticle {
  id: number;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  category: string;
  tags: string[];
  roleVisibility: string[];
  isPublished: boolean;
  isFeatured: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  roleVisibility: string[];
  sortOrder: number;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  roles: string[];
}

export interface HelpCenterData {
  featuredArticles: HelpArticle[];
  topFAQs: FAQItem[];
  quickActions: QuickAction[];
  categories: { name: string; count: number }[];
}

export interface ArticleSearchResult {
  articles: HelpArticle[];
  total: number;
  hasMore: boolean;
}

export interface FAQByCategory {
  category: string;
  items: FAQItem[];
}

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

export interface AIStatus {
  available: boolean;
  features: {
    articleSuggestions: boolean;
    knowledgeBaseQA: boolean;
    ticketCategorization: boolean;
    sentimentAnalysis: boolean;
    responseSuggestions: boolean;
  };
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get help center homepage data
 */
export async function getHelpCenter(): Promise<HelpCenterData> {
  const response = await api.get(getHelpPath(API_ROUTES.HELP.CENTER));
  return response.data.data;
}

/**
 * List articles with optional filters
 */
export async function listArticles(params?: {
  query?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<ArticleSearchResult> {
  const response = await api.get(getHelpPath(API_ROUTES.HELP.ARTICLES), { params });
  return response.data.data;
}

/**
 * Search articles
 */
export async function searchArticles(query: string, limit?: number): Promise<HelpArticle[]> {
  const response = await api.get(getHelpPath(API_ROUTES.HELP.ARTICLE_SEARCH), {
    params: { q: query, limit },
  });
  return response.data.data.articles;
}

/**
 * Get article by slug
 */
export async function getArticle(slug: string): Promise<HelpArticle> {
  const response = await api.get(getHelpPath(API_ROUTES.HELP.ARTICLE_BY_SLUG(slug)));
  return response.data.data;
}

/**
 * Get article by slug (alias)
 */
export async function getArticleBySlug(slug: string): Promise<HelpArticle | null> {
  try {
    return await getArticle(slug);
  } catch {
    return null;
  }
}

/**
 * Get article categories
 */
export async function getArticleCategories(): Promise<{ name: string; label: string }[]> {
  const response = await api.get(getHelpPath(API_ROUTES.HELP.ARTICLE_CATEGORIES));
  return response.data.data;
}

/**
 * Get FAQ categories
 */
export async function getFAQCategories(): Promise<{ name: string; label: string }[]> {
  const response = await api.get(getHelpPath(API_ROUTES.HELP.FAQ_CATEGORIES));
  return response.data.data;
}

/**
 * Mark article as helpful/not helpful
 */
export async function markArticleHelpful(
  articleId: number,
  helpful: boolean
): Promise<{ helpfulCount: number; notHelpfulCount: number }> {
  const response = await api.post(getHelpPath(API_ROUTES.HELP.ARTICLE_HELPFUL(articleId)), { helpful });
  return response.data.data;
}

/**
 * List FAQs
 */
export async function listFAQs(category?: string): Promise<FAQItem[]> {
  const response = await api.get(getHelpPath(API_ROUTES.HELP.FAQS), {
    params: category ? { category } : undefined,
  });
  return response.data.data;
}

/**
 * Get FAQs grouped by category
 */
export async function getFAQsByCategory(): Promise<FAQByCategory[]> {
  const response = await api.get(getHelpPath(API_ROUTES.HELP.FAQS_BY_CATEGORY));
  return response.data.data;
}

/**
 * Get quick actions for current user
 */
export async function getQuickActions(): Promise<QuickAction[]> {
  const response = await api.get(getHelpPath(API_ROUTES.HELP.QUICK_ACTIONS));
  return response.data.data;
}

// ============================================
// AI API FUNCTIONS
// ============================================

/**
 * Check AI availability
 */
export async function getAIStatus(): Promise<AIStatus> {
  try {
    const response = await api.get(getHelpPath(API_ROUTES.HELP.AI_STATUS));
    return response.data.data;
  } catch {
    return {
      available: false,
      features: {
        articleSuggestions: false,
        knowledgeBaseQA: false,
        ticketCategorization: false,
        sentimentAnalysis: false,
        responseSuggestions: false,
      },
    };
  }
}

/**
 * Get AI-suggested articles
 */
export async function suggestArticles(
  query: string,
  limit?: number
): Promise<ArticleSuggestion[]> {
  const response = await api.post(getHelpPath(API_ROUTES.HELP.AI_SUGGEST_ARTICLES), { query, limit });
  return response.data.data.suggestions;
}

/**
 * Ask AI a question from knowledge base
 */
export async function askQuestion(question: string): Promise<KnowledgeBaseAnswer> {
  const response = await api.post(getHelpPath(API_ROUTES.HELP.AI_ANSWER), { question });
  return response.data.data;
}

/**
 * Ask AI a question (alias for chatbot)
 */
export async function askAI(question: string): Promise<{
  answer: string;
  confidence: number;
  sources: HelpArticle[];
}> {
  try {
    const result = await askQuestion(question);
    return {
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources.map(s => ({
        id: 0,
        slug: s.slug,
        title: s.title,
        content: '',
        excerpt: s.excerpt,
        category: '',
        tags: [],
        roleVisibility: [],
        isPublished: true,
        isFeatured: false,
        viewCount: 0,
        helpfulCount: 0,
        notHelpfulCount: 0,
        createdAt: '',
        updatedAt: '',
      })),
    };
  } catch (error) {
    // Fallback response when AI is unavailable
    return {
      answer: 'I apologize, but I\'m unable to process your question right now. Please try searching our help articles or create a support ticket for assistance.',
      confidence: 0,
      sources: [],
    };
  }
}
