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
import { aiRateLimiter } from './tools/rate-limiter';
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
    return aiRateLimiter.getStatus(associationId);
  },

  /**
   * TASK-AI-004: AI Financial Assistant
   * Answer natural language questions about financial data (READ-ONLY)
   */
  async askFinancialQuestion(
    associationId: number,
    userId: number,
    request: FinancialQueryRequest
  ): Promise<FinancialQueryResponse> {
    const startTime = Date.now();

    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

    // Gather financial context (READ-ONLY queries)
    const context = await this.gatherFinancialContext(associationId, request.context);

    // Build prompt with context
    const userPrompt = this.buildFinancialPrompt(request.question, context);

    // Call OpenRouter
    const response = await openRouterClient.chat(
      [
        { role: 'system', content: buildFinancialSystemPrompt() },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3 } // Lower temperature for factual responses
    );

    // Validate AI output for safety
    const safeContent = validateAIOutput(response.content, {
      type: 'financial_assistant',
      associationId,
    });

    // Log the AI request
    await this.logAIRequest({
      associationId,
      userId,
      promptType: 'financial_assistant',
      modelUsed: response.model,
      tokensInput: response.tokensUsed.input,
      tokensOutput: response.tokensUsed.output,
      costUsd: response.costUsd,
      outputSummary: safeContent.substring(0, 500),
      status: 'success',
    });

    return {
      answer: safeContent,
      dataUsed: [
        { type: 'financial_summary', summary: `Income: ${formatNaira(context.totalIncome)}, Expenses: ${formatNaira(context.totalExpenses)}` },
        { type: 'member_count', summary: `${context.memberCount} active members` },
        { type: 'collection_rate', summary: `${context.collectionRate.toFixed(1)}% collection rate` },
      ],
      confidence: this.assessConfidence(context),
      tokensUsed: {
        input: response.tokensUsed.input,
        output: response.tokensUsed.output,
      },
      processingTimeMs: Date.now() - startTime,
    };
  },

  /**
   * Gather financial context for AI (READ-ONLY)
   */
  async gatherFinancialContext(
    associationId: number,
    queryContext?: FinancialQueryRequest['context']
  ): Promise<FinancialDataContext> {
    const { startDate, endDate } = getDateRangeForPeriod(queryContext?.dateRange);

    // Get transaction summary
    const transactions = await prisma.transaction.findMany({
      where: {
        associationId,
        createdAt: { gte: startDate, lte: endDate },
        ...(queryContext?.memberId && { memberId: queryContext.memberId }),
        ...(queryContext?.categoryId && { categoryId: queryContext.categoryId }),
      },
      include: {
        category: { select: { name: true, type: true } },
        payments: { select: { amountPaid: true } },
        member: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Calculate totals
    let totalIncome = new Decimal(0);
    let totalExpenses = new Decimal(0);
    let totalExpected = new Decimal(0);
    let totalCollected = new Decimal(0);

    const categoryTotals: Record<string, { name: string; type: string; amount: Decimal }> = {};

    transactions.forEach(txn => {
      const collected = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
      totalExpected = totalExpected.plus(txn.amount);
      totalCollected = totalCollected.plus(collected);

      // Track by category
      const catKey = `${txn.category.type}-${txn.category.name}`;
      if (!categoryTotals[catKey]) {
        categoryTotals[catKey] = { name: txn.category.name, type: txn.category.type, amount: new Decimal(0) };
      }
      categoryTotals[catKey].amount = categoryTotals[catKey].amount.plus(collected);

      // Income vs expenses
      if (['due', 'levy', 'donation'].includes(txn.category.type)) {
        totalIncome = totalIncome.plus(collected);
      } else if (txn.category.type === 'penalty') {
        totalExpenses = totalExpenses.plus(collected);
      }
    });

    // Get member count
    const memberCount = await prisma.member.count({
      where: { associationId, status: 'active' },
    });

    // Get overdue members
    const overdueTransactions = await prisma.transaction.findMany({
      where: {
        associationId,
        status: 'overdue',
      },
      include: {
        member: { select: { firstName: true, lastName: true } },
        payments: { select: { amountPaid: true } },
      },
      take: 20,
    });

    const overdueMembers = overdueTransactions.map(txn => {
      const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
      const balance = new Decimal(txn.amount).minus(paid);
      const daysOverdue = txn.dueDate
        ? Math.floor((Date.now() - txn.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        name: `${txn.member.firstName} ${txn.member.lastName}`,
        amount: balance,
        daysOverdue: Math.max(0, daysOverdue),
      };
    });

    // Calculate collection rate
    const collectionRate = totalExpected.isZero()
      ? 100
      : totalCollected.dividedBy(totalExpected).times(100).toNumber();

    return {
      totalIncome,
      totalExpenses,
      totalOutstanding: totalExpected.minus(totalCollected),
      memberCount,
      transactionCount: transactions.length,
      collectionRate,
      topCategories: Object.values(categoryTotals)
        .sort((a, b) => b.amount.comparedTo(a.amount))
        .slice(0, 5),
      recentTransactions: transactions.slice(0, 10).map(txn => ({
        date: txn.createdAt,
        description: txn.notes || txn.category.name,
        amount: new Decimal(txn.amount),
        status: txn.status,
      })),
      overdueMembers,
    };
  },

  /**
   * Build financial prompt with context
   */
  buildFinancialPrompt(question: string, context: FinancialDataContext): string {
    return `
Here is the current financial data for this association:

SUMMARY:
- Total Income Collected: ${formatNaira(context.totalIncome)}
- Total Expenses: ${formatNaira(context.totalExpenses)}
- Outstanding Balance: ${formatNaira(context.totalOutstanding)}
- Active Members: ${context.memberCount}
- Collection Rate: ${context.collectionRate.toFixed(1)}%

TOP CATEGORIES BY COLLECTION:
${context.topCategories.map(c => `- ${c.name} (${c.type}): ${formatNaira(c.amount)}`).join('\n')}

RECENT TRANSACTIONS:
${context.recentTransactions.map(t => `- ${t.date.toLocaleDateString()}: ${t.description} - ${formatNaira(t.amount)} (${t.status})`).join('\n')}

OVERDUE MEMBERS (${context.overdueMembers.length} total):
${context.overdueMembers.slice(0, 5).map(m => `- ${m.name}: ${formatNaira(m.amount)} (${m.daysOverdue} days overdue)`).join('\n')}

USER QUESTION: ${question}

Please answer the question based ONLY on the data provided above. Use Nigerian Naira (₦) for all amounts. Do not calculate or infer any amounts not shown in the data.
`.trim();
  },

  /**
   * Assess confidence based on data quality
   */
  assessConfidence(context: FinancialDataContext): 'high' | 'medium' | 'low' {
    if (context.transactionCount >= 50 && context.memberCount >= 10) {
      return 'high';
    }
    if (context.transactionCount >= 10 && context.memberCount >= 5) {
      return 'medium';
    }
    return 'low';
  },


  /**
   * TASK-AI-006: Smart Reminders & Compliance Nudges
   * Generate AI-powered reminder suggestions (READ-ONLY)
   */
  async getReminderSuggestions(
    associationId: number,
    userId: number,
    request: ReminderSuggestionsRequest
  ): Promise<ReminderSuggestionsResponse> {
    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

    const limit = request.limit || 10;
    const minDaysOverdue = request.minDaysOverdue || 1;
    const maxDaysOverdue = request.maxDaysOverdue;

    // Get members with outstanding balances (READ-ONLY)
    const overdueTransactions = await prisma.transaction.findMany({
      where: {
        associationId,
        status: { in: ['overdue', 'pending', 'partial'] },
        dueDate: {
          lt: new Date(Date.now() - minDaysOverdue * 24 * 60 * 60 * 1000),
          ...(maxDaysOverdue && {
            gte: new Date(Date.now() - maxDaysOverdue * 24 * 60 * 60 * 1000),
          }),
        },
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        payments: { select: { amountPaid: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Group by member and calculate totals
    const memberBalances: Record<number, {
      memberId: number;
      memberName: string;
      phone: string | null;
      email: string | null;
      totalOwed: Decimal;
      oldestDueDate: Date;
    }> = {};

    overdueTransactions.forEach(txn => {
      const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
      const balance = new Decimal(txn.amount).minus(paid);

      if (balance.greaterThan(0)) {
        if (!memberBalances[txn.member.id]) {
          memberBalances[txn.member.id] = {
            memberId: txn.member.id,
            memberName: `${txn.member.firstName} ${txn.member.lastName}`,
            phone: txn.member.phone,
            email: txn.member.email,
            totalOwed: new Decimal(0),
            oldestDueDate: txn.dueDate || txn.createdAt,
          };
        }
        memberBalances[txn.member.id].totalOwed = memberBalances[txn.member.id].totalOwed.plus(balance);
        if (txn.dueDate && txn.dueDate < memberBalances[txn.member.id].oldestDueDate) {
          memberBalances[txn.member.id].oldestDueDate = txn.dueDate;
        }
      }
    });

    const owingMembers = Object.values(memberBalances)
      .sort((a, b) => b.totalOwed.comparedTo(a.totalOwed))
      .slice(0, limit);

    // Generate AI suggestions for each member
    const suggestions: ReminderSuggestion[] = [];

    for (const member of owingMembers) {
      const daysOverdue = Math.floor(
        (Date.now() - member.oldestDueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine tone based on days overdue
      let suggestedTone: 'friendly' | 'formal' | 'urgent';
      if (daysOverdue <= 30) {
        suggestedTone = 'friendly';
      } else if (daysOverdue <= 60) {
        suggestedTone = 'formal';
      } else {
        suggestedTone = 'urgent';
      }

      // Generate message using AI
      const messagePrompt = `
Generate a ${suggestedTone} payment reminder message for:
- Member Name: ${member.memberName}
- Outstanding Amount: ${formatNaira(member.totalOwed)}
- Days Overdue: ${daysOverdue}

The message should be:
- Respectful and culturally appropriate for Nigerian associations
- Clear about the amount owed
- Include a call to action
- Be concise (under 160 characters for SMS compatibility)

Return ONLY the message text, nothing else.
`;

      try {
        const response = await openRouterClient.chat(
          [
            { role: 'system', content: buildReminderSystemPrompt() },
            { role: 'user', content: messagePrompt },
          ],
          { temperature: 0.7, maxTokens: 200 }
        );

        const safeMessage = validateAIOutput(response.content, {
          type: 'reminder_suggestion',
          associationId,
        });

        suggestions.push({
          memberId: member.memberId,
          memberName: member.memberName,
          outstandingAmount: member.totalOwed,
          daysOverdue,
          suggestedTiming: this.suggestReminderTiming(daysOverdue),
          suggestedTone,
          suggestedMessage: safeMessage.trim(),
          reasoning: `Member has ${formatNaira(member.totalOwed)} outstanding for ${daysOverdue} days. ${suggestedTone === 'urgent' ? 'Urgent follow-up recommended.' : suggestedTone === 'formal' ? 'Formal reminder appropriate.' : 'Friendly reminder suggested.'}`,
          confidence: daysOverdue > 7 ? 0.9 : 0.7,
        });
      } catch (error) {
        // If AI fails, use template message
        suggestions.push({
          memberId: member.memberId,
          memberName: member.memberName,
          outstandingAmount: member.totalOwed,
          daysOverdue,
          suggestedTiming: this.suggestReminderTiming(daysOverdue),
          suggestedTone,
          suggestedMessage: `Dear ${member.memberName}, kindly note your outstanding balance of ${formatNaira(member.totalOwed)}. Please make payment at your earliest convenience. Thank you.`,
          reasoning: `Template message used. Member has ${formatNaira(member.totalOwed)} outstanding for ${daysOverdue} days.`,
          confidence: 0.5,
        });
      }
    }

    // Calculate total outstanding
    const totalOutstanding = owingMembers.reduce(
      (sum, m) => sum.plus(m.totalOwed),
      new Decimal(0)
    );

    // Log the AI request
    await this.logAIRequest({
      associationId,
      userId,
      promptType: 'reminder_suggestions',
      modelUsed: 'openai/gpt-4-turbo-preview',
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
      outputSummary: `Generated ${suggestions.length} reminder suggestions`,
      status: 'success',
    });

    return {
      suggestions,
      totalOwingMembers: Object.keys(memberBalances).length,
      totalOutstanding,
      generatedAt: new Date(),
    };
  },

  /**
   * Suggest optimal reminder timing
   */
  suggestReminderTiming(daysOverdue: number): Date {
    const now = new Date();
    // Suggest sending during business hours (10 AM)
    const suggestedDate = new Date(now);
    suggestedDate.setHours(10, 0, 0, 0);

    // If already past 10 AM, suggest tomorrow
    if (now.getHours() >= 10) {
      suggestedDate.setDate(suggestedDate.getDate() + 1);
    }

    // Skip weekends
    while (suggestedDate.getDay() === 0 || suggestedDate.getDay() === 6) {
      suggestedDate.setDate(suggestedDate.getDate() + 1);
    }

    return suggestedDate;
  },

  /**
   * TASK-AI-005: Automated Report Generation
   * Generate AI-powered financial reports (READ-ONLY)
   */
  async generateAIReport(
    associationId: number,
    userId: number,
    request: AIReportRequest
  ): Promise<AIReportResponse> {
    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

    const { startDate, endDate } = getDateRangeForPeriod(request.period);

    // Gather comprehensive financial data (READ-ONLY)
    const context = await this.gatherFinancialContext(associationId, {
      dateRange: { startDate, endDate },
    });

    // Get association info
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      select: { name: true },
    });

    // Build report prompt based on type
    const reportPrompt = this.buildReportPrompt(request.reportType, context, association?.name || 'Association', {
      startDate,
      endDate,
      includeRecommendations: request.includeRecommendations,
    });

    // Generate report using AI
    const response = await openRouterClient.chat(
      [
        { role: 'system', content: this.getReportSystemPrompt(request.reportType) },
        { role: 'user', content: reportPrompt },
      ],
      { temperature: 0.4, maxTokens: 3000 }
    );

    // Validate and parse AI output
    const safeContent = validateAIOutput(response.content, {
      type: 'report_generation',
      associationId,
    });

    // Parse the structured response
    const parsedReport = this.parseReportResponse(safeContent, request.reportType);

    // Log the AI request
    await this.logAIRequest({
      associationId,
      userId,
      promptType: `report_${request.reportType}`,
      modelUsed: response.model,
      tokensInput: response.tokensUsed.input,
      tokensOutput: response.tokensUsed.output,
      costUsd: response.costUsd,
      outputSummary: parsedReport.summary.substring(0, 500),
      status: 'success',
    });

    return {
      ...parsedReport,
      tokensUsed: {
        input: response.tokensUsed.input,
        output: response.tokensUsed.output,
      },
    };
  },

  /**
   * Get system prompt for report type
   */
  getReportSystemPrompt(reportType: string): string {
    const basePrompt = `You are a professional financial report writer for SocietyLedger, a platform for African association management.

CRITICAL RULES:
1. You ONLY summarize and explain data that is provided to you
2. You NEVER perform calculations - all numbers must come from the provided data
3. You NEVER make up or infer data that wasn't provided
4. Use Nigerian Naira (₦) for all currency amounts
5. Be professional, clear, and concise

Your reports should be:
- Well-structured with clear sections
- Easy to understand for non-financial readers
- Actionable with clear insights`;

    const typeSpecific: Record<string, string> = {
      monthly_summary: `\n\nYou are generating a MONTHLY FINANCIAL SUMMARY. Focus on:
- Key financial highlights
- Income vs expenses comparison
- Collection performance
- Notable trends`,
      quarterly_review: `\n\nYou are generating a QUARTERLY REVIEW. Focus on:
- Quarter-over-quarter trends
- Major achievements and challenges
- Strategic recommendations
- Member engagement metrics`,
      annual_report: `\n\nYou are generating an ANNUAL REPORT. Focus on:
- Year-in-review highlights
- Financial health assessment
- Membership growth
- Future outlook and recommendations`,
      treasurer_handover: `\n\nYou are generating a TREASURER HANDOVER REPORT. Focus on:
- Current financial position
- Outstanding obligations
- Pending matters requiring attention
- Recommendations for incoming treasurer`,
    };

    return basePrompt + (typeSpecific[reportType] || '');
  },

  /**
   * Build report prompt with data
   */
  buildReportPrompt(
    reportType: string,
    context: FinancialDataContext,
    associationName: string,
    options: { startDate: Date; endDate: Date; includeRecommendations?: boolean }
  ): string {
    const periodLabel = `${options.startDate.toLocaleDateString()} to ${options.endDate.toLocaleDateString()}`;

    return `
Generate a ${reportType.replace('_', ' ')} for ${associationName}.

PERIOD: ${periodLabel}

FINANCIAL DATA:
- Total Income: ${formatNaira(context.totalIncome)}
- Total Expenses: ${formatNaira(context.totalExpenses)}
- Net Position: ${formatNaira(context.totalIncome.minus(context.totalExpenses))}
- Outstanding Balance: ${formatNaira(context.totalOutstanding)}
- Collection Rate: ${context.collectionRate.toFixed(1)}%

MEMBERSHIP:
- Active Members: ${context.memberCount}
- Members with Overdue Payments: ${context.overdueMembers.length}

TOP INCOME CATEGORIES:
${context.topCategories.map(c => `- ${c.name}: ${formatNaira(c.amount)}`).join('\n')}

OVERDUE SUMMARY:
${context.overdueMembers.slice(0, 5).map(m => `- ${m.name}: ${formatNaira(m.amount)} (${m.daysOverdue} days)`).join('\n')}

Please generate a structured report with:
1. TITLE (appropriate for the report type)
2. EXECUTIVE SUMMARY (2-3 sentences)
3. SECTIONS (3-5 sections with headings and content)
4. KEY HIGHLIGHTS (3-5 bullet points)
${options.includeRecommendations ? '5. RECOMMENDATIONS (3-5 actionable items)' : ''}

Format your response as:
TITLE: [title]
SUMMARY: [summary]
SECTION: [heading]
[content]
SECTION: [heading]
[content]
HIGHLIGHTS:
- [highlight 1]
- [highlight 2]
${options.includeRecommendations ? 'RECOMMENDATIONS:\n- [recommendation 1]\n- [recommendation 2]' : ''}
`.trim();
  },

  /**
   * Parse AI report response into structured format
   */
  parseReportResponse(content: string, reportType: string): Omit<AIReportResponse, 'tokensUsed'> {
    const lines = content.split('\n');
    let title = `${reportType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`;
    let summary = '';
    const sections: { heading: string; content: string }[] = [];
    const highlights: string[] = [];
    const recommendations: string[] = [];

    let currentSection: { heading: string; content: string } | null = null;
    let mode: 'none' | 'section' | 'highlights' | 'recommendations' = 'none';

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('TITLE:')) {
        title = trimmedLine.replace('TITLE:', '').trim();
      } else if (trimmedLine.startsWith('SUMMARY:')) {
        summary = trimmedLine.replace('SUMMARY:', '').trim();
      } else if (trimmedLine.startsWith('SECTION:')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: trimmedLine.replace('SECTION:', '').trim(),
          content: '',
        };
        mode = 'section';
      } else if (trimmedLine === 'HIGHLIGHTS:') {
        if (currentSection) {
          sections.push(currentSection);
          currentSection = null;
        }
        mode = 'highlights';
      } else if (trimmedLine === 'RECOMMENDATIONS:') {
        mode = 'recommendations';
      } else if (trimmedLine.startsWith('- ')) {
        const item = trimmedLine.substring(2).trim();
        if (mode === 'highlights') {
          highlights.push(item);
        } else if (mode === 'recommendations') {
          recommendations.push(item);
        }
      } else if (mode === 'section' && currentSection && trimmedLine) {
        currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return {
      title,
      summary: summary || 'Financial report generated successfully.',
      sections: sections.length > 0 ? sections : [{ heading: 'Overview', content: content }],
      highlights: highlights.length > 0 ? highlights : ['Report generated successfully'],
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      generatedAt: new Date(),
    };
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
    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

    // Determine query type from natural language
    const queryType = this.classifyQuery(request.query);

    // Execute appropriate read-only query based on type
    let results: any[] = [];
    let interpretation = '';

    switch (queryType) {
      case 'member':
        const memberResult = await this.executeReadOnlyMemberQuery(associationId, request.query);
        results = memberResult.results;
        interpretation = memberResult.interpretation;
        break;

      case 'transaction':
        const txnResult = await this.executeReadOnlyTransactionQuery(associationId, request.query);
        results = txnResult.results;
        interpretation = txnResult.interpretation;
        break;

      case 'financial':
        const finResult = await this.executeReadOnlyFinancialQuery(associationId, request.query);
        results = finResult.results;
        interpretation = finResult.interpretation;
        break;

      default:
        interpretation = 'General query';
        results = [];
    }

    // Generate AI explanation of results
    const explanationPrompt = `
The user asked: "${request.query}"

Query type: ${queryType}
Interpretation: ${interpretation}
Results found: ${results.length}

${results.length > 0 ? `Sample results:\n${JSON.stringify(results.slice(0, 5), null, 2)}` : 'No results found.'}

Please provide a brief, helpful explanation of these results in plain English. Use Nigerian Naira (₦) for any amounts.
`;

    const response = await openRouterClient.chat(
      [
        { role: 'system', content: 'You are a helpful assistant explaining database query results. Be concise and clear.' },
        { role: 'user', content: explanationPrompt },
      ],
      { temperature: 0.3, maxTokens: 500 }
    );

    const safeExplanation = validateAIOutput(response.content, {
      type: 'nl_query',
      associationId,
    });

    // Log the AI request
    await this.logAIRequest({
      associationId,
      userId,
      promptType: 'natural_language_query',
      modelUsed: response.model,
      tokensInput: response.tokensUsed.input,
      tokensOutput: response.tokensUsed.output,
      costUsd: response.costUsd,
      outputSummary: `Query: ${request.query.substring(0, 100)}`,
      status: 'success',
    });

    return {
      interpretation,
      results: results.slice(0, 50), // Limit results
      explanation: safeExplanation,
      queryType,
      tokensUsed: {
        input: response.tokensUsed.input,
        output: response.tokensUsed.output,
      },
    };
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
    // Check rate limit
    await aiRateLimiter.checkLimit(associationId);

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

    const response = await openRouterClient.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      { temperature: 0.7 }
    );

    const safeContent = validateAIOutput(response.content, {
      type: 'chat',
      associationId,
    });

    // Log the request
    await this.logAIRequest({
      associationId,
      userId,
      promptType: `chat_${feature}`,
      modelUsed: response.model,
      tokensInput: response.tokensUsed.input,
      tokensOutput: response.tokensUsed.output,
      costUsd: response.costUsd,
      outputSummary: safeContent.substring(0, 500),
      status: 'success',
    });

    return {
      response: safeContent,
      tokensUsed: {
        input: response.tokensUsed.input,
        output: response.tokensUsed.output,
      },
    };
  },
};
