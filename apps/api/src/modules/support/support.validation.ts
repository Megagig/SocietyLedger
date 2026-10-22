// ============================================
// PHASE 21: SUPPORT VALIDATION SCHEMAS
// ============================================

import { z } from 'zod';
import { TicketAudience, TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

// ============================================
// TICKET VALIDATION
// ============================================

const booleanFromForm = (value: unknown) => (value === 'true' ? true : value === 'false' ? false : value);

export const createTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority).optional(),
  // AI-suggested values (optional)
  aiCategory: z.string().optional(),
  aiCategoryConfidence: z.coerce.number().min(0).max(1).optional(),
  aiSentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']).optional(),
  aiSentimentScore: z.coerce.number().min(-1).max(1).optional(),
});

/** What an association admin can ask SocietyLedger about — the member-facing categories (payments, reports, members) stay Tier 1. */
export const PLATFORM_CATEGORIES = ['ACCESS', 'BILLING', 'DATA', 'TECHNICAL', 'BUG', 'FEATURE_REQUEST', 'OTHER'] as const;

/** An association admin's own ticket to SocietyLedger support. */
export const createPlatformTicketSchema = createTicketSchema.extend({ category: z.enum(PLATFORM_CATEGORIES) });

/** An officer escalating a member's ticket: they write the summary themselves, so nothing of the member's ticket is copied. */
export const escalateTicketSchema = z.object({
  subject: z.string().min(5).max(200),
  summary: z.string().min(10).max(5000),
  category: z.enum(PLATFORM_CATEGORIES),
  priority: z.nativeEnum(TicketPriority).optional(),
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
  // Multipart form fields arrive as the strings "true"/"false".
  isInternal: z.preprocess(booleanFromForm, z.boolean().optional()),
  isAiGenerated: z.preprocess(booleanFromForm, z.boolean().optional()),
  aiConfidence: z.coerce.number().min(0).max(1).optional(),
});

// ============================================
// QUERY PARAMS VALIDATION
// ============================================

export const listTicketsQuerySchema = z.object({
  audience: z.nativeEnum(TicketAudience).optional(),
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

// ============================================
// PLATFORM (SocietyLedger staff) — Tier 2 tickets only
// ============================================

export const platformListQuerySchema = z.object({
  status: z.union([z.nativeEnum(TicketStatus), z.array(z.nativeEnum(TicketStatus))]).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  associationId: z.coerce.number().int().positive().optional(),
  assignedToId: z.coerce.number().int().positive().optional(),
  unassigned: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export const platformUpdateTicketSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedToId: z.number().int().positive().nullable().optional(),
});
