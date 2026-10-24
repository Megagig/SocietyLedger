import { endOfDay, startOfDay } from 'date-fns';

import type { PermissionAlias } from '@/lib/permissions';
import type { AgingBucketKey, ChargeStatusFilter, ExportFormat, RangeParams, ReportPeriod } from '@/types/api/reports';

export const REPORTS_MODULE = 'reports';

/** Reading the reports and the records behind them (`ledger.view`). */
export const REPORTS_VIEW_ACCESS: PermissionAlias = 'FINANCE_VIEW';
/** Financial files: the financial PDF and Excel (`exports.financial`). */
export const EXPORT_FINANCIAL_ACCESS: PermissionAlias = 'EXPORT_FINANCIAL';
/** Member files: the members Excel and member statements (`exports.members`). */
export const EXPORT_MEMBERS_ACCESS: PermissionAlias = 'EXPORT_MEMBERS';
/** Anything that opens Exports. */
export const EXPORT_ANY_ACCESS: PermissionAlias[] = ['EXPORT_FINANCIAL', 'EXPORT_MEMBERS', 'EXPORT_VIEW_HISTORY'];

export const PERIOD_OPTIONS: { label: string; value: ReportPeriod }[] = [
  { label: 'This month', value: 'this_month' },
  { label: 'Last month', value: 'last_month' },
  { label: 'This quarter', value: 'this_quarter' },
  { label: 'Last quarter', value: 'last_quarter' },
  { label: 'This year', value: 'this_year' },
  { label: 'Last year', value: 'last_year' },
  { label: 'Choose dates', value: 'custom' },
];

/** What the picker holds: a named period, or a custom range (as ISO moments, start of the first day to end of the last). */
export type PeriodState = { period: ReportPeriod; startDate?: string; endDate?: string };

export const defaultPeriod = (period: ReportPeriod = 'this_month'): PeriodState => ({ period });

/** The parameters a report call takes for this period. A custom period without both dates isn't ready to ask about. */
export function rangeParams(state: PeriodState): RangeParams | null {
  if (state.period !== 'custom') return { period: state.period };
  return state.startDate && state.endDate ? { period: 'custom', startDate: state.startDate, endDate: state.endDate } : null;
}

/** Start of the first day and end of the last day the officer picked, on this device's clock (Lagos for our users). */
export function customRange(start: Date, end: Date): { startDate: string; endDate: string } {
  return { startDate: startOfDay(start).toISOString(), endDate: endOfDay(end).toISOString() };
}

export const AGING_LABELS: Record<AgingBucketKey, string> = {
  notYetDue: 'Not yet due',
  current: '1–30 days late',
  days31to60: '31–60 days late',
  days61to90: '61–90 days late',
  over90: 'Over 90 days late',
};
export const AGING_ORDER: AgingBucketKey[] = ['notYetDue', 'current', 'days31to60', 'days61to90', 'over90'];

export const CHARGE_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  partial: 'Part paid',
  pending: 'Not paid yet',
  overdue: 'Overdue',
  waived: 'Waived',
  voided: 'Voided',
};
export const STATUS_FILTER_ORDER: ChargeStatusFilter[] = ['paid', 'partial', 'pending', 'overdue', 'waived'];

/** The shared status chip looks tones up by this key (ui-tokens.md §1.4). */
export const chargeStatusKey = (status: string): string => (status === 'voided' ? 'cancelled' : status);

export const CATEGORY_TYPE_LABELS: Record<string, string> = { due: 'Dues', levy: 'Levies', donation: 'Donations', penalty: 'Penalties' };

export const EXPORT_TYPE_LABELS: Record<string, string> = {
  accounting_income: 'Income statement',
  accounting_balance: 'Balance sheet',
  accounting_cash: 'Cash flow',
  financial_summary: 'Financial summary',
  member_statement: 'Member statement',
  all_members: 'All members',
  custom_members: 'Custom members',
  custom_report: 'Custom report',
};
export const exportTypeLabel = (type: string): string => EXPORT_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export const FORMAT_LABELS: Record<ExportFormat, string> = { pdf: 'PDF', excel: 'Excel' };

export const MEMBER_FILTER_OPTIONS = [
  { label: 'All members', value: 'all' as const },
  { label: 'Owe money', value: 'with_balance' as const },
  { label: 'Overdue', value: 'overdue' as const },
];

/** "12.5%" — one decimal at most, and no ".0". */
export function percentLabel(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

/** "3.2 MB", "840 KB". */
export function fileSizeLabel(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Whether a file's 7 days are up. */
export function isExpired(expiresAt: string, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** A name that is safe to save on the phone: letters, numbers, dashes, dots. */
export function safeFilename(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/\.{2,}/g, '.').replace(/^[._]+/, '');
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'export';
}

export const MIME_BY_FORMAT: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
