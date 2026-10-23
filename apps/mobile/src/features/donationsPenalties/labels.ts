import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { ChargeListItemDTO } from '@/types/api/financeManage';
import type { AllocationKind, DonationListItemDTO, DonationReceiptDTO, PenaltyRuleDTO } from '@/types/api/donationsPenalties';

export const ALLOCATION_KIND_LABELS: Record<AllocationKind, string> = {
  general: 'General',
  project: 'Project',
  emergency: 'Emergency',
  other: 'Other',
};

export const ALLOCATION_KIND_OPTIONS = (Object.keys(ALLOCATION_KIND_LABELS) as AllocationKind[]).map((value) => ({ value, label: ALLOCATION_KIND_LABELS[value] }));

// ---------------------------------------------------------------- donations

type DonationLike = Pick<DonationListItemDTO, 'isVoided' | 'isPledge' | 'status'>;

/** What to show for a donation: a voided one says so, a pledge says it is still to be paid, the rest are received. */
export function donationStatusLabel(donation: DonationLike): string {
  if (donation.isVoided) return 'Voided';
  if (donation.isPledge) return 'Pledged';
  if (donation.status === 'partial') return 'Part paid';
  return 'Received';
}

/** The key `StatusChip` understands for a donation. */
export function donationStatusKey(donation: DonationLike): string {
  if (donation.isVoided) return 'cancelled';
  if (donation.isPledge) return 'pending';
  return donation.status === 'partial' ? 'partial' : 'paid';
}

/** A receipt is for money received, so a pledge with nothing paid has none yet. */
export const donationHasReceipt = (donation: DonationLike): boolean => !donation.isVoided && !donation.isPledge;

/** The receipt as plain text for the phone's share sheet. An anonymous donor is already "Anonymous Donor" from the API. */
export function receiptShareText(receipt: DonationReceiptDTO): string {
  const lines = [
    receipt.association.name,
    `Donation receipt ${receipt.receiptNumber}`,
    `Date: ${formatDate(receipt.donationDate, 'long')}`,
    `From: ${receipt.donor.name}`,
    `Cause: ${receipt.category}`,
  ];
  if (receipt.allocation) lines.push(`Fund: ${receipt.allocation.name}`);
  lines.push(`Amount: ${formatMoney(receipt.amount)}`);
  if (receipt.paymentMethod && receipt.paymentMethod !== 'N/A') lines.push(`Paid by: ${receipt.paymentMethod.replace(/_/g, ' ')}`);
  if (receipt.donorMessage) lines.push(`Message: ${receipt.donorMessage}`);
  lines.push('Thank you for your generosity.');
  return lines.join('\n');
}

// ---------------------------------------------------------------- penalties

/** "₦500.00 flat" or "5% of what is owed (at most ₦2,000.00)". */
export function ruleFeeLabel(rule: Pick<PenaltyRuleDTO, 'feeType' | 'feeAmount' | 'maxFeeAmount'>): string {
  if (rule.feeType === 'percentage') {
    const cap = rule.maxFeeAmount === null ? '' : ` (at most ${formatMoney(rule.maxFeeAmount)})`;
    return `${Number(rule.feeAmount)}% of what is owed${cap}`;
  }
  return `${formatMoney(rule.feeAmount)} flat`;
}

/** "After 7 days · once" or "After 7 days · repeats every 30 days". */
export function ruleScheduleLabel(rule: Pick<PenaltyRuleDTO, 'gracePeriodDays' | 'isCompounding' | 'compoundingDays'>): string {
  const after = rule.gracePeriodDays === 0 ? 'Straight away' : `After ${rule.gracePeriodDays} ${rule.gracePeriodDays === 1 ? 'day' : 'days'}`;
  return `${after} · ${rule.isCompounding ? `repeats every ${rule.compoundingDays ?? 30} days` : 'once'}`;
}

/** What a rule covers: its own category, or every due and levy. */
export const ruleScopeLabel = (rule: Pick<PenaltyRuleDTO, 'category'>): string => (rule.category ? rule.category.name : 'All dues and levies');

type PenaltyChargeLike = Pick<ChargeListItemDTO, 'isVoided' | 'status' | 'balance'> & { category: { type: string } };

/** A penalty can be waived while it is a live penalty charge with something still owed. */
export function penaltyCanWaive(charge: PenaltyChargeLike): boolean {
  return charge.category.type === 'penalty' && !charge.isVoided && charge.status !== 'waived' && Number(charge.balance) > 0;
}

/** The toast after a waiver. */
export function waiveOutcomeSummary(result: { newAmount: number; fullyWaived: boolean }): string {
  return result.fullyWaived ? 'Penalty waived in full' : `Penalty reduced — ${formatMoney(result.newAmount)} is still owed`;
}

/** The toast after applying late fees. */
export function lateFeeOutcomeSummary(result: { applied: number; totalAmount: number }): string {
  if (result.applied === 0) return 'No late fees were due.';
  return `Charged ${result.applied} late ${result.applied === 1 ? 'fee' : 'fees'} · ${formatMoney(result.totalAmount)}`;
}

/** The preview's headline: how many charges, to how many members, for how much. */
export function lateFeePreviewHeadline(preview: { count: number; memberCount: number; totalAmount: number }): string {
  if (preview.count === 0) return 'No late fees are due right now.';
  return `${preview.count} late ${preview.count === 1 ? 'fee' : 'fees'} for ${preview.memberCount} ${preview.memberCount === 1 ? 'member' : 'members'} · ${formatMoney(preview.totalAmount)}`;
}
