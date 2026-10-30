/**
 * Ajo reports (T10): which reports a person may open, running one, and exporting one as a file.
 *
 * Three questions are asked in this order, and each has its own refusal: may this person run reports at all (the route's permission),
 * may this kind of person run this report (a collector who is not an officer sees only their own people, and only some reports), and
 * does the tenant's Ajo tier include it. An expired add-on keeps every report readable and exportable, like the rest of its history.
 */
import prisma from '../../../lib/prisma';
import { ModuleFeatureService } from '../../../services/module-feature.service';
import { RuleError } from '../../finance/rule-error';
import type { AjoAccess } from '../ajo-access';
import { auditAjo } from '../ajo-support';
import { buildContext, type ReportScope } from './report-context';
import { reportCsv, reportFileName, reportPdf } from './report-export';
import { REPORTS, TIER_FEATURE, TIER_LABEL, reportDef, type ReportDef } from './report-registry';
import type { CircleBlock, Metric, ReportResult, TotalsBlock } from './report-types';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export interface ReportListItem {
  name: string;
  title: string;
  description: string;
  /** How the report counts, in words; the screens print it under the title. */
  rule: string;
  tier: string;
  tierLabel: string;
  filters: { member: boolean; collector: boolean };
  /** Null when the person can open it; otherwise why not. */
  lock: { kind: 'TIER' | 'ROLE'; message: string } | null;
}

async function lockOf(def: ReportDef, input: { associationId: number; access: AjoAccess; scope: ReportScope }): Promise<ReportListItem['lock']> {
  if (input.scope.collectorOnly && !def.forCollectors) {
    return { kind: 'ROLE', message: 'This report is for the group\'s officers. Collectors see their own contributions, ledger and cash.' };
  }
  const feature = TIER_FEATURE[def.tier];
  // An expired add-on is read-only, not switched off: it keeps every report it had, so history is never lost to a feature check.
  if (feature && input.access !== 'READ_ONLY') {
    const status = await ModuleFeatureService.getFeatureStatus(input.associationId, feature);
    if (!status.isEnabled) {
      return { kind: 'TIER', message: `${TIER_LABEL[def.tier]} are not part of your Ajo tier. Upgrade the tier to use this report.` };
    }
  }
  return null;
}

export async function listReports(input: { associationId: number; access: AjoAccess; scope: ReportScope }): Promise<ReportListItem[]> {
  return Promise.all(
    REPORTS.map(async (def) => ({
      name: def.name,
      title: def.title,
      description: def.description,
      rule: def.rule,
      tier: def.tier,
      tierLabel: TIER_LABEL[def.tier],
      filters: def.filters,
      lock: await lockOf(def, input),
    })),
  );
}

const SUMMABLE = new Set(['money', 'int']);

/** Add up the same figure across circles. A percentage cannot be added, so it is left out of a total. */
function sumMetrics(blocks: CircleBlock[]): Metric[] {
  const first = blocks[0];
  return first.metrics.map((m) => {
    if (!SUMMABLE.has(m.kind)) return { ...m, value: null, hint: undefined };
    const values = blocks.map((b) => b.metrics.find((x) => x.key === m.key)?.value ?? null);
    if (m.kind === 'money') return { ...m, value: values.reduce((a, v) => a + BigInt((v as string | null) ?? '0'), 0n).toString() };
    return { ...m, value: values.reduce((a: number, v) => a + Number(v ?? 0), 0) };
  });
}

/** Totals are added only across circles of the same kind; a rotating pot and a collector-thrift group are never blended. */
export function totalsOf(blocks: CircleBlock[]): TotalsBlock[] {
  const out: TotalsBlock[] = [];
  for (const [model, label] of [['ROTATING_POT', 'All rotating pots'], ['COLLECTOR_THRIFT', 'All collector-thrift groups']] as const) {
    const same = blocks.filter((b) => b.model === model);
    if (same.length >= 2) out.push({ label, circles: same.length, metrics: sumMetrics(same) });
  }
  return out;
}

export interface RunInput {
  associationId: number;
  name: string;
  query: unknown;
  scope: ReportScope;
  access: AjoAccess;
  page?: number;
  pageSize?: number;
  /** Every row, for a file. */
  all?: boolean;
  now?: Date;
}

export async function runReport(input: RunInput): Promise<ReportResult> {
  const def = reportDef(input.name);
  if (!def) throw new RuleError('There is no such report.', 404, 'REPORT_NOT_FOUND');
  const lock = await lockOf(def, input);
  if (lock) throw new RuleError(lock.message, 403, lock.kind === 'TIER' ? 'REPORT_NOT_IN_TIER' : 'REPORT_NOT_FOR_YOU');

  const now = input.now ?? new Date();
  const ctx = await buildContext({ associationId: input.associationId, query: input.query, scope: input.scope, now });
  const body = await def.run(ctx);

  const pageSize = input.all ? Math.max(1, body.rows.length) : Math.min(MAX_PAGE_SIZE, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));
  const page = input.all ? 1 : Math.max(1, input.page ?? 1);
  return {
    name: def.name,
    title: def.title,
    rule: def.rule,
    filters: ctx.filters,
    generatedAt: now.toISOString(),
    notes: body.notes ?? [],
    blocks: body.blocks,
    totals: totalsOf(body.blocks),
    columns: body.columns,
    rows: input.all ? body.rows : body.rows.slice((page - 1) * pageSize, page * pageSize),
    page: { page, pageSize, total: body.rows.length },
  };
}

export interface ExportInput extends Omit<RunInput, 'all' | 'page' | 'pageSize'> {
  format: 'csv' | 'pdf';
  actorUserId: number;
}

/** A report as a file. Each export is written to the audit log, so the audit report can show who took a copy of what. */
export async function exportReport(input: ExportInput): Promise<{ body: Buffer | string; contentType: string; fileName: string }> {
  const report = await runReport({ ...input, all: true });
  const body = input.format === 'csv' ? reportCsv(report) : await reportPdf(report);
  await auditAjo(prisma, {
    associationId: input.associationId,
    userId: input.actorUserId,
    action: 'AJO_REPORT_EXPORTED',
    tableName: 'ajo_reports',
    newValues: { report: report.name, format: input.format, from: report.filters.from, to: report.filters.to, groupId: report.filters.groupId, rows: report.page.total },
  });
  return {
    body,
    contentType: input.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
    fileName: reportFileName(report, input.format),
  };
}
