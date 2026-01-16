import { z } from 'zod';
import { DocStatus } from '@prisma/client';

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

export type UpdatePageDto = z.infer<typeof updatePageSchema>;
