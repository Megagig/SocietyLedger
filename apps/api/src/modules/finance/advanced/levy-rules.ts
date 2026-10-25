import { RuleError } from '../rule-error';

/**
 * Levy campaign rules. A levy is a debt: every member assigned to a campaign gets an ordinary charge on their ledger, and that
 * charge stays owed until the member pays or an officer waives or voids it, one member at a time. So closing a campaign only
 * stops new members being added; it never touches the charges already raised.
 */
export class LevyRuleError extends RuleError {}

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';

/** The only statuses an officer can move a campaign to by hand. Completed is worked out from payments, never set. */
export const MANUAL_TARGETS: Partial<Record<CampaignStatus, CampaignStatus[]>> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['CLOSED'],
};

/** Throws unless a campaign may be moved from `from` to `to` by an officer. */
export function assertStatusChange(from: CampaignStatus, to: CampaignStatus): void {
  if (from === to) return;
  if (!(MANUAL_TARGETS[from] ?? []).includes(to)) {
    throw new LevyRuleError(
      to === 'COMPLETED'
        ? 'A campaign completes by itself once everyone assigned has paid.'
        : `A campaign that is ${from.toLowerCase()} can't be moved to ${to.toLowerCase()}. A debt is dropped member by member, by waiving or voiding that member's charge.`,
      409,
      'INVALID_CAMPAIGN_STATUS',
    );
  }
}

/** Only an active campaign takes new members. */
export function assertCanAssign(status: CampaignStatus): void {
  if (status !== 'ACTIVE') {
    throw new LevyRuleError(
      status === 'CLOSED' || status === 'COMPLETED' ? 'This campaign is closed to new members.' : 'Only an active campaign can take new members.',
      409,
      'CAMPAIGN_NOT_ACTIVE',
    );
  }
}

/** A campaign can't be given a deadline that has already passed. `today` is the start of today, so "today" is still allowed. */
export function assertDeadlineNotPast(deadline: Date, now: Date = new Date()): void {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (deadline.getTime() < today.getTime()) {
    throw new LevyRuleError('The deadline can\'t be in the past.', 400, 'DEADLINE_IN_PAST');
  }
}

/**
 * What officers see: a campaign whose members have all paid is Completed, whatever is stored. Needs at least one assignment so a
 * brand-new campaign is not "complete".
 */
export function effectiveStatus(stored: CampaignStatus, assigned: number, paid: number): CampaignStatus {
  if ((stored === 'ACTIVE' || stored === 'CLOSED') && assigned > 0 && paid >= assigned) return 'COMPLETED';
  return stored;
}

/** Removing an assignment is a correction for a mistake: refused once the member has paid anything. */
export function assertAssignmentRemovable(paymentCount: number): void {
  if (paymentCount > 0) {
    throw new LevyRuleError(
      'This member has already paid something towards this levy. Waive or void the charge instead.',
      409,
      'ASSIGNMENT_HAS_PAYMENTS',
    );
  }
}
