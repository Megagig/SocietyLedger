/**
 * SMS Module Validation Schemas
 * Phase 6.5: SMS & Bulk Communication
 */

import { z } from 'zod';

// Phone number validation (Nigerian format)
const phoneNumberSchema = z.string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number must be at most 15 digits')
  .regex(/^[0-9+]+$/, 'Phone number can only contain digits and +');

// ============================================
// Quick SMS Validation
// ============================================

export const quickSMSSchema = z.object({
  recipients: z.array(z.string()).min(1, 'At least one recipient is required').max(1000, 'Maximum 1000 recipients allowed'),
  message: z.string().min(1, 'Message is required').max(918, 'Message too long (max 918 characters for 6 segments)'),
  useTemplate: z.boolean().optional().default(false),
  templateId: z.number().int().positive().optional(),
  templateData: z.record(z.union([z.string(), z.number()])).optional(),
});

// ============================================
// Campaign Validation
// ============================================

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Campaign name too long'),
  message: z.string().min(1, 'Message is required').max(918, 'Message too long'),
  templateId: z.number().int().positive().optional(),
  recipientType: z.enum([
    'ALL_MEMBERS',
    'SELECTED_MEMBERS',
    'MEMBER_CATEGORY',
    'CUSTOM_NUMBERS',
    'OWING_MEMBERS',
    'PAID_MEMBERS',
  ]),
  recipientFilter: z.object({
    memberIds: z.array(z.number().int().positive()).optional(),
    categories: z.array(z.string()).optional(),
    statuses: z.array(z.string()).optional(),
    customNumbers: z.array(phoneNumberSchema).optional(),
    owingMinAmount: z.number().positive().optional(),
  }).optional(),
  scheduledAt: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  message: z.string().min(1).max(918).optional(),
  templateId: z.number().int().positive().nullable().optional(),
  recipientType: z.enum([
    'ALL_MEMBERS',
    'SELECTED_MEMBERS',
    'MEMBER_CATEGORY',
    'CUSTOM_NUMBERS',
    'OWING_MEMBERS',
    'PAID_MEMBERS',
  ]).optional(),
  recipientFilter: z.object({
    memberIds: z.array(z.number().int().positive()).optional(),
    categories: z.array(z.string()).optional(),
    statuses: z.array(z.string()).optional(),
    customNumbers: z.array(phoneNumberSchema).optional(),
    owingMinAmount: z.number().positive().optional(),
  }).optional(),
  scheduledAt: z.string().datetime().nullable().optional().transform(val => val ? new Date(val) : null),
});

// ============================================
// Template Validation
// ============================================

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100, 'Template name too long'),
  content: z.string().min(1, 'Template content is required').max(918, 'Template content too long'),
  category: z.enum([
    'GENERAL',
    'PAYMENT_REMINDER',
    'MEETING',
    'DUES',
    'LEVY',
    'WELFARE',
    'ELECTION',
    'CUSTOM',
  ]),
  placeholders: z.array(z.string()).optional().default([]),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(918).optional(),
  category: z.enum([
    'GENERAL',
    'PAYMENT_REMINDER',
    'MEETING',
    'DUES',
    'LEVY',
    'WELFARE',
    'ELECTION',
    'CUSTOM',
  ]).optional(),
  placeholders: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// Single SMS Validation
// ============================================

export const sendSingleSMSSchema = z.object({
  phone: phoneNumberSchema,
  message: z.string().min(1, 'Message is required').max(918, 'Message too long'),
  memberId: z.number().int().positive().optional(),
});

// ============================================
// Credit Top-up Validation
// ============================================

export const topUpCreditsSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  reference: z.string().optional(),
  description: z.string().optional(),
});

// ============================================
// Query Validation
// ============================================

export const listMessagesQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'REJECTED']).optional(),
  campaignId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const listCampaignsQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  status: z.enum(['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED']).optional(),
});

export const listTemplatesQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  category: z.enum([
    'GENERAL',
    'PAYMENT_REMINDER',
    'MEETING',
    'DUES',
    'LEVY',
    'WELFARE',
    'ELECTION',
    'CUSTOM',
  ]).optional(),
  isActive: z.string().optional().transform(val => val === 'true'),
});

// Type exports
export type QuickSMSInput = z.infer<typeof quickSMSSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type SendSingleSMSInput = z.infer<typeof sendSingleSMSSchema>;
export type TopUpCreditsInput = z.infer<typeof topUpCreditsSchema>;
