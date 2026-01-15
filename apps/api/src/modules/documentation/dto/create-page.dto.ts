import { z } from 'zod';

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

export type CreatePageDto = z.infer<typeof createPageSchema>;
