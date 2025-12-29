// ============================================
// PHASE 17: AI INTEGRATION VALIDATION SCHEMAS
// ============================================

import { z } from 'zod';

// ============================================
// FINANCIAL ASSISTANT VALIDATION
// ============================================

export const financialQuerySchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters').max(500, 'Question too long'),
  context: z.object({
    memberId: z.number().optional(),
    categoryId: z.number().optional(),
    dateRange: z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }).optional(),
  }).optional(),
});

// ============================================
// DOCUMENT Q&A VALIDATION
// ============================================

export const documentUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  content: z.string().min(10, 'Document content is required'),
  documentType: z.enum(['constitution', 'bylaw', 'policy', 'minutes', 'other']),
  metadata: z.record(z.any()).optional(),
});

export const documentQuerySchema = z.object({
  question: z.string().min(5, 'Question must be at least 5 characters').max(500, 'Question too long'),
  documentTypes: z.array(z.string()).optional(),
  maxResults: z.number().min(1).max(10).optional().default(5),
});

// ============================================
// SMART REMINDERS VALIDATION
// ============================================

export const reminderSuggestionsSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  minDaysOverdue: z.string().optional().transform(val => val ? parseInt(val) : 1),
  maxDaysOverdue: z.string().optional().transform(val => val ? parseInt(val) : undefined),
});

// ============================================
// REPORT GENERATION VALIDATION
// ============================================

export const aiReportSchema = z.object({
  reportType: z.enum(['monthly_summary', 'quarterly_review', 'annual_report', 'treasurer_handover']),
  period: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  }).optional(),
  includeRecommendations: z.boolean().optional().default(true),
});

// ============================================
// NATURAL LANGUAGE QUERY VALIDATION
// ============================================

export const nlQuerySchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters').max(300, 'Query too long'),
});

// ============================================
// AI USAGE STATS VALIDATION
// ============================================

export const usageStatsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day'),
});

// ============================================
// AI CHAT VALIDATION
// ============================================

export const aiChatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  conversationId: z.string().optional(),
  feature: z.enum(['financial', 'document_qa', 'general']).default('financial'),
});

// Type exports
export type FinancialQueryInput = z.infer<typeof financialQuerySchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentQueryInput = z.infer<typeof documentQuerySchema>;
export type ReminderSuggestionsInput = z.infer<typeof reminderSuggestionsSchema>;
export type AIReportInput = z.infer<typeof aiReportSchema>;
export type NLQueryInput = z.infer<typeof nlQuerySchema>;
export type UsageStatsQueryInput = z.infer<typeof usageStatsQuerySchema>;
export type AIChatInput = z.infer<typeof aiChatSchema>;
