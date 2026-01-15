// ============================================
// BLOG & DOCUMENTATION SYSTEM - BLOG VALIDATION
// ============================================

import { z } from 'zod';
import { PostStatus, CommentStatus, ContentScope } from '@prisma/client';

// ============================================
// BLOG POST VALIDATION
// ============================================

export const createPostSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  excerpt: z.string().max(500).optional(),
  coverImage: z.string().url().nullable().optional(),
  status: z.nativeEnum(PostStatus).optional(),
  scope: z.nativeEnum(ContentScope).optional(),
  publishedAt: z.coerce.date().optional().nullable(),
  readTimeMinutes: z.coerce.number().int().min(1).max(120).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  tagIds: z.array(z.coerce.number().int().positive()).max(10).optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  metaKeywords: z.array(z.string().max(50)).max(10).optional(),
});

export const updatePostSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(10).optional(),
  excerpt: z.string().max(500).optional(),
  coverImage: z.string().url().nullable().optional(),
  status: z.nativeEnum(PostStatus).optional(),
  scope: z.nativeEnum(ContentScope).optional(),
  publishedAt: z.coerce.date().optional().nullable(),
  readTimeMinutes: z.coerce.number().int().min(1).max(120).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  tagIds: z.array(z.coerce.number().int().positive()).max(10).optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  metaKeywords: z.array(z.string().max(50)).max(10).optional(),
});

export const searchPostsSchema = z.object({
  status: z.nativeEnum(PostStatus).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  tagId: z.coerce.number().int().positive().optional(),
  authorId: z.coerce.number().int().positive().optional(),
  search: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(['createdAt', 'publishedAt', 'viewCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const incrementViewSchema = z.object({
  postId: z.coerce.number().int().positive(),
});

// ============================================
// BLOG CATEGORY VALIDATION
// ============================================

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

// ============================================
// BLOG TAG VALIDATION
// ============================================

export const createTagSchema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
});

export const updateTagSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
});

// ============================================
// BLOG COMMENT VALIDATION
// ============================================

export const createCommentSchema = z.object({
  content: z.string().min(5).max(2000),
  parentId: z.coerce.number().int().positive().optional().nullable(),
  guestName: z.string().min(2).max(100).optional(),
  guestEmail: z.string().email().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(5).max(2000).optional(),
  status: z.nativeEnum(CommentStatus).optional(),
});

export const listCommentsSchema = z.object({
  status: z.nativeEnum(CommentStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ============================================
// RELATED POSTS VALIDATION
// ============================================

export const getRelatedPostsSchema = z.object({
  postId: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

// ============================================
// QUERY PARAMS VALIDATION
// ============================================

export const listPostsQuerySchema = z.object({
  status: z.nativeEnum(PostStatus).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  tagId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const listCategoriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listTagsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// ============================================
// TYPES
// ============================================

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type SearchPostsInput = z.infer<typeof searchPostsSchema>;
export type IncrementViewInput = z.infer<typeof incrementViewSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type GetRelatedPostsInput = z.infer<typeof getRelatedPostsSchema>;
