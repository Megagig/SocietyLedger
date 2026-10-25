// ============================================
// PHASE 17: AI INTEGRATION TYPES
// ============================================

import { Decimal } from '@prisma/client/runtime/library';

// ============================================
// AI CONFIGURATION TYPES
// ============================================

export interface AIConfig {
  provider: 'openrouter';
  defaultModel: string;
  embeddingModel: string;
  maxTokens: number;
  temperature: number;
}

export interface AIModelConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
}

// ============================================
// AI REQUEST/RESPONSE TYPES
// ============================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  finishReason: string;
}

export interface AIEmbeddingRequest {
  text: string;
  model?: string;
}

export interface AIEmbeddingResponse {
  embedding: number[];
  model: string;
  tokensUsed: number;
}

// ============================================
// FINANCIAL ASSISTANT TYPES
// ============================================

export interface FinancialQueryRequest {
  question: string;
  context?: {
    memberId?: number;
    categoryId?: number;
    dateRange?: {
      startDate: Date;
      endDate: Date;
    };
  };
}

export interface FinancialQueryResponse {
  answer: string;
  dataUsed: {
    type: string;
    summary: string;
  }[];
  confidence: 'high' | 'medium' | 'low';
  tokensUsed: {
    input: number;
    output: number;
  };
  processingTimeMs: number;
}

export interface FinancialDataContext {
  totalIncome: Decimal;
  totalExpenses: Decimal;
  totalOutstanding: Decimal;
  memberCount: number;
  transactionCount: number;
  collectionRate: number;
  topCategories: {
    name: string;
    type: string;
    amount: Decimal;
  }[];
  recentTransactions: {
    date: Date;
    description: string;
    amount: Decimal;
    status: string;
  }[];
  overdueMembers: {
    name: string;
    amount: Decimal;
    daysOverdue: number;
  }[];
}

// ============================================
// DOCUMENT Q&A TYPES
// ============================================

export interface DocumentUploadRequest {
  filename: string;
  content: string;
  documentType: 'constitution' | 'bylaw' | 'policy' | 'minutes' | 'other';
  metadata?: Record<string, any>;
}

export interface DocumentChunk {
  id: string;
  content: string;
  documentType: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

export interface DocumentQueryRequest {
  question: string;
  documentTypes?: string[];
  maxResults?: number;
}

export interface DocumentQueryResponse {
  answer: string;
  sources: {
    documentType: string;
    excerpt: string;
    relevanceScore: number;
  }[];
  confidence: 'high' | 'medium' | 'low';
  tokensUsed: {
    input: number;
    output: number;
  };
}

// ============================================
// SMART REMINDERS TYPES
// ============================================

export interface ReminderSuggestion {
  memberId: number;
  memberName: string;
  outstandingAmount: Decimal;
  daysOverdue: number;
  suggestedTiming: Date;
  suggestedTone: 'friendly' | 'formal' | 'urgent';
  suggestedMessage: string;
  reasoning: string;
  confidence: number;
  /** The charges to remind them about, so the officer can send exactly those. */
  transactionIds?: number[];
}

export interface ReminderSuggestionsRequest {
  limit?: number;
  minDaysOverdue?: number;
  maxDaysOverdue?: number;
}

export interface ReminderSuggestionsResponse {
  suggestions: ReminderSuggestion[];
  totalOwingMembers: number;
  totalOutstanding: Decimal;
  generatedAt: Date;
}

// ============================================
// REPORT GENERATION TYPES
// ============================================

export interface AIReportRequest {
  reportType: 'monthly_summary' | 'quarterly_review' | 'annual_report' | 'treasurer_handover';
  period?: {
    startDate: Date;
    endDate: Date;
  };
  includeRecommendations?: boolean;
}

export interface AIReportResponse {
  title: string;
  summary: string;
  sections: {
    heading: string;
    content: string;
  }[];
  highlights: string[];
  recommendations?: string[];
  generatedAt: Date;
  tokensUsed: {
    input: number;
    output: number;
  };
}

// ============================================
// NATURAL LANGUAGE QUERY TYPES
// ============================================

export interface NLQueryRequest {
  query: string;
}

export interface NLQueryResponse {
  interpretation: string;
  results: any[];
  explanation: string;
  queryType: 'member' | 'transaction' | 'financial' | 'report';
  tokensUsed: {
    input: number;
    output: number;
  };
}

// ============================================
// AI AUDIT LOG TYPES
// ============================================

export interface AIAuditLogEntry {
  id: number;
  associationId: number;
  userId: number;
  promptType: string;
  modelUsed: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: Decimal;
  outputSummary: string;
  status: 'success' | 'error' | 'rate_limited';
  errorMessage?: string;
  createdAt: Date;
}

export interface AIUsageStats {
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCostUsd: Decimal;
  requestsByType: Record<string, number>;
  requestsByModel: Record<string, number>;
  dailyUsage: {
    date: string;
    requests: number;
    tokens: number;
  }[];
}

// ============================================
// RATE LIMITING TYPES
// ============================================

export interface RateLimitConfig {
  requestsPerDay: number;
  tokensPerDay: number;
}

export interface RateLimitStatus {
  requestsUsed: number;
  requestsRemaining: number;
  tokensUsed: number;
  tokensRemaining: number;
  resetsAt: Date;
  isLimited: boolean;
}

// ============================================
// AI SAFETY TYPES
// ============================================

export interface SafetyCheckResult {
  isSafe: boolean;
  violations: string[];
  sanitizedOutput?: string;
}

export interface AIValidationError {
  code: string;
  message: string;
  field?: string;
}
