import { Decimal } from '@prisma/client/runtime/library';
import { RuleError } from '../finance/rule-error';

/**
 * Welfare money rules. A contribution only adds to a fund once, a payout only leaves it once, nobody decides their own money, and a
 * fund never pays out more than it holds or than its rules allow.
 */

/** Statuses a payout request can still be reviewed in. */
export const REVIEWABLE_PAYOUT_STATUSES = ['PENDING', 'UNDER_REVIEW'] as const;

/** The officer who recorded a contribution can't also confirm it; another officer has to (as with bank transfers and payment proofs). */
export function assertNotRecorder(deciderUserId: number, recordedBy: number | null | undefined): void {
  if (recordedBy !== null && recordedBy !== undefined && recordedBy === deciderUserId) {
    throw new RuleError('You recorded this contribution, so another officer needs to confirm it.', 403, 'OWN_RECORDING');
  }
}

/** Only an active member can contribute to a fund or ask it for a payout. */
export function assertMemberActive(status: string, what: 'contribute' | 'request'): void {
  if (status !== 'active') {
    throw new RuleError(
      what === 'contribute' ? 'Only an active member can contribute to a fund.' : 'Only an active member can ask a fund for a payout.',
      409,
      'MEMBER_NOT_ACTIVE',
    );
  }
}

/** A contribution has to meet the fund's minimum, if it has one. */
export function assertContributionAmount(amount: number, minContribution: Decimal | number | null): void {
  if (!(amount > 0)) throw new RuleError('Enter an amount above ₦0.', 400, 'INVALID_AMOUNT');
  if (minContribution !== null && new Decimal(amount).lessThan(minContribution)) {
    throw new RuleError(`The smallest contribution to this fund is ₦${new Decimal(minContribution).toNumber().toLocaleString('en-NG', { minimumFractionDigits: 2 })}.`, 400, 'BELOW_MINIMUM');
  }
}

/**
 * What a payout can be approved for: no more than was asked, no more than the fund's maximum payout, and no more than the fund holds
 * right now. (The fund is checked again, atomically, when the payout is disbursed.)
 */
export function assertApprovalAmount(args: { approved: number; requested: Decimal | number; maxPayout: Decimal | number | null; balance: Decimal | number }): void {
  const fmt = (value: Decimal | number) => `₦${new Decimal(value).toNumber().toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  if (!(args.approved > 0)) throw new RuleError('Enter an amount above ₦0 to approve.', 400, 'INVALID_AMOUNT');
  if (new Decimal(args.approved).greaterThan(args.requested)) {
    throw new RuleError(`You can approve at most what was asked for (${fmt(args.requested)}).`, 400, 'APPROVAL_TOO_LARGE');
  }
  if (args.maxPayout !== null && new Decimal(args.approved).greaterThan(args.maxPayout)) {
    throw new RuleError(`This fund pays out at most ${fmt(args.maxPayout)} at a time.`, 400, 'MAX_PAYOUT_EXCEEDED');
  }
  if (new Decimal(args.approved).greaterThan(args.balance)) {
    throw new RuleError(`The fund only holds ${fmt(args.balance)} right now.`, 409, 'FUND_INSUFFICIENT');
  }
}
