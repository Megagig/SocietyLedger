import { z } from 'zod';

export const createFeedbackSchema = z.object({
  isHelpful: z.boolean(),
  comment: z.string().max(1000, 'Comment must be less than 1000 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
});

export type CreateFeedbackDto = z.infer<typeof createFeedbackSchema>;
