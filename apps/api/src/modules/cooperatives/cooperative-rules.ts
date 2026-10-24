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
