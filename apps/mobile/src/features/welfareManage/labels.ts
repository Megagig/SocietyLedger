import { formatMoney } from '@/lib/money';
import type { ContributionStatus, FundKind, FundStatus, OfficerContributionDTO, OfficerFundDTO, PayoutStatus } from '@/types/api/welfareManage';

export const FUND_KIND_LABELS: Record<FundKind, string> = {
  GENERAL: 'General',
  BEREAVEMENT: 'Bereavement',
  MEDICAL: 'Medical',
  EDUCATION: 'Education',
  EMERGENCY: 'Emergency',
  MATERNITY: 'Maternity',
  WEDDING: 'Wedding',
};

export const FUND_KIND_OPTIONS = (Object.keys(FUND_KIND_LABELS) as FundKind[]).map((value) => ({ value, label: FUND_KIND_LABELS[value] }));

export const FUND_STATUS_LABELS: Record<FundStatus, string> = { ACTIVE: 'Active', SUSPENDED: 'Suspended', CLOSED: 'Closed' };
export const FUND_STATUS_OPTIONS = (Object.keys(FUND_STATUS_LABELS) as FundStatus[]).map((value) => ({ value, label: FUND_STATUS_LABELS[value] }));

/** The key `StatusChip` understands for a fund. */
export const fundStatusKey = (status: FundStatus): string => (status === 'ACTIVE' ? 'active' : status === 'SUSPENDED' ? 'suspended' : 'closed');

/** Percent of the fund's target that is held, or null when it has no target. */
export function fundProgress(fund: Pick<OfficerFundDTO, 'targetBalance' | 'currentBalance'>): number | null {
  if (fund.targetBalance === null || !(Number(fund.targetBalance) > 0)) return null;
  return Math.min(100, Math.round((Number(fund.currentBalance) / Number(fund.targetBalance)) * 100));
}

/** The fund's payout rules in a line: "Pays out up to ₦100,000.00 · waits 30 days · 6 months of contributions". */
export function fundRulesLine(fund: Pick<OfficerFundDTO, 'maxPayout' | 'waitingPeriodDays' | 'minContributionMonths'>): string {
  const parts: string[] = [];
  parts.push(fund.maxPayout === null ? 'No payout limit' : `Pays out up to ${formatMoney(fund.maxPayout)}`);
  if (fund.waitingPeriodDays > 0) parts.push(`waits ${fund.waitingPeriodDays} ${fund.waitingPeriodDays === 1 ? 'day' : 'days'}`);
  if (fund.minContributionMonths > 0) parts.push(`${fund.minContributionMonths} ${fund.minContributionMonths === 1 ? 'month' : 'months'} of contributions`);
  return parts.join(' · ');
}

/** A fund can be deleted only while it has no history; otherwise close it instead. */
export const fundCanDelete = (fund: Pick<OfficerFundDTO, '_count'>): boolean => fund._count.contributions === 0 && fund._count.payoutRequests === 0;

// ---------------------------------------------------------------- contributions

export const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatus, string> = { PENDING: 'Waiting', CONFIRMED: 'Confirmed', REJECTED: 'Not approved' };
export const contributionStatusKey = (status: ContributionStatus): string => (status === 'PENDING' ? 'pending' : status === 'CONFIRMED' ? 'confirmed' : 'rejected');
export const CONTRIBUTION_FILTERS: { label: string; value: ContributionStatus | '' }[] = [
  { label: 'To confirm', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Not approved', value: 'REJECTED' },
  { label: 'All', value: '' },
];

export type ConfirmGuard = 'ok' | 'own' | 'recorder' | 'decided';

/**
 * Whether this officer may confirm a contribution: not one made in their own name, not one they recorded themselves (another officer
 * has to), and only while it is waiting. Mirrors the API, so the buttons are hidden rather than refused.
 */
export function confirmGuard(
  contribution: Pick<OfficerContributionDTO, 'status' | 'memberId' | 'recordedBy'>,
  who: { memberId: number | undefined; userId: number | undefined },
): ConfirmGuard {
  if (contribution.status !== 'PENDING') return 'decided';
  if (who.memberId !== undefined && contribution.memberId === who.memberId) return 'own';
  if (who.userId !== undefined && contribution.recordedBy !== null && contribution.recordedBy === who.userId) return 'recorder';
  return 'ok';
}

export const CONFIRM_GUARD_MESSAGES: Record<Exclude<ConfirmGuard, 'ok' | 'decided'>, string> = {
  own: 'This contribution is in your own name, so another officer needs to confirm it.',
  recorder: 'You recorded this contribution, so another officer needs to confirm it.',
};

// ---------------------------------------------------------------- payouts

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  PENDING: 'Waiting',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DISBURSED: 'Paid out',
  CANCELLED: 'Cancelled',
};

export const payoutStatusKey = (status: PayoutStatus): string => {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'UNDER_REVIEW':
      return 'under_review';
    default:
      return status.toLowerCase();
  }
};

export const PAYOUT_FILTERS: { label: string; value: PayoutStatus | '' }[] = [
  { label: 'To decide', value: 'PENDING' },
  { label: 'Under review', value: 'UNDER_REVIEW' },
  { label: 'To pay out', value: 'APPROVED' },
  { label: 'Paid out', value: 'DISBURSED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: '' },
];

/** A request can be approved or rejected while it is waiting or under review. */
export const payoutCanReview = (status: PayoutStatus): boolean => status === 'PENDING' || status === 'UNDER_REVIEW';

/** Only an approved request can be paid out, and only once. */
export const payoutCanDisburse = (status: PayoutStatus): boolean => status === 'APPROVED';

/** The most a request can be approved for: what was asked, the fund's payout limit and what the fund holds, whichever is least. */
export function maxApproval(args: { requested: string | number; maxPayout: string | number | null; balance: string | number }): number {
  const limits = [Number(args.requested), Number(args.balance)];
  if (args.maxPayout !== null) limits.push(Number(args.maxPayout));
  return Math.max(0, Math.min(...limits));
}

/** Which limit stops a bigger approval, in words (for the form's helper). */
export function approvalLimitReason(args: { requested: string | number; maxPayout: string | number | null; balance: string | number }): string {
  const max = maxApproval(args);
  if (max === Number(args.balance) && Number(args.balance) < Number(args.requested)) return `the fund only holds ${formatMoney(args.balance)}`;
  if (args.maxPayout !== null && max === Number(args.maxPayout) && Number(args.maxPayout) < Number(args.requested)) return `the fund pays out at most ${formatMoney(args.maxPayout)}`;
  return `${formatMoney(args.requested)} was asked for`;
}

export const reviewedSummary = (approved: boolean, amount: string | number): string =>
  approved ? `Approved ${formatMoney(amount)} — it can now be paid out` : 'Rejected — the member has been told why';
