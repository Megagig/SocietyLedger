// ============================================
// PHASE 21: HELP VALIDATION SCHEMAS
// ============================================

import { z } from 'zod';
import { ARTICLE_CATEGORIES, FAQ_CATEGORIES } from './help.types';

// ============================================
// ARTICLE VALIDATION
// ============================================

export const createArticleSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  excerpt: z.string().max(500).optional(),
  category: z.enum(ARTICLE_CATEGORIES as unknown as [string, ...string[]]),
  tags: z.array(z.string().max(50)).max(10).optional(),
  roleVisibility: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const updateArticleSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(10).optional(),
  excerpt: z.string().max(500).optional(),
  category: z.enum(ARTICLE_CATEGORIES as unknown as [string, ...string[]]).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  roleVisibility: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const searchArticlesSchema = z.object({
  query: z.string().min(1).max(200).optional(),
  // Reading is not limited to the authoring list: articles already exist in other categories (e.g. "governance").
  category: z.string().min(1).max(50).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

// ============================================
// FAQ VALIDATION
// ============================================

export const createFAQSchema = z.object({
  question: z.string().min(5).max(500),
  answer: z.string().min(10),
  category: z.enum(FAQ_CATEGORIES as unknown as [string, ...string[]]),
  roleVisibility: z.array(z.string()).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateFAQSchema = z.object({
  question: z.string().min(5).max(500).optional(),
  answer: z.string().min(10).optional(),
  category: z.enum(FAQ_CATEGORIES as unknown as [string, ...string[]]).optional(),
  roleVisibility: z.array(z.string()).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// HELPFUL FEEDBACK VALIDATION
// ============================================

export const markHelpfulSchema = z.object({
  helpful: z.boolean(),
});

// ============================================
// QUERY PARAMS VALIDATION
// ============================================

export const listFAQsQuerySchema = z.object({
  category: z.enum(FAQ_CATEGORIES as unknown as [string, ...string[]]).optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
export type SearchArticlesInput = z.infer<typeof searchArticlesSchema>;
export type CreateFAQInput = z.infer<typeof createFAQSchema>;
export type UpdateFAQInput = z.infer<typeof updateFAQSchema>;
export type MarkHelpfulInput = z.infer<typeof markHelpfulSchema>;
