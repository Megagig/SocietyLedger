// ============================================
// PHASE 17: AI INTEGRATION SERVICE
// Read-only AI assistant with comprehensive audit logging
// ============================================

import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import openRouterClient, {
  buildFinancialSystemPrompt,
  buildDocumentQASystemPrompt,
  buildReminderSystemPrompt,
} from '../../lib/openrouter';
import {
  FinancialQueryRequest,
  FinancialQueryResponse,
  FinancialDataContext,
  DocumentQueryRequest,
  DocumentQueryResponse,
  ReminderSuggestionsRequest,
  ReminderSuggestionsResponse,
  ReminderSuggestion,
  AIReportRequest,
  AIReportResponse,
  NLQueryRequest,
  NLQueryResponse,
  AIUsageStats,
  RateLimitStatus,
} from './ai.types';
import { aiCredits } from './ai-credits.service';
import { loadMemberNames } from './ai-context';
import { Pseudonymizer, sanitizeForModel } from './ai-privacy';
import { validateAIOutput } from './tools/safety-guards';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format currency in Nigerian Naira
 */
function formatNaira(amount: Decimal | number): string {
  const num = typeof amount === 'number' ? amount : amount.toNumber();
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get date range for period
 */
function getDateRangeForPeriod(period?: { startDate: Date; endDate: Date }): { startDate: Date; endDate: Date } {
  if (period) {
    return period;
  }
  // Default to current month
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { startDate, endDate };
}

/** A result row without anything that says who a person is: names, emails, phones and addresses. */
function stripPersonal(row: unknown): unknown {
  if (Array.isArray(row)) return row.map(stripPersonal);
  if (!row || typeof row !== 'object') return row;
  return Object.fromEntries(
    Object.entries(row as Record<string, unknown>)
      .filter(([key]) => !/name|email|phone|address|contact|whatsapp/i.test(key))
      .map(([key, value]) => [key, stripPersonal(value)]),
  );
}

// ============================================
// AI SERVICE
// ============================================

export const aiService = {
  /**
   * Check if AI is available (OpenRouter configured)
   */
  isAvailable(): boolean {
    return openRouterClient.isConfigured();
  },

  /**
   * Get rate limit status for association
   */
  async getRateLimitStatus(associationId: number): Promise<RateLimitStatus> {
    return aiCredits.getStatus(associationId);
  },

  /**
   * TASK-AI-007: Natural Language Query Interface
   * Convert natural language to safe, read-only queries (READ-ONLY)
   */
  async executeNaturalLanguageQuery(
    associationId: number,
    userId: number,
    request: NLQueryRequest
  ): Promise<NLQueryResponse> {
    return aiCredits.charged(associationId, userId, 'question', 'natural_language_query', async (_hold, settings) => {
      // The query itself runs on the server against this association's own records; only a description of the result goes to the model
      const queryType = this.classifyQuery(request.query);

      let results: any[] = [];
      let interpretation = '';

      switch (queryType) {
        case 'member': {
          const memberResult = await this.executeReadOnlyMemberQuery(associationId, request.query);
          results = memberResult.results;
          interpretation = memberResult.interpretation;
          break;
        }
        case 'transaction': {
          const txnResult = await this.executeReadOnlyTransactionQuery(associationId, request.query);
          results = txnResult.results;
          interpretation = txnResult.interpretation;
          break;
        }
        case 'financial': {
          const finResult = await this.executeReadOnlyFinancialQuery(associationId, request.query);
          results = finResult.results;
          interpretation = finResult.interpretation;
          break;
        }
        default:
          interpretation = 'General query';
          results = [];
      }

      // Names, phones and emails never go to the model: the question and the rows are made safe first
      const members = await loadMemberNames(associationId);
      const pseudo = new Pseudonymizer();
      const question = sanitizeForModel(request.query, members, pseudo).text;
      const safeRows = results.slice(0, 5).map((row) => stripPersonal(row));

      const explanationPrompt = `
The user asked: "${question}"

Query type: ${queryType}
Results found: ${results.length}

${safeRows.length > 0 ? `Sample results (personal details removed):\n${JSON.stringify(safeRows, null, 2)}` : 'No results found.'}

Please provide a brief, helpful explanation of these results in plain English. Use Nigerian Naira (₦) for any amounts.
`;

      const response = await openRouterClient.chat(
        [
          { role: 'system', content: 'You are a helpful assistant explaining database query results. Be concise and clear. You never see people\'s names, so never guess or invent any.' },
          { role: 'user', content: explanationPrompt },
        ],
        { model: settings.model, maxTokens: Math.min(500, settings.maxOutputTokens), temperature: 0.3 }
      );

      const safeExplanation = pseudo.restore(validateAIOutput(response.content, { type: 'nl_query', associationId }));

      return {
        value: {
          interpretation,
          results: results.slice(0, 50), // Limit results
          explanation: safeExplanation,
          queryType,
          tokensUsed: { input: response.tokensUsed.input, output: response.tokensUsed.output },
        },
        usage: { modelUsed: response.model, tokensInput: response.tokensUsed.input, tokensOutput: response.tokensUsed.output, costUsd: response.costUsd, outputSummary: `Query asked (${results.length} results)` },
      };
    });
  },

  /**
   * Classify natural language query type
   */
  classifyQuery(query: string): 'member' | 'transaction' | 'financial' | 'report' {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('member') || lowerQuery.includes('who') || lowerQuery.includes('joined')) {
      return 'member';
    }
    if (lowerQuery.includes('transaction') || lowerQuery.includes('payment') || lowerQuery.includes('paid')) {
      return 'transaction';
    }
    if (lowerQuery.includes('balance') || lowerQuery.includes('income') || lowerQuery.includes('expense') || lowerQuery.includes('total')) {
      return 'financial';
    }
    return 'financial'; // Default to financial
  },

  /**
   * Execute read-only member query
   */
  async executeReadOnlyMemberQuery(
    associationId: number,
    query: string
  ): Promise<{ results: any[]; interpretation: string }> {
    const lowerQuery = query.toLowerCase();
    let interpretation = 'Searching members';
    let whereClause: any = { associationId };

    // Parse common patterns
    if (lowerQuery.includes('active')) {
      whereClause.status = 'active';
      interpretation = 'Finding active members';
    } else if (lowerQuery.includes('inactive')) {
      whereClause.status = 'inactive';
      interpretation = 'Finding inactive members';
    }

    // Year filter
    const yearMatch = lowerQuery.match(/(\d{4})/);
    if (yearMatch && lowerQuery.includes('joined')) {
      const year = parseInt(yearMatch[1]);
      whereClause.joinDate = {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      };
      interpretation = `Finding members who joined in ${year}`;
    }

    const members = await prisma.member.findMany({
      where: whereClause,
      select: {
        id: true,
        memberId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        joinDate: true,
        category: true,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return {
      results: members,
      interpretation,
    };
  },

  /**
   * Execute read-only transaction query
   */
  async executeReadOnlyTransactionQuery(
    associationId: number,
    query: string
  ): Promise<{ results: any[]; interpretation: string }> {
    const lowerQuery = query.toLowerCase();
    let interpretation = 'Searching transactions';
    let whereClause: any = { associationId };

    // Status filters
    if (lowerQuery.includes('paid')) {
      whereClause.status = 'paid';
      interpretation = 'Finding paid transactions';
    } else if (lowerQuery.includes('pending')) {
      whereClause.status = 'pending';
      interpretation = 'Finding pending transactions';
    } else if (lowerQuery.includes('overdue')) {
      whereClause.status = 'overdue';
      interpretation = 'Finding overdue transactions';
    }

    // Time filters
    if (lowerQuery.includes('this month')) {
      const now = new Date();
      whereClause.createdAt = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
      };
      interpretation += ' from this month';
    } else if (lowerQuery.includes('last month')) {
      const now = new Date();
      whereClause.createdAt = {
        gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        lt: new Date(now.getFullYear(), now.getMonth(), 1),
      };
      interpretation += ' from last month';
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      select: {
        id: true,
        referenceNumber: true,
        amount: true,
        status: true,
        notes: true,
        createdAt: true,
        dueDate: true,
        member: {
          select: { firstName: true, lastName: true },
        },
        category: {
          select: { name: true, type: true },
        },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return {
      results: transactions.map(t => ({
        ...t,
        description: t.notes,
        memberName: `${t.member.firstName} ${t.member.lastName}`,
        categoryName: t.category.name,
      })),
      interpretation,
    };
  },

  /**
   * Execute read-only financial query
   */
  async executeReadOnlyFinancialQuery(
    associationId: number,
    query: string
  ): Promise<{ results: any[]; interpretation: string }> {
    const lowerQuery = query.toLowerCase();
    let interpretation = 'Calculating financial summary';

    // Get financial summary
    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let endDate = new Date();

    if (lowerQuery.includes('this year')) {
      startDate = new Date(now.getFullYear(), 0, 1);
      interpretation = 'Financial summary for this year';
    } else if (lowerQuery.includes('last year')) {
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      endDate = new Date(now.getFullYear() - 1, 11, 31);
      interpretation = 'Financial summary for last year';
    } else if (lowerQuery.includes('last month')) {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      interpretation = 'Financial summary for last month';
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        associationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        category: { select: { type: true } },
        payments: { select: { amountPaid: true } },
      },
    });

    let totalExpected = new Decimal(0);
    let totalCollected = new Decimal(0);

    transactions.forEach(txn => {
      totalExpected = totalExpected.plus(txn.amount);
      const collected = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
      totalCollected = totalCollected.plus(collected);
    });

    return {
      results: [{
        period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        totalExpected: totalExpected.toNumber(),
        totalCollected: totalCollected.toNumber(),
        outstanding: totalExpected.minus(totalCollected).toNumber(),
        collectionRate: totalExpected.isZero() ? 100 : totalCollected.dividedBy(totalExpected).times(100).toNumber(),
        transactionCount: transactions.length,
      }],
      interpretation,
    };
  },

  /**
   * TASK-AI-010: Log AI request for audit
   */
  async logAIRequest(data: {
    associationId: number;
    userId: number;
    promptType: string;
    modelUsed: string;
    tokensInput: number;
    tokensOutput: number;
    costUsd: number;
    outputSummary: string;
    status: 'success' | 'error' | 'rate_limited';
    errorMessage?: string;
  }): Promise<void> {
    try {
      await prisma.aIAuditLog.create({
        data: {
          associationId: data.associationId,
          userId: data.userId,
          promptType: data.promptType,
          modelUsed: data.modelUsed,
          tokensInput: data.tokensInput,
          tokensOutput: data.tokensOutput,
          costUsd: new Decimal(data.costUsd),
          outputSummary: data.outputSummary,
          status: data.status,
          errorMessage: data.errorMessage,
        },
      });
    } catch (error) {
      console.error('Failed to log AI request:', error);
      // Don't throw - logging failure shouldn't break the main flow
    }
  },

  /**
   * TASK-AI-012: Get AI usage statistics
   */
  async getUsageStats(
    associationId: number,
    options: { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' }
  ): Promise<AIUsageStats> {
    const startDate = options.startDate ? new Date(options.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate ? new Date(options.endDate) : new Date();

    const logs = await prisma.aIAuditLog.findMany({
      where: {
        associationId,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate totals
    let totalTokensInput = 0;
    let totalTokensOutput = 0;
    let totalCostUsd = new Decimal(0);
    const requestsByType: Record<string, number> = {};
    const requestsByModel: Record<string, number> = {};
    const dailyUsage: Record<string, { requests: number; tokens: number }> = {};

    logs.forEach(log => {
      totalTokensInput += log.tokensInput;
      totalTokensOutput += log.tokensOutput;
      totalCostUsd = totalCostUsd.plus(log.costUsd);

      // By type
      requestsByType[log.promptType] = (requestsByType[log.promptType] || 0) + 1;

      // By model
      requestsByModel[log.modelUsed] = (requestsByModel[log.modelUsed] || 0) + 1;

      // Daily usage
      const dateKey = log.createdAt.toISOString().split('T')[0];
      if (!dailyUsage[dateKey]) {
        dailyUsage[dateKey] = { requests: 0, tokens: 0 };
      }
      dailyUsage[dateKey].requests++;
      dailyUsage[dateKey].tokens += log.tokensInput + log.tokensOutput;
    });

    return {
      totalRequests: logs.length,
      totalTokensInput,
      totalTokensOutput,
      totalCostUsd,
      requestsByType,
      requestsByModel,
      dailyUsage: Object.entries(dailyUsage).map(([date, data]) => ({
        date,
        requests: data.requests,
        tokens: data.tokens,
      })),
    };
  },

  /**
   * Simple AI chat for general questions
   */
  async chat(
    associationId: number,
    userId: number,
    message: string,
    feature: 'financial' | 'document_qa' | 'general'
  ): Promise<{ response: string; tokensUsed: { input: number; output: number } }> {
    return aiCredits.charged(associationId, userId, 'question', `chat_${feature}`, async (_hold, settings) => {
      let systemPrompt: string;
      switch (feature) {
        case 'financial':
          systemPrompt = buildFinancialSystemPrompt();
          break;
        case 'document_qa':
          systemPrompt = buildDocumentQASystemPrompt();
          break;
        default:
          systemPrompt = 'You are a helpful assistant for SocietyLedger, a platform for managing association finances. Be helpful, accurate, and concise. Use Nigerian Naira (₦) for currency.';
      }

      const members = await loadMemberNames(associationId);
      const pseudo = new Pseudonymizer();
      const safeMessage = sanitizeForModel(message, members, pseudo).text;

      const response = await openRouterClient.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: safeMessage },
        ],
        { model: settings.model, maxTokens: settings.maxOutputTokens, temperature: 0.7 }
      );

      const safeContent = pseudo.restore(validateAIOutput(response.content, { type: 'chat', associationId }));

      return {
        value: { response: safeContent, tokensUsed: { input: response.tokensUsed.input, output: response.tokensUsed.output } },
        usage: { modelUsed: response.model, tokensInput: response.tokensUsed.input, tokensOutput: response.tokensUsed.output, costUsd: response.costUsd, outputSummary: safeContent },
      };
    });
  },
};
