import type { CoopAccountClass, CoopRequestStatus, ContributionCellStatus, WithdrawalStatus } from '@/types/api/coopEnhanced';

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** What an account type's behaviour class means, in words an officer and a member both understand. */
export const ACCOUNT_CLASS_LABELS: Record<CoopAccountClass, string> = {
  CONTRIBUTION: 'Contribution',
  SHARES: 'Shares',
  SPECIAL: 'Special',
};

export const ACCOUNT_CLASS_HELP: Record<CoopAccountClass, string> = {
  CONTRIBUTION: 'Ordinary savings. Members can withdraw from it.',
  SHARES: 'Share capital. It can never be withdrawn.',
  SPECIAL: 'Withdrawable savings, with an optional monthly limit.',
};

/** A payment request's status as the member reads it. */
export const PAYMENT_STATUS_LABELS: Record<CoopRequestStatus, string> = {
  PENDING: 'Awaiting confirmation',
  APPROVED: 'Confirmed',
  REJECTED: 'Not approved',
};

export const PAYMENT_STATUS_KEYS: Record<CoopRequestStatus, string> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  PENDING_REVIEW: 'Awaiting review',
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Paid out',
  REJECTED: 'Not approved',
  CANCELLED: 'Cancelled',
};

export const WITHDRAWAL_STATUS_KEYS: Record<WithdrawalStatus, string> = {
  PENDING_REVIEW: 'pending',
  PENDING_APPROVAL: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

/** Where a withdrawal has got to, in words: who has looked at it and what it waits for. */
export function withdrawalProgress(w: {
  status: WithdrawalStatus;
  twoStage: boolean;
  payoutMethod: string | null;
  payoutReference: string | null;
  rejectionReason: string | null;
}): string {
  switch (w.status) {
    case 'PENDING_REVIEW':
      return 'Waiting for an officer to review it.';
    case 'PENDING_APPROVAL':
      return w.twoStage ? 'Reviewed. Waiting for a second officer to approve and pay.' : 'Waiting for an officer to approve and pay.';
    case 'APPROVED':
      return `Approved${w.payoutMethod ? ` and paid by ${w.payoutMethod.replace(/_/g, ' ').toLowerCase()}` : ''}${w.payoutReference ? ` (ref ${w.payoutReference})` : ''}.`;
    case 'REJECTED':
      return w.rejectionReason ? `Not approved: ${w.rejectionReason}` : 'Not approved.';
    case 'CANCELLED':
      return 'You cancelled this request.';
  }
}

/** The contribution table's cell in words, so a colour is never the only signal. */
export const CELL_WORDS: Record<ContributionCellStatus, string> = {
  PAID: 'paid',
  PARTIAL: 'part paid',
  DEFAULTED: 'defaulted',
  DUE: 'due',
  NONE: 'nothing expected',
};

/** Whether an amount string is more than zero (the tiles hide nothing, but a bar chart and a cell care). */
export const isPositive = (value: string | null | undefined): boolean => value !== null && value !== undefined && Number(value) > 0;

/**
 * What an officer may do with a withdrawal request, and why not when they may not. The member can never decide their own request; the
 * officer who reviewed it can't also approve it when the cooperative runs two stages; and each stage needs its own permission.
 */
export function withdrawalActions(
  w: { status: WithdrawalStatus; twoStage: boolean; memberId: number; reviewedBy: number | null },
  can: { review: boolean; approve: boolean },
  me: { userId: number | undefined; memberId: number | undefined },
): { review?: true; approve?: true; note?: string } {
  if (me.memberId !== undefined && w.memberId === me.memberId) return { note: 'This is your own request, so another officer needs to decide it.' };
  if (w.status === 'PENDING_REVIEW') return can.review ? { review: true } : { note: 'Waiting for an officer with permission to review.' };
  if (w.status === 'PENDING_APPROVAL') {
    if (!can.approve) return { note: 'Waiting for an officer with permission to approve.' };
    if (w.twoStage && w.reviewedBy === me.userId) return { note: 'You reviewed this request, so a different officer needs to approve it.' };
    return { approve: true };
  }
  return {};
}
