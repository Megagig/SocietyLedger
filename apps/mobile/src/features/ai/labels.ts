import { ApiError } from '@/api/errors';
import { formatMoney } from '@/lib/money';
import type { PermissionAlias } from '@/lib/permissions';
import type { AiKind, AiPeriod, AiReportType, AiStatusDTO, ReminderTone } from '@/types/api/ai';

export const AI_MODULE = 'ai';
/** Asking, and reading what is left: the same access as the finance screens. */
export const AI_VIEW_ACCESS: PermissionAlias = 'FINANCE_VIEW';
/** Writing a report: the API asks for the reports permission on top of finance access. */
export const AI_REPORT_ACCESS: PermissionAlias = 'REPORT_VIEW';
/** Buying credits spends the association's money. */
export const AI_BUY_ACCESS: PermissionAlias[] = ['FINANCE_APPROVE', 'SETTINGS_BILLING'];
/** Sending the reminders the assistant wrote. */
export const AI_SEND_ACCESS: PermissionAlias = 'LEDGER_EDIT';

export const SUGGESTED_PROMPTS = [
  'How much did we collect this month?',
  'Who owes the most?',
  'How much have we spent, and on what?',
  'How are we doing compared with last month?',
];

export const PERIOD_OPTIONS: { label: string; value: AiPeriod }[] = [
  { label: 'This month', value: 'this_month' },
  { label: 'Last month', value: 'last_month' },
  { label: 'This quarter', value: 'this_quarter' },
  { label: 'Last quarter', value: 'last_quarter' },
  { label: 'This year', value: 'this_year' },
  { label: 'Last year', value: 'last_year' },
];

export const REPORT_TYPE_OPTIONS: { label: string; value: AiReportType; description: string }[] = [
  { label: 'Monthly summary', value: 'monthly_summary', description: 'This month: money in, money out and who still owes' },
  { label: 'Quarterly review', value: 'quarterly_review', description: 'How the quarter went and what to do next' },
  { label: 'Annual report', value: 'annual_report', description: 'The year in review, for the annual general meeting' },
  { label: 'Treasurer handover', value: 'treasurer_handover', description: 'Where things stand, for the next treasurer' },
];

export const TONE_LABELS: Record<ReminderTone, string> = { friendly: 'Friendly', formal: 'Formal', urgent: 'Urgent' };

/** "7 left today · 80 credits". Credits are left out when there are none, the allowance when the plan has none. */
export function allowanceLine(status: Pick<AiStatusDTO, 'allowanceLeft' | 'credits' | 'allowancePerDay'>): string {
  const parts: string[] = [];
  if (status.allowancePerDay > 0 || status.allowanceLeft > 0) parts.push(`${status.allowanceLeft} left today`);
  if (status.credits > 0 || parts.length === 0) parts.push(`${status.credits} ${status.credits === 1 ? 'credit' : 'credits'}`);
  return parts.join(' · ');
}

/** Requests still available today: the free ones and the bought ones. */
export function requestsLeft(status: Pick<AiStatusDTO, 'allowanceLeft' | 'credits'>): number {
  return status.allowanceLeft + status.credits;
}

/** Whether this kind of work can be paid for right now. */
export function canAfford(status: Pick<AiStatusDTO, 'allowanceLeft' | 'credits' | 'weights'>, kind: AiKind): boolean {
  return requestsLeft(status) >= status.weights[kind];
}

/** What a piece of work costs, in words ("1 request", "5 requests"). */
export function costWords(units: number): string {
  return `${units} ${units === 1 ? 'request' : 'requests'}`;
}

/** What a number of credits comes to, in full. */
export function priceOf(credits: number, status: Pick<AiStatusDTO, 'creditPriceNaira'>): string {
  return formatMoney(credits * status.creditPriceNaira);
}

const PACK_MULTIPLES = [1, 2, 4, 10] as const;

/** The packs on offer: the smallest allowed purchase, then bigger ones. */
export function packsFor(status: Pick<AiStatusDTO, 'minimumCredits'>): number[] {
  const base = Math.max(1, status.minimumCredits);
  return PACK_MULTIPLES.map((m) => base * m);
}

/** Why a request did not go through, in plain words, from what the server said. */
export function aiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'AI_ALLOWANCE_EXHAUSTED') return 'You have used all of today’s free requests and have no credits left. Buy credits to carry on.';
    if (error.code === 'AI_DISABLED') return 'The assistant is switched off right now. Try again later.';
    if (error.isNetwork || error.isTimeout) return error.message;
    if (error.status === 503) return 'The assistant could not be reached. Nothing was used. Try again in a moment.';
    if (error.status === 403) return 'You do not have permission to do that.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong. Nothing was used.';
}

/** True when the failure is the officer running out, so the screen can offer to buy credits. */
export function isOutOfRequests(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'AI_ALLOWANCE_EXHAUSTED';
}
