/**
 * The assistant officers talk to: questions about the association's money, who to remind, and a written report. Every request is paid
 * for in units first (`aiCredits.charged`) and refunded if the model fails. The model only ever sees figures the server worked out, with
 * members as stand-ins, and the officer gets the real names back.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import openRouterClient, { buildFinancialSystemPrompt } from '../../lib/openrouter';
import { chargeWhere, generateAgingAnalysis } from '../reports/reports-core.service';
import { AiCreditsError } from './ai-credits-rules';
import { aiCredits, type AiStatus } from './ai-credits.service';
import { buildFigures, loadMemberNames, naira, type AiTable } from './ai-context';
import { Pseudonymizer, sanitizeForModel } from './ai-privacy';
import { parseReport, reportSystemPrompt, reportUserPrompt } from './ai-report-format';
import type { AIReportRequest, AIReportResponse, ReminderSuggestion, ReminderSuggestionsRequest, ReminderSuggestionsResponse } from './ai.types';
import { RateLimitError } from './tools/rate-limiter';
import { validateAIOutput } from './tools/safety-guards';

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year';
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export type AssistantAnswer = {
  answer: string;
  /** The same figures with real names, for the screen to show as cards. */
  tables: AiTable[];
  dataUsed: { type: string; summary: string }[];
  confidence: 'high' | 'medium' | 'low';
  period: string;
  tokensUsed: { input: number; output: number };
  processingTimeMs: number;
  /** What this request cost, and what is left afterwards. */
  units: number;
  usage: AiStatus;
};

const EXTRA_RULES = `
ADDITIONAL RULES:
- Members appear only as "Member 1", "Member 2" and so on. Refer to them exactly like that. Never invent a name, phone number or email.
- Every number you write must be copied from the figures given. If the figures do not answer the question, say what is missing.
- Answer in a few short sentences or a short list. Money is always written in full, like ₦10,000.00.`;

const PERIODS = new Set<Period>(['this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_year']);

const FALLBACK_TEMPLATES = {
  friendly: 'Dear {name}, a friendly reminder from {association}: you have {amount} outstanding. Kindly make your payment at your earliest convenience. Thank you.',
  formal: 'Dear {name}, our records show {amount} outstanding to {association}, overdue by {days} days. Please settle it promptly. Thank you.',
  urgent: 'Dear {name}, your payment of {amount} to {association} is now {days} days overdue. Please pay immediately or contact the executives. Thank you.',
} as const;
type Tone = keyof typeof FALLBACK_TEMPLATES;

const toneFor = (days: number): Tone => (days <= 30 ? 'friendly' : days <= 60 ? 'formal' : 'urgent');

/** The next working day at 10:00 in Lagos (09:00 UTC): when a reminder is best sent. */
function nextSendTime(now: Date = new Date()): Date {
  const when = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 9, 0, 0));
  while (when.getUTCDay() === 0 || when.getUTCDay() === 6) when.setUTCDate(when.getUTCDate() + 1);
  return when;
}

/** Fills a template for one member. A template that lost a placeholder is not trusted. */
export function fillTemplate(template: string, values: { name: string; amount: string; days: number; association: string }): string {
  return template.replace(/\{name\}/g, values.name).replace(/\{amount\}/g, values.amount).replace(/\{days\}/g, String(values.days)).replace(/\{association\}/g, values.association).trim();
}

/** The three templates from the model's answer, each kept only if it still has its placeholders. The rest fall back to the built-in words. */
export function readTemplates(content: string): { templates: Record<Tone, string>; fromModel: number } {
  const templates: Record<Tone, string> = { ...FALLBACK_TEMPLATES };
  let fromModel = 0;
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) return { templates, fromModel };
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return { templates, fromModel };
  }
  for (const tone of Object.keys(FALLBACK_TEMPLATES) as Tone[]) {
    const text = typeof (parsed as Record<string, unknown>)[tone] === 'string' ? ((parsed as Record<string, string>)[tone] as string).trim() : '';
    if (text.length >= 20 && text.length <= 400 && text.includes('{name}') && text.includes('{amount}')) {
      try {
        templates[tone] = validateAIOutput(text, { type: 'reminder_suggestion', associationId: 0 });
        fromModel += 1;
      } catch {
        /* an unsafe answer is replaced by the built-in words */
      }
    }
  }
  return { templates, fromModel };
}

export const assistantService = {
  /**
   * AI1: a question about the association's money, answered from this period's figures. The conversation so far (a few turns) is sent
   * back by the phone with each question; none of it is kept here.
   */
  async ask(associationId: number, userId: number, input: { question: string; history?: ChatTurn[]; period?: string }): Promise<AssistantAnswer> {
    const startedAt = Date.now();
    const answer = await aiCredits.charged(associationId, userId, 'question', 'financial_assistant', async (hold, settings) => {
      const members = await loadMemberNames(associationId);
      const pseudo = new Pseudonymizer();

      // What the officer typed, and what was said earlier, with names turned into stand-ins and contacts removed
      const question = sanitizeForModel(input.question, members, pseudo);
      const history = (input.history ?? []).slice(-6).map((turn) => ({ role: turn.role, content: sanitizeForModel(turn.content, members, pseudo).text }));

      const figures = await buildFigures(associationId, {
        range: { period: PERIODS.has(input.period as Period) ? (input.period as Period) : 'this_month' },
        question: input.question,
        asked: question.found,
        pseudo,
      });

      const response = await openRouterClient.chat(
        [
          { role: 'system', content: buildFinancialSystemPrompt() + EXTRA_RULES },
          ...history,
          { role: 'user', content: `${figures.prompt}\n\nQUESTION: ${question.text}\n\nAnswer using ONLY the figures above.` },
        ],
        { model: settings.model, maxTokens: settings.maxOutputTokens, temperature: 0.3 },
      );
      const safe = validateAIOutput(response.content, { type: 'financial_assistant', associationId });

      return {
        value: { figures, text: pseudo.restore(safe), tokens: response.tokensUsed, units: hold.units },
        usage: { modelUsed: response.model, tokensInput: response.tokensUsed.input, tokensOutput: response.tokensUsed.output, costUsd: response.costUsd, outputSummary: safe },
      };
    });

    return {
      answer: answer.text,
      tables: answer.figures.tables,
      dataUsed: answer.figures.dataUsed,
      confidence: answer.figures.confidence,
      period: answer.figures.periodLabel,
      tokensUsed: { input: answer.tokens.input, output: answer.tokens.output },
      processingTimeMs: Date.now() - startedAt,
      units: answer.units,
      usage: await aiCredits.getStatus(associationId),
    };
  },

  /**
   * AI2: who to remind, and what to say. The members come from the same aging report as Reports (never a separate calculation). The
   * model writes three message templates with placeholders and sees no member at all; the server fills each member's own in. One
   * request, whatever the number of members. If the model fails the suggestions still come, in the built-in words, at no cost.
   */
  async reminders(associationId: number, userId: number, request: ReminderSuggestionsRequest): Promise<ReminderSuggestionsResponse & { aiWritten: boolean; usage: AiStatus; units: number }> {
    const limit = Math.min(30, Math.max(1, request.limit ?? 10));
    const minDays = request.minDaysOverdue ?? 1;
    const maxDays = request.maxDaysOverdue;

    const aging = await generateAgingAnalysis(associationId, undefined, true);
    const byMember = new Map<number, { memberId: number; name: string; amount: Decimal; days: number }>();
    for (const bucket of [aging.buckets.current, aging.buckets.days31to60, aging.buckets.days61to90, aging.buckets.over90]) {
      for (const m of bucket.members) {
        const entry = byMember.get(m.memberId) ?? { memberId: m.memberId, name: m.memberName, amount: new Decimal(0), days: 0 };
        entry.amount = entry.amount.plus(m.amount);
        entry.days = Math.max(entry.days, m.daysOverdue);
        byMember.set(m.memberId, entry);
      }
    }
    const owing = [...byMember.values()]
      .filter((m) => m.days >= minDays && (maxDays === undefined || m.days <= maxDays))
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .slice(0, limit);
    const totalOutstanding = [...byMember.values()].reduce((sum, m) => sum.plus(m.amount), new Decimal(0));

    const association = await prisma.association.findUnique({ where: { id: associationId }, select: { name: true } });
    const associationName = association?.name ?? 'the association';

    // Which charges each member is being reminded about, so the officer can send exactly those
    const charges = owing.length === 0 ? [] : await prisma.transaction.findMany({ where: { ...(chargeWhere(associationId, { scope: 'overdue' }) as object), memberId: { in: owing.map((m) => m.memberId) } } as never, select: { id: true, memberId: true } });
    const idsOf = (memberId: number) => charges.filter((c) => c.memberId === memberId).map((c) => c.id);

    let templates: Record<Tone, string> = { ...FALLBACK_TEMPLATES };
    let aiWritten = false;
    let units = 0;
    if (owing.length > 0) {
      try {
        const result = await aiCredits.charged(associationId, userId, 'reminders', 'reminder_suggestions', async (hold, settings) => {
          const response = await openRouterClient.chat(
            [
              {
                role: 'system',
                content: 'You write short payment reminder messages for Nigerian associations. You are polite, culturally appropriate and clear. You never invent facts.',
              },
              {
                role: 'user',
                content: `Write three payment-reminder text messages, one for each tone: friendly (up to 30 days overdue), formal (31 to 60 days), urgent (over 60 days).
Use these placeholders exactly where needed and nowhere else: {name} (the member), {amount} (the amount owed), {days} (days overdue), {association}.
Each message must use {name} and {amount}, be under 300 characters, end with a clear call to action, and have no emojis.
Return ONLY JSON like {"friendly":"...","formal":"...","urgent":"..."}.`,
              },
            ],
            { model: settings.model, maxTokens: Math.min(settings.maxOutputTokens, 600), temperature: 0.6 },
          );
          return {
            value: { ...readTemplates(response.content), units: hold.units },
            usage: { modelUsed: response.model, tokensInput: response.tokensUsed.input, tokensOutput: response.tokensUsed.output, costUsd: response.costUsd, outputSummary: `Wrote reminder templates for ${owing.length} members` },
          };
        });
        templates = result.templates;
        aiWritten = result.fromModel > 0;
        units = result.units;
      } catch (error) {
        // Not having credits is the officer's to fix; anything else (the model being down) must not stop the list
        if (error instanceof RateLimitError || error instanceof AiCreditsError) throw error;
      }
    }

    const suggestions: ReminderSuggestion[] = owing.map((m) => {
      const tone = toneFor(m.days);
      return {
        memberId: m.memberId,
        memberName: m.name,
        outstandingAmount: m.amount,
        daysOverdue: m.days,
        suggestedTiming: nextSendTime(),
        suggestedTone: tone,
        suggestedMessage: fillTemplate(templates[tone], { name: m.name, amount: naira(m.amount), days: m.days, association: associationName }),
        reasoning: `${m.name} owes ${naira(m.amount)}, ${m.days} ${m.days === 1 ? 'day' : 'days'} overdue. ${tone === 'urgent' ? 'Urgent follow-up recommended.' : tone === 'formal' ? 'A formal reminder is appropriate.' : 'A friendly reminder is enough.'}`,
        confidence: m.days > 7 ? 0.9 : 0.7,
        transactionIds: idsOf(m.memberId),
      };
    });

    return { suggestions, totalOwingMembers: byMember.size, totalOutstanding, generatedAt: new Date(), aiWritten, usage: await aiCredits.getStatus(associationId), units };
  },

  /** AI3: a written report for a period, from the same figures as Reports and Accounting. Costs more than a question. */
  async report(associationId: number, userId: number, request: AIReportRequest): Promise<AIReportResponse & { period: string; units: number; usage: AiStatus }> {
    const defaultPeriod: Period = request.reportType === 'quarterly_review' ? 'this_quarter' : request.reportType === 'annual_report' ? 'this_year' : 'this_month';

    const result = await aiCredits.charged(associationId, userId, 'report', `report_${request.reportType}`, async (hold, settings) => {
      const figures = await buildFigures(associationId, { range: request.period ? { startDate: request.period.startDate, endDate: request.period.endDate } : { period: defaultPeriod } });
      const association = await prisma.association.findUnique({ where: { id: associationId }, select: { name: true } });

      const response = await openRouterClient.chat(
        [
          { role: 'system', content: reportSystemPrompt(request.reportType) },
          { role: 'user', content: reportUserPrompt(request.reportType, figures.prompt, association?.name ?? 'the association', request.includeRecommendations !== false) },
        ],
        { model: settings.model, maxTokens: settings.maxOutputTokens, temperature: 0.4 },
      );
      const safe = validateAIOutput(response.content, { type: 'report_generation', associationId });
      const parsed = parseReport(figures.pseudo.restore(safe), request.reportType);

      return {
        value: { parsed, tokens: response.tokensUsed, period: figures.periodLabel, units: hold.units },
        usage: { modelUsed: response.model, tokensInput: response.tokensUsed.input, tokensOutput: response.tokensUsed.output, costUsd: response.costUsd, outputSummary: parsed.summary },
      };
    });

    return { ...result.parsed, tokensUsed: { input: result.tokens.input, output: result.tokens.output }, period: result.period, units: result.units, usage: await aiCredits.getStatus(associationId) };
  },
};
