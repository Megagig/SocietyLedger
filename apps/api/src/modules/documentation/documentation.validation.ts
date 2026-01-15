import { z } from 'zod';
import { DocStatus } from '@prisma/client';

export const createPageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  slug: z.string().min(1, 'Slug is required').max(200, 'Slug must be less than 200 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().max(500, 'Excerpt must be less than 500 characters').optional(),
  order: z.number().int().min(0).optional(),
  scope: z.enum(['PLATFORM', 'ASSOCIATION']).optional(),
  parentId: z.number().int().positive().optional(),
  sectionId: z.number().int().positive().optional(),
  metaTitle: z.string().max(200, 'Meta title must be less than 200 characters').optional(),
  metaDescription: z.string().max(500, 'Meta description must be less than 500 characters').optional(),
  version: z.string().max(50, 'Version must be less than 50 characters').optional(),
});

export const updatePageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters').optional(),
  slug: z.string().min(1, 'Slug is required').max(200, 'Slug must be less than 200 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  content: z.string().min(1, 'Content is required').optional(),
  excerpt: z.string().max(500, 'Excerpt must be less than 500 characters').optional(),
  order: z.number().int().min(0).optional(),
  parentId: z.number().int().positive().nullable().optional(),
  sectionId: z.number().int().positive().nullable().optional(),
  metaTitle: z.string().max(200, 'Meta title must be less than 200 characters').optional(),
  metaDescription: z.string().max(500, 'Meta description must be less than 500 characters').optional(),
  version: z.string().max(50, 'Version must be less than 50 characters').optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  publishedAt: z.date().nullable().optional(),
});

export const createSectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  icon: z.string().max(50, 'Icon must be less than 50 characters').optional(),
  order: z.number().int().min(0).optional(),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').optional(),
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  icon: z.string().max(50, 'Icon must be less than 50 characters').optional(),
  order: z.number().int().min(0).optional(),
});

export const createFeedbackSchema = z.object({
  isHelpful: z.boolean(),
  comment: z.string().max(1000, 'Comment must be less than 1000 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
});

export const searchDocsSchema = z.object({
  query: z.string().min(1, 'Query is required').max(100, 'Query must be less than 100 characters'),
  sectionId: z.number().int().positive().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});
