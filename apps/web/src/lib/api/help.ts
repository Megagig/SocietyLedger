// ============================================
// PHASE 21: HELP API CLIENT
// Frontend API functions for help center
// ============================================

import { API_ROUTES } from '@/utils/constants';

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
  const response = await fetch(API_ROUTES.HELP.CENTER, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to load help center');
  }
  
  const data = await response.json();
  return data.data;
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
  const searchParams = new URLSearchParams();
  if (params?.query) searchParams.set('query', params.query);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  
  const url = `${API_ROUTES.HELP.ARTICLES}?${searchParams.toString()}`;
  const response = await fetch(url, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to list articles');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Search articles
 */
export async function searchArticles(query: string, limit?: number): Promise<HelpArticle[]> {
  const searchParams = new URLSearchParams({ q: query });
  if (limit) searchParams.set('limit', limit.toString());
  
  const url = `${API_ROUTES.HELP.ARTICLE_SEARCH}?${searchParams.toString()}`;
  const response = await fetch(url, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to search articles');
  }
  
  const data = await response.json();
  return data.data.articles;
}

/**
 * Get article by slug
 */
export async function getArticle(slug: string): Promise<HelpArticle> {
  const response = await fetch(API_ROUTES.HELP.ARTICLE_BY_SLUG(slug), {
    credentials: 'include',
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Article not found');
    }
    throw new Error('Failed to get article');
  }
  
  const data = await response.json();
  return data.data;
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
  const response = await fetch(API_ROUTES.HELP.ARTICLE_CATEGORIES, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to get categories');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get FAQ categories
 */
export async function getFAQCategories(): Promise<{ name: string; label: string }[]> {
  const response = await fetch(API_ROUTES.HELP.FAQ_CATEGORIES, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to get FAQ categories');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Mark article as helpful/not helpful
 */
export async function markArticleHelpful(
  articleId: number,
  helpful: boolean
): Promise<{ helpfulCount: number; notHelpfulCount: number }> {
  const response = await fetch(API_ROUTES.HELP.ARTICLE_HELPFUL(articleId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ helpful }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to submit feedback');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * List FAQs
 */
export async function listFAQs(category?: string): Promise<FAQItem[]> {
  const url = category 
    ? `${API_ROUTES.HELP.FAQS}?category=${category}`
    : API_ROUTES.HELP.FAQS;
    
  const response = await fetch(url, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to list FAQs');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get FAQs grouped by category
 */
export async function getFAQsByCategory(): Promise<FAQByCategory[]> {
  const response = await fetch(API_ROUTES.HELP.FAQS_BY_CATEGORY, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to get FAQs');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get quick actions for current user
 */
export async function getQuickActions(): Promise<QuickAction[]> {
  const response = await fetch(API_ROUTES.HELP.QUICK_ACTIONS, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to get quick actions');
  }
  
  const data = await response.json();
  return data.data;
}

// ============================================
// AI API FUNCTIONS
// ============================================

/**
 * Check AI availability
 */
export async function getAIStatus(): Promise<AIStatus> {
  const response = await fetch(API_ROUTES.HELP.AI_STATUS, {
    credentials: 'include',
  });
  
  if (!response.ok) {
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
  
  const data = await response.json();
  return data.data;
}

/**
 * Get AI-suggested articles
 */
export async function suggestArticles(
  query: string,
  limit?: number
): Promise<ArticleSuggestion[]> {
  const response = await fetch(API_ROUTES.HELP.AI_SUGGEST_ARTICLES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, limit }),
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 503) {
      throw new Error('AI service unavailable');
    }
    throw new Error('Failed to get suggestions');
  }
  
  const data = await response.json();
  return data.data.suggestions;
}

/**
 * Ask AI a question from knowledge base
 */
export async function askQuestion(question: string): Promise<KnowledgeBaseAnswer> {
  const response = await fetch(API_ROUTES.HELP.AI_ANSWER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ question }),
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 503) {
      throw new Error('AI service unavailable');
    }
    throw new Error('Failed to get answer');
  }
  
  const data = await response.json();
  return data.data;
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
