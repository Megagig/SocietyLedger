/**
 * The Ajo reports (T10). Verified against apps/api modules/ajo/reports (2026-10-30).
 * Money is whole kobo as a string; dates are `YYYY-MM-DD`; times are ISO strings.
 */
export type ReportName = 'contributions' | 'member-ledger' | 'collectors' | 'payouts' | 'defaults' | 'financial-summary' | 'fees-revenue' | 'audit';

export type ReportColumnKind = 'text' | 'money' | 'date' | 'datetime' | 'int' | 'percent';
export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell>;
export type ReportColumn = { key: string; label: string; kind: ReportColumnKind };

export type ReportMetric = { key: string; label: string; kind: 'money' | 'int' | 'percent'; value: string | number | null; hint?: string };
export type ReportCircle = { groupId: number; groupName: string; model: 'ROTATING_POT' | 'COLLECTOR_THRIFT'; timezone: string; metrics: ReportMetric[] };
export type ReportTotals = { label: string; circles: number; metrics: ReportMetric[] };

export type ReportListItem = {
  name: ReportName;
  title: string;
  description: string;
  rule: string;
  tier: 'BASIC' | 'ADVANCED' | 'AUDIT';
  tierLabel: string;
  filters: { member: boolean; collector: boolean };
  /** Null when the person can open it; otherwise why not. */
  lock: { kind: 'TIER' | 'ROLE'; message: string } | null;
};

export type ReportFilters = {
  groupId?: number | null;
  from?: string;
  to?: string;
  membershipId?: number | null;
  collectorUserId?: number | null;
};

export type ReportResult = {
  name: ReportName;
  title: string;
  rule: string;
  filters: { groupId: number | null; from: string; to: string; membershipId: number | null; collectorUserId: number | null };
  generatedAt: string;
  notes: string[];
  blocks: ReportCircle[];
  totals: ReportTotals[];
  columns: ReportColumn[];
  rows: ReportRow[];
  page: { page: number; pageSize: number; total: number };
};
