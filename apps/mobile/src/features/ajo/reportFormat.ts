/**
 * Pure helpers for the Ajo report screens (T10): how a figure and a table cell are written, which dates a quick choice means, and how a
 * report row, which is a table row on the web, reads as a card on a phone with every column still there. No React, so they are tested alone.
 */
import type { ReportColumn, ReportMetric, ReportRow } from '@/types/api/ajoReports';
import { shortDay, formatMomentIn } from './boardFormat';
import { formatKobo } from './format';

/** A figure as the person reads it. Money is always in full (₦10,000.00). A figure that does not apply shows a dash, never a zero. */
export function formatMetric(metric: ReportMetric): string {
  if (metric.value === null || metric.value === undefined) return '—';
  if (metric.kind === 'money') return formatKobo(metric.value as string);
  if (metric.kind === 'percent') return `${((metric.value as number) / 100).toFixed(1)}%`;
  return Number(metric.value).toLocaleString('en-NG');
}

/** A table cell, empty when there is nothing to say. A day is "4 Mar 2027"; a moment is written in the circle's own clock. */
export function formatCell(column: ReportColumn, value: string | number | null | undefined, timeZone: string): string {
  if (value === null || value === undefined || value === '') return '';
  switch (column.kind) {
    case 'money':
      return formatKobo(value as string);
    case 'date': {
      const text = String(value);
      const year = text.slice(0, 4);
      return `${shortDay(text)} ${year}`.trim();
    }
    case 'datetime':
      return formatMomentIn(String(value), timeZone);
    case 'int':
      return Number(value).toLocaleString('en-NG');
    case 'percent':
      return `${(Number(value) / 100).toFixed(1)}%`;
    default:
      return String(value);
  }
}

export interface RowLine {
  label: string;
  value: string;
  /** Long free text reads better under its label than beside it. */
  stacked: boolean;
  kind: ReportColumn['kind'];
}

const STACK_KEYS = new Set(['what', 'note', 'reason']);
const STACK_LENGTH = 28;

/**
 * One report row as a card: a title, the circle when more than one is shown, and every other column as a "label: value" line. Nothing
 * the web table shows is left out; an empty cell is simply not drawn.
 */
export function describeRow(columns: ReportColumn[], row: ReportRow, timeZone: string): { title: string; circle: string; lines: RowLine[] } {
  const circle = String(row.circle ?? '');
  const titleColumn = columns.find((c) => c.kind === 'text' && c.key !== 'circle') ?? columns.find((c) => c.key !== 'circle') ?? columns[0];
  const title = titleColumn ? formatCell(titleColumn, row[titleColumn.key] ?? null, timeZone) : '';
  const lines: RowLine[] = [];
  for (const c of columns) {
    if (c.key === 'circle' || c === titleColumn) continue;
    const value = formatCell(c, row[c.key] ?? null, timeZone);
    if (!value) continue;
    lines.push({ label: c.label, value, kind: c.kind, stacked: c.kind === 'text' && (STACK_KEYS.has(c.key) || value.length > STACK_LENGTH) });
  }
  return { title, circle, lines };
}

// ── the dates a quick choice means ───────────────────────────────────────────────────────────────────────────────────────────

export type RangeChoice = 'month' | 'last-month' | 'last-3-months' | 'year';

export const RANGE_OPTIONS: { label: string; value: RangeChoice }[] = [
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'last-month' },
  { label: 'Last 3 months', value: 'last-3-months' },
  { label: 'This year', value: 'year' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (year: number, monthIndex: number, day: number) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
const lastDay = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/**
 * The first and last day a quick choice means, from the phone's calendar. "This month" returns nothing so the API applies its own
 * default (the running month in the circle's timezone), which is the same range the web opens on. The longest range is a year.
 */
export function rangeFor(choice: RangeChoice, now: Date): { from?: string; to?: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (choice) {
    case 'month':
      return {};
    case 'last-month': {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return { from: ymd(ly, lm, 1), to: ymd(ly, lm, lastDay(ly, lm)) };
    }
    case 'last-3-months': {
      const start = new Date(y, m - 2, 1);
      return { from: ymd(start.getFullYear(), start.getMonth(), 1), to: ymd(y, m, lastDay(y, m)) };
    }
    case 'year':
      return { from: ymd(y, 0, 1), to: ymd(y, 11, 31) };
  }
}

/** The file name the phone shares, matching the one the API sends. */
export const reportFileName = (name: string, from: string, to: string, ext: 'csv' | 'pdf') => `ajo-${name}-${from}-to-${to}.${ext}`;
