/**
 * Ajo reports (T10): which reports a person may open, running one, and exporting one as a file.
 *
 * Three questions are asked in this order, and each has its own refusal: may this person run reports at all (the route's permission),
 * may this kind of person run this report (a collector who is not an officer sees only their own people, and only some reports), and
 * does the tenant's Ajo tier include it. An expired add-on keeps readable and exportable the reports its own tier included, like the
 * rest of its history, and no more.
 */
import prisma from '../../../lib/prisma';
import { ModuleFeatureService } from '../../../services/module-feature.service';
import { RuleError } from '../../finance/rule-error';
import { getLapsedFeatureCodes } from '../../../services/billing/tier-change.service';
import { AJO_FAMILY, type AjoAccess } from '../ajo-access';
import { auditAjo } from '../ajo-support';
import { buildContext, filterSchema, type ReportContext, type ReportScope } from './report-context';
import { reportCsv, reportFileName, reportPdf } from './report-export';
import { REPORTS, TIER_FEATURE, TIER_LABEL, reportDef, type ReportDef } from './report-registry';
import type { CircleBlock, Metric, ReportBody, ReportResult, TotalsBlock } from './report-types';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
/** A PDF is laid out on the server in one go, so it holds fewer rows than a CSV. */
export const PDF_MAX_ROWS = 5_000;

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
  if (!feature) return null;
  // The same emergency switch as every other gate: in shadow mode a missing feature is noted elsewhere but not enforced.
  if (process.env.FEATURE_FLAG_MODE === 'shadow') return null;
  if (input.access === 'READ_ONLY') {
    // An expired add-on is read-only, not switched off: it keeps the reports its own tier included, so history is never lost to a
    // feature check, and a lapsed Starter does not gain the audit report by lapsing. With no record of a tier, nothing is taken away.
    const lapsed = await getLapsedFeatureCodes(input.associationId, AJO_FAMILY);
    if (lapsed && !lapsed.has(feature)) {
      return { kind: 'TIER', message: `${TIER_LABEL[def.tier]} were not part of the Ajo tier that expired. Renew with a higher tier to use this report.` };
    }
    return null;
  }
  const status = await ModuleFeatureService.getFeatureStatus(input.associationId, feature);
  if (!status.isEnabled) {
    return { kind: 'TIER', message: `${TIER_LABEL[def.tier]} are not part of your Ajo tier. Upgrade the tier to use this report.` };
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

// Paging a report asks for the same rows again and again, so a computed report is kept for a few seconds. Page 1 and every file are
// always worked out fresh (a refresh, a changed filter or an export never shows old figures); only "next page" reuses it. A few reports
// at most are held, and none that is very large.
const PAGE_CACHE_MS = 30_000;
const PAGE_CACHE_MAX = 5;
const PAGE_CACHE_MAX_ROWS = 50_000;
interface Computed {
  at: number;
  filters: ReportContext['filters'];
  generatedAt: string;
  body: ReportBody;
}
const pageCache = new Map<string, Computed>();

function remember(key: string, value: Computed): void {
  if (value.body.rows.length > PAGE_CACHE_MAX_ROWS) return;
  pageCache.delete(key);
  pageCache.set(key, value);
  while (pageCache.size > PAGE_CACHE_MAX) pageCache.delete(pageCache.keys().next().value as string);
}

export async function runReport(input: RunInput): Promise<ReportResult> {
  const def = reportDef(input.name);
  if (!def) throw new RuleError('There is no such report.', 404, 'REPORT_NOT_FOUND');
  const lock = await lockOf(def, input);
  if (lock) throw new RuleError(lock.message, 403, lock.kind === 'TIER' ? 'REPORT_NOT_IN_TIER' : 'REPORT_NOT_FOR_YOU');

  const now = input.now ?? new Date();
  const wantedPage = input.all ? 1 : Math.max(1, input.page ?? 1);
  const key = JSON.stringify([input.associationId, def.name, filterSchema.parse(input.query ?? {}), input.scope.userId, input.scope.collectorOnly]);
  let computed = !input.all && wantedPage > 1 ? pageCache.get(key) : undefined;
  if (computed && Date.now() - computed.at > PAGE_CACHE_MS) computed = undefined;
  if (!computed) {
    const ctx = await buildContext({ associationId: input.associationId, query: input.query, scope: input.scope, now });
    computed = { at: Date.now(), filters: ctx.filters, generatedAt: now.toISOString(), body: await def.run(ctx) };
    if (!input.all) remember(key, computed);
  }
  const body = computed.body;

  const pageSize = input.all ? Math.max(1, body.rows.length) : Math.min(MAX_PAGE_SIZE, Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE));
  const page = wantedPage;
  return {
    name: def.name,
    title: def.title,
    rule: def.rule,
    filters: computed.filters,
    generatedAt: computed.generatedAt,
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
  if (input.format === 'pdf' && report.page.total > PDF_MAX_ROWS) {
    throw new RuleError(`A PDF holds up to ${PDF_MAX_ROWS.toLocaleString('en-NG')} rows and this report has ${report.page.total.toLocaleString('en-NG')}. Download the CSV instead, or narrow the dates.`, 400, 'REPORT_TOO_LARGE_FOR_PDF');
  }
  const body = input.format === 'csv' ? reportCsv(report) : await reportPdf(report);
  await auditAjo(prisma, {
    associationId: input.associationId,
    userId: input.actorUserId,
    action: 'AJO_REPORT_EXPORTED',
    tableName: 'ajo_reports',
    newValues: { report: report.name, format: input.format, from: report.filters.from, to: report.filters.to, groupId: report.filters.groupId, membershipId: report.filters.membershipId, collectorUserId: report.filters.collectorUserId, rows: report.page.total },
  });
  return {
    body,
    contentType: input.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
    fileName: reportFileName(report, input.format),
  };
}
