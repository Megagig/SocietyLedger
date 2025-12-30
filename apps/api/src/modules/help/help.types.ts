// ============================================
// PHASE 21: HELP & SUPPORT TYPES
// ============================================

import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// HELP ARTICLE TYPES
// ============================================

export interface HelpArticle {
  id: number;
  associationId: number | null;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateArticleRequest {
  title: string;
  content: string;
  excerpt?: string;
  category: string;
  tags?: string[];
  roleVisibility?: string[];
  isPublished?: boolean;
  isFeatured?: boolean;
}

export interface UpdateArticleRequest {
  title?: string;
  content?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  roleVisibility?: string[];
  isPublished?: boolean;
  isFeatured?: boolean;
}

export interface ArticleSearchParams {
  query?: string;
  category?: string;
  tags?: string[];
  role?: string;
  limit?: number;
  offset?: number;
}

export interface ArticleSearchResult {
  articles: HelpArticle[];
  total: number;
  hasMore: boolean;
}

// ============================================
// FAQ TYPES
// ============================================

export interface FAQItem {
  id: number;
  associationId: number | null;
  question: string;
  answer: string;
  category: string;
  roleVisibility: string[];
  sortOrder: number;
  isActive: boolean;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFAQRequest {
  question: string;
  answer: string;
  category: string;
  roleVisibility?: string[];
  sortOrder?: number;
}

export interface UpdateFAQRequest {
  question?: string;
  answer?: string;
  category?: string;
  roleVisibility?: string[];
  sortOrder?: number;
  isActive?: boolean;
}

export interface FAQByCategory {
  category: string;
  items: FAQItem[];
}

// ============================================
// QUICK ACTION TYPES
// ============================================

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  roles: string[];
}

// ============================================
// HELP CENTER RESPONSE TYPES
// ============================================

export interface HelpCenterData {
  featuredArticles: HelpArticle[];
  topFAQs: FAQItem[];
  quickActions: QuickAction[];
  categories: { name: string; count: number }[];
}

// ============================================
// ARTICLE CATEGORIES
// ============================================

export const ARTICLE_CATEGORIES = [
  'getting_started',
  'members',
  'finance',
  'reports',
  'settings',
  'troubleshooting',
] as const;

export type ArticleCategory = typeof ARTICLE_CATEGORIES[number];

// ============================================
// FAQ CATEGORIES
// ============================================

export const FAQ_CATEGORIES = [
  'general',
  'payments',
  'members',
  'reports',
  'technical',
] as const;

export type FAQCategory = typeof FAQ_CATEGORIES[number];
