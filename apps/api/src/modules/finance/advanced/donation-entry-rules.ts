import { RuleError } from '../rule-error';

/**
 * Recording a donation for a member. An instant donation is money received now; a pledge is a promise to pay by a date. Either way the
 * amount is real money above ₦0, the donor is an active member, and a pledge date is not one that has already gone by.
 */
export type DonationEntryInput = {
  amount: number;
  memberStatus: string;
  donationType: 'instant' | 'pledge';
  pledgeDate?: Date | null;
};

export function assertDonationAllowed(input: DonationEntryInput, now: Date = new Date()): void {
  if (!(input.amount > 0)) throw new RuleError('Enter an amount above ₦0.', 400, 'INVALID_AMOUNT');
  if (input.memberStatus !== 'active') {
    throw new RuleError('Only an active member can be recorded as a donor.', 409, 'MEMBER_NOT_ACTIVE');
  }
  if (input.donationType === 'pledge' && input.pledgeDate) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    if (input.pledgeDate.getTime() < today.getTime()) {
      throw new RuleError("A pledge date can't be in the past.", 400, 'PLEDGE_DATE_IN_PAST');
    }
  }
}
