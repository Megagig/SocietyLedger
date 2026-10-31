/**
 * The shape every Ajo report returns (T10). One shape, so the web table, the phone list, the CSV and the PDF all read the same thing and
 * none of them does its own sums.
 *
 * Money is whole kobo as a string (JSON cannot carry a BigInt, and a float would lose kobo). Dates are `YYYY-MM-DD`; times are ISO strings.
 */
export const REPORT_NAMES = ['contributions', 'member-ledger', 'collectors', 'payouts', 'defaults', 'financial-summary', 'fees-revenue', 'audit'] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

export type ColumnKind = 'text' | 'money' | 'date' | 'datetime' | 'int' | 'percent';
export type Cell = string | number | null;
export type Row = Record<string, Cell>;

export interface Column {
  key: string;
  label: string;
  kind: ColumnKind;
}

export type MetricKind = 'money' | 'int' | 'percent';
export interface Metric {
  key: string;
  label: string;
  kind: MetricKind;
  /** Kobo as a string for money, a whole number for a count, basis points for a percent; null when it does not apply. */
  value: string | number | null;
  /** One short line of plain words under the figure. */
  hint?: string;
}

export interface CircleBlock {
  groupId: number;
  groupName: string;
  model: 'ROTATING_POT' | 'COLLECTOR_THRIFT';
  timezone: string;
  metrics: Metric[];
}

/** A total across circles of the same kind. Circles of different kinds are never added together. */
export interface TotalsBlock {
  label: string;
  circles: number;
  metrics: Metric[];
}

export interface AppliedFilters {
  groupId: number | null;
  from: string;
  to: string;
  membershipId: number | null;
  collectorUserId: number | null;
}

export interface ReportResult {
  name: ReportName;
  title: string;
  /** The counting rule, printed under the title so nobody has to guess what a figure includes. */
  rule: string;
  filters: AppliedFilters;
  generatedAt: string;
  /** Lines that apply to the whole report, for example the tier the group is on. */
  notes: string[];
  blocks: CircleBlock[];
  totals: TotalsBlock[];
  columns: Column[];
  rows: Row[];
  page: { page: number; pageSize: number; total: number };
}

/** What a report module hands back; the service adds the title, rule, totals and paging. */
export interface ReportBody {
  blocks: CircleBlock[];
  columns: Column[];
  rows: Row[];
  notes?: string[];
}

export const kobo = (value: bigint): string => value.toString();
export const metric = (key: string, label: string, kind: MetricKind, value: bigint | number | null, hint?: string): Metric => ({
  key,
  label,
  kind,
  value: typeof value === 'bigint' ? value.toString() : value,
  ...(hint ? { hint } : {}),
});
export const money = (key: string, label: string, value: bigint, hint?: string): Metric => metric(key, label, 'money', value, hint);
export const count = (key: string, label: string, value: number, hint?: string): Metric => metric(key, label, 'int', value, hint);
