// ============================================
// PHASE 21: SUPPORT VALIDATION SCHEMAS
// ============================================

import { z } from 'zod';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

// ============================================
// TICKET VALIDATION
// ============================================

export const createTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority).optional(),
  // AI-suggested values (optional)
  aiCategory: z.string().optional(),
  aiCategoryConfidence: z.number().min(0).max(1).optional(),
  aiSentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']).optional(),
  aiSentimentScore: z.number().min(-1).max(1).optional(),
});

export const updateTicketSchema = z.object({
  subject: z.string().min(5).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  assignedToId: z.number().int().positive().nullable().optional(),
});

export const addResponseSchema = z.object({
  message: z.string().min(1).max(10000),
  isInternal: z.boolean().optional(),
  isAiGenerated: z.boolean().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
});

// ============================================
// QUERY PARAMS VALIDATION
// ============================================

export const listTicketsQuerySchema = z.object({
  status: z.union([
    z.nativeEnum(TicketStatus),
    z.array(z.nativeEnum(TicketStatus)),
  ]).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedToId: z.coerce.number().int().optional(),
  userId: z.coerce.number().int().optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type AddResponseInput = z.infer<typeof addResponseSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
