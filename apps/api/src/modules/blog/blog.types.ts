// ============================================
// BLOG & DOCUMENTATION SYSTEM - BLOG TYPES
// ============================================

import { PostStatus, CommentStatus, ContentScope } from '@prisma/client';

// ============================================
// BLOG POST TYPES
// ============================================

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  status: PostStatus;
  scope: ContentScope;
  publishedAt: Date | null;
  viewCount: number;
  readTimeMinutes: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string[];
  authorId: number;
  categoryId: number | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  author?: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  category?: {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  };
  tags?: BlogTag[];
  comments?: BlogComment[];
}

export interface BlogPostWithRelations extends BlogPost {
  author: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  category?: {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  };
  tags: BlogTag[];
  _count?: {
    comments: number;
  };
}

export interface CreatePostRequest {
  title: string;
  content: string;
  excerpt?: string;
  coverImage?: string | null;
  status?: PostStatus;
  scope?: ContentScope;
  publishedAt?: Date | null;
  readTimeMinutes?: number;
  categoryId?: number;
  tagIds?: number[];
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  excerpt?: string;
  coverImage?: string | null;
  status?: PostStatus;
  scope?: ContentScope;
  publishedAt?: Date | null;
  readTimeMinutes?: number;
  categoryId?: number;
  tagIds?: number[];
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
}

export interface PostSearchParams {
  status?: PostStatus;
  categoryId?: number;
  tagId?: number;
  authorId?: number;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'publishedAt' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
}

export interface PostSearchResult {
  posts: BlogPostWithRelations[];
  total: number;
  hasMore: boolean;
}

// ============================================
// BLOG CATEGORY TYPES
// ============================================

export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    posts: number;
  };
}

export interface CreateCategoryRequest {
  name: string;
  slug: string;
  description?: string;
  color?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  description?: string;
  color?: string;
}

// ============================================
// BLOG TAG TYPES
// ============================================

export interface BlogTag {
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface CreateTagRequest {
  name: string;
  slug: string;
}

export interface UpdateTagRequest {
  name?: string;
  slug?: string;
}

// ============================================
// BLOG COMMENT TYPES
// ============================================

export interface BlogComment {
  id: number;
  content: string;
  status: CommentStatus;
  postId: number;
  authorId: number | null;
  guestName: string | null;
  guestEmail: string | null;
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  author?: {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  post?: {
    id: number;
    title: string;
    slug: string;
  };
  parent?: BlogComment;
  replies?: BlogComment[];
}

export interface CreateCommentRequest {
  content: string;
  postId: number;
  parentId?: number | null;
  guestName?: string;
  guestEmail?: string;
}

export interface UpdateCommentRequest {
  content?: string;
  status?: CommentStatus;
}

export interface CommentSearchParams {
  postId: number;
  status?: CommentStatus;
  limit?: number;
  offset?: number;
}

// ============================================
// RELATED POSTS
// ============================================

export interface RelatedPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: Date | null;
  readTimeMinutes: number | null;
  category?: {
    id: number;
    name: string;
    slug: string;
    color: string | null;
  };
}

// ============================================
// VIEW TRACKING
// ============================================

export interface ViewIncrementRequest {
  postId: number;
}
