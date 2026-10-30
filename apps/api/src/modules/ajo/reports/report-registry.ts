/**
 * The eight Ajo reports: their names, the tier each belongs to, who may run them and what each one counts. The counting rule is shown
 * under the report's title on screen, on the phone and in every file.
 *
 * Tiers (owner decision, T10): basic reports come with every Ajo tier; advanced reports with `ajo.advanced_reports` (Growth and above);
 * the audit report with `ajo.audit_reports` (Business and above). Which tier carries which feature is set in the Plan Builder.
 */
import { auditReport } from './report-audit';
import { collectorsReport } from './report-collectors';
import { contributionsReport } from './report-contributions';
import type { ReportContext } from './report-context';
import { defaultsReport } from './report-defaults';
import { feesRevenueReport } from './report-fees-revenue';
import { financialSummaryReport } from './report-financial-summary';
import { memberLedgerReport } from './report-member-ledger';
import { payoutsReport } from './report-payouts';
import type { ReportBody, ReportName } from './report-types';

export type ReportTier = 'BASIC' | 'ADVANCED' | 'AUDIT';

export const TIER_FEATURE: Record<ReportTier, string | null> = { BASIC: null, ADVANCED: 'ajo.advanced_reports', AUDIT: 'ajo.audit_reports' };
export const TIER_LABEL: Record<ReportTier, string> = { BASIC: 'Basic reports', ADVANCED: 'Advanced reports', AUDIT: 'Audit reports' };

export interface ReportDef {
  name: ReportName;
  title: string;
  description: string;
  tier: ReportTier;
  /** Which filters this report understands; the screens hide the others. */
  filters: { member: boolean; collector: boolean };
  /** A collector who is not an officer may run it (they then see only their own people). */
  forCollectors: boolean;
  rule: string;
  run: (ctx: ReportContext) => Promise<ReportBody>;
}

const DATES = 'Money is counted on the day it was recorded in the circle\'s own timezone; expected, outstanding and overdue on the due date.';

export const REPORTS: ReportDef[] = [
  {
    name: 'contributions',
    title: 'Contributions',
    description: 'What was expected, paid, outstanding, overdue or missed, one row per instalment.',
    tier: 'BASIC',
    filters: { member: true, collector: true },
    forCollectors: true,
    rule: `Expected is what the schedule says was due in the dates, waived rounds left out. Paid counts confirmed money only; a reported payment is not paid until an officer confirms it. Outstanding is expected less paid, for instalments already due. Overdue is within the grace period; missed is past it. "Received" is the group ledger's total for the dates. ${DATES}`,
    run: (ctx) => contributionsReport(ctx),
  },
  {
    name: 'member-ledger',
    title: 'Member ledger',
    description: 'Every payment, fee, payout, reversal and adjustment per person, with a running balance.',
    tier: 'BASIC',
    filters: { member: true, collector: true },
    forCollectors: true,
    rule: `Every entry in the group ledger for the people shown, oldest first, with a running balance. Money in is contributions and fees paid; money out is payouts and the collector fee; a reversal is the opposite of the entry it cancels. ${DATES}`,
    run: (ctx) => memberLedgerReport(ctx),
  },
  {
    name: 'payouts',
    title: 'Payouts',
    description: 'Scheduled, waiting, paid and reversed payouts with their beneficiaries.',
    tier: 'BASIC',
    filters: { member: true, collector: false },
    forCollectors: false,
    rule: 'A payout is counted on the day it was recorded as paid; one not yet paid on the day it was prepared; a rotating-pot round with no payout yet is Scheduled on its due date. "Paid out per the ledger" is the group ledger\'s total and is the figure to check against it.',
    run: (ctx) => payoutsReport(ctx),
  },
  {
    name: 'financial-summary',
    title: 'Group financial summary',
    description: 'Money in, money out, what is owed and the cash counted, by circle and month.',
    tier: 'BASIC',
    filters: { member: false, collector: false },
    forCollectors: false,
    rule: `Totals of the group ledger by month, net of reversals, so they match it to the kobo. Owed amounts are as of today. Cash counted is only the days an officer has counted. This report is about the circle as a whole, so the person and collector filters do not apply. ${DATES}`,
    run: (ctx) => financialSummaryReport(ctx),
  },
  {
    name: 'collectors',
    title: 'Collector performance',
    description: 'Cash each collector recorded, handed in and had counted, against their targets.',
    tier: 'ADVANCED',
    filters: { member: false, collector: true },
    forCollectors: true,
    rule: 'Cash is counted on its business day (after the circle\'s cutoff time it counts for the next day). Awaiting confirmation is cash an officer has not confirmed yet; it is not counted as received. A handover is counted on the day it is for. "Handed in less collected" of zero means the collector handed in all of it.',
    run: (ctx) => collectorsReport(ctx),
  },
  {
    name: 'defaults',
    title: 'Defaults and arrears',
    description: 'Who is behind, their unpaid late fees, default cases, repayment plans and disputes.',
    tier: 'ADVANCED',
    filters: { member: true, collector: false },
    forCollectors: false,
    rule: 'People behind on instalments due in the dates, as of today. Overdue is within the grace period, missed is past it. A payment that is only reported, or a round under an open dispute, is not counted as behind. Cases and plans are shown while open.',
    run: (ctx) => defaultsReport(ctx),
  },
  {
    name: 'fees-revenue',
    title: 'Fees and revenue',
    description: 'Late fees assessed, paid and waived, the collector fee, and the platform levy.',
    tier: 'ADVANCED',
    filters: { member: true, collector: false },
    forCollectors: false,
    rule: 'Late fees and the collector fee are the group\'s own income. The platform levy is what the group owes SocietyLedger and is never taken from a payout. Fees are counted on the day they were assessed; "paid" figures are the group ledger\'s totals for the dates.',
    run: (ctx) => feesRevenueReport(ctx),
  },
  {
    name: 'audit',
    title: 'Audit and activity',
    description: 'Approvals, reversals, waivers, rule and order changes, with who, when and why.',
    tier: 'AUDIT',
    filters: { member: true, collector: false },
    forCollectors: false,
    rule: 'Newest first, from the records Ajo already keeps. Routine payment records are in the member ledger; this report lists confirmations, reversals, payout steps, waivers, rule and order changes, default case steps, cash counts and report exports. Notes and claims are left out; the reasons officers gave are shown.',
    run: (ctx) => auditReport(ctx),
  },
];

export const reportDef = (name: string): ReportDef | undefined => REPORTS.find((r) => r.name === name);
