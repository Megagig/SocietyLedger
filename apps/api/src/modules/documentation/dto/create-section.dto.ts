import { z } from 'zod';

export const createSectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  slug: z.string().min(1, 'Slug is required').max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  icon: z.string().max(50, 'Icon must be less than 50 characters').optional(),
  order: z.number().int().min(0).optional(),
});

export type CreateSectionDto = z.infer<typeof createSectionSchema>;
