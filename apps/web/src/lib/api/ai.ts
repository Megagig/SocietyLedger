import api from '../axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ============================================
// AI API TYPES
// ============================================

export interface AIStatus {
  available: boolean;
  rateLimit: RateLimitStatus;
}

export interface RateLimitStatus {
  requestsUsed: number;
  requestsRemaining: number;
  tokensUsed: number;
  tokensRemaining: number;
  resetsAt: string;
  isLimited: boolean;
}

export interface FinancialQueryRequest {
  question: string;
  context?: {
    memberId?: number;
    categoryId?: number;
    dateRange?: {
      startDate: string;
      endDate: string;
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

export interface ReminderSuggestion {
  memberId: number;
  memberName: string;
  outstandingAmount: string;
  daysOverdue: number;
  suggestedTiming: string;
  suggestedTone: 'friendly' | 'formal' | 'urgent';
  suggestedMessage: string;
  reasoning: string;
  confidence: number;
}

export interface ReminderSuggestionsResponse {
  suggestions: ReminderSuggestion[];
  totalOwingMembers: number;
  totalOutstanding: string;
  generatedAt: string;
}

export interface AIReportRequest {
  reportType: 'monthly_summary' | 'quarterly_review' | 'annual_report' | 'treasurer_handover';
  period?: {
    startDate: string;
    endDate: string;
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
  generatedAt: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

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

export interface AIUsageStats {
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCostUsd: string;
  requestsByType: Record<string, number>;
  requestsByModel: Record<string, number>;
  dailyUsage: {
    date: string;
    requests: number;
    tokens: number;
  }[];
}

export interface AIChatRequest {
  message: string;
  feature: 'financial' | 'document_qa' | 'general';
}

export interface AIChatResponse {
  response: string;
  tokensUsed: {
    input: number;
    output: number;
  };
}

// ============================================
// AI API CLIENT
// ============================================

export const aiApi = {
  /**
   * Check AI service status
   */
  async getStatus(): Promise<{ success: boolean; data: AIStatus }> {
    const response = await api.get(`${API_URL}/api/ai/status`);
    return response.data;
  },

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<{ success: boolean; data: RateLimitStatus }> {
    const response = await api.get(`${API_URL}/api/ai/rate-limit`);
    return response.data;
  },

  /**
   * Ask financial question
   */
  async askFinancialQuestion(request: FinancialQueryRequest): Promise<{ success: boolean; data: FinancialQueryResponse }> {
    const response = await api.post(`${API_URL}/api/ai/financial/ask`, request);
    return response.data;
  },

  /**
   * Get reminder suggestions
   */
  async getReminderSuggestions(params?: {
    limit?: number;
    minDaysOverdue?: number;
    maxDaysOverdue?: number;
  }): Promise<{ success: boolean; data: ReminderSuggestionsResponse }> {
    const response = await api.get(`${API_URL}/api/ai/reminders/suggestions`, { params });
    return response.data;
  },

  /**
   * Generate AI report
   */
  async generateReport(request: AIReportRequest): Promise<{ success: boolean; data: AIReportResponse }> {
    const response = await api.post(`${API_URL}/api/ai/reports/generate`, request);
    return response.data;
  },

  /**
   * Execute natural language query
   */
  async executeQuery(request: NLQueryRequest): Promise<{ success: boolean; data: NLQueryResponse }> {
    const response = await api.post(`${API_URL}/api/ai/query`, request);
    return response.data;
  },

  /**
   * Get AI usage statistics
   */
  async getUsageStats(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<{ success: boolean; data: AIUsageStats }> {
    const response = await api.get(`${API_URL}/api/ai/usage`, { params });
    return response.data;
  },

  /**
   * Simple AI chat
   */
  async chat(request: AIChatRequest): Promise<{ success: boolean; data: AIChatResponse }> {
    const response = await api.post(`${API_URL}/api/ai/chat`, request);
    return response.data;
  },
};

export default aiApi;
