import { Decimal } from '@prisma/client/runtime/library';
import { RuleError } from '../finance/rule-error';

/**
 * Cooperative money rules. Nobody decides their own money; a balance only moves when it is still what we checked; a loan is paid out
 * once, to somewhere real; and a repayment can't be more than is owed.
 */

/** Statuses a loan application can still be reviewed in. */
export const REVIEWABLE_STATUSES = ['PENDING_REVIEW', 'UNDER_REVIEW', 'PENDING_APPROVAL'] as const;

/**
 * An officer can't decide a request that is their own (a loan application, a deposit or a repayment they made as a member). Another
 * officer has to. `ownerUserId` is the login of the member the request belongs to, if they have one.
 */
export function assertNotOwnRequest(deciderUserId: number, ownerUserId: number | null | undefined): void {
  if (ownerUserId !== null && ownerUserId !== undefined && ownerUserId === deciderUserId) {
    throw new RuleError('This is your own request, so another officer needs to decide it.', 403, 'OWN_REQUEST');
  }
}

/** A withdrawal can't take more than the account holds. */
export function assertWithdrawable(balance: Decimal, amount: Decimal): void {
  if (balance.lessThan(amount)) {
    throw new RuleError('Insufficient balance for this withdrawal.', 409, 'INSUFFICIENT_BALANCE');
  }
}

/** A repayment can't be more than what is still owed on the loan. */
export function assertRepaymentWithinOutstanding(amount: Decimal | number, outstanding: Decimal): void {
  if (new Decimal(amount).greaterThan(outstanding)) {
    throw new RuleError(
      `That is more than is still owed on this loan (₦${outstanding.toNumber().toLocaleString('en-NG', { minimumFractionDigits: 2 })}).`,
      400,
      'REPAYMENT_TOO_LARGE',
    );
  }
}

/** Paying a loan into savings needs the savings account to credit. */
export function assertDisbursementTarget(method: string, savingsAccountId: number | undefined): void {
  if (method === 'savings_credit' && !savingsAccountId) {
    throw new RuleError("Choose the member's savings account to credit.", 400, 'SAVINGS_ACCOUNT_REQUIRED');
  }
}

/** The account a loan is credited to must be the borrower's own and still open. */
export function assertDisbursementAccount(account: { memberId: number; status: string } | null, borrowerMemberId: number): void {
  if (!account || account.memberId !== borrowerMemberId || account.status !== 'ACTIVE') {
    throw new RuleError("That isn't an open savings account of the borrower, so the loan can't be credited to it.", 400, 'DISBURSE_ACCOUNT_INVALID');
  }
}

// ============================================
// Withdrawals (two-stage) and the contribution table
// ============================================

const naira = (value: Decimal) => `₦${value.toNumber().toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/** Savings types whose behaviour class says "not withdrawable" (share capital) can never be taken out. */
export function assertTypeWithdrawable(type: { name: string; isWithdrawable: boolean } | null): void {
  if (type && !type.isWithdrawable) {
    throw new RuleError(`${type.name} can't be withdrawn.`, 409, 'NOT_WITHDRAWABLE');
  }
}

/** Part of the savings may be held against a loan: only what is left after the hold can be taken out. */
export function assertAvailableAfterHold(amount: Decimal, position: { locked: Decimal; available: Decimal }): void {
  if (position.locked.gt(0) && amount.gt(position.available)) {
    throw new RuleError(
      `Only ${naira(position.available)} of the savings is available — the rest is held against an active loan.`,
      409,
      'SAVINGS_HELD',
    );
  }
}

/** A type can cap how much a member withdraws from it in a calendar month. `null` means no cap. */
export function assertWithinMonthlyLimit(limit: Decimal | null, withdrawnThisMonth: Decimal, amount: Decimal): void {
  if (!limit) return;
  const remaining = Decimal.max(limit.minus(withdrawnThisMonth), new Decimal(0));
  if (amount.gt(remaining)) {
    throw new RuleError(
      remaining.isZero()
        ? `The monthly withdrawal limit of ${naira(limit)} has already been used this month.`
        : `That is more than the ${naira(remaining)} still allowed to withdraw this month (limit ${naira(limit)}).`,
      409,
      'MONTHLY_LIMIT',
    );
  }
}

/** The first and last moment of the calendar month containing `date` (UTC), as [start, nextMonthStart). */
export function monthWindow(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Stage one: whoever reviews can't be the member who asked. */
export function assertCanReview(reviewerUserId: number, requesterUserId: number | null | undefined): void {
  assertNotOwnRequest(reviewerUserId, requesterUserId);
}

/**
 * Stage two: the approver can't be the member who asked, and — when the association runs two stages — can't be the officer who reviewed it.
 * Three different people, so no one both checks and pays.
 */
export function assertCanApprove(input: {
  approverUserId: number;
  requesterUserId: number | null | undefined;
  reviewerUserId: number | null | undefined;
  twoStage: boolean;
}): void {
  assertNotOwnRequest(input.approverUserId, input.requesterUserId);
  if (input.twoStage && input.reviewerUserId !== null && input.reviewerUserId !== undefined && input.reviewerUserId === input.approverUserId) {
    throw new RuleError('You reviewed this request, so a different officer needs to approve it.', 403, 'SAME_REVIEWER');
  }
}

export type ContributionCell = 'PAID' | 'PARTIAL' | 'DEFAULTED' | 'DUE' | 'NONE';

/**
 * One month of the contribution table. A month is DEFAULTED only once it is over (earlier than `currentMonth`) and less than the
 * expected amount was paid for it; the current month is just DUE until it ends. No expected amount means we can't call anything a default,
 * so an unpaid month is NONE.
 */
export function contributionCell(input: {
  expected: Decimal | null;
  paid: Decimal;
  year: number;
  month: number;
  current: { year: number; month: number };
  openedBefore: boolean;
}): ContributionCell {
  const { expected, paid } = input;
  const expectedPositive = expected !== null && expected.gt(0);
  if (paid.gt(0)) return expectedPositive && paid.lt(expected as Decimal) ? 'PARTIAL' : 'PAID';
  if (!expectedPositive || !input.openedBefore) return 'NONE';
  const isPast = input.year < input.current.year || (input.year === input.current.year && input.month < input.current.month);
  return isPast ? 'DEFAULTED' : 'DUE';
}
