import type { ChargeDetailDTO, ChargeKind, ChargeListItemDTO, ChargeStatus, ManualPaymentMethod } from '@/types/api/financeManage';

type ChargeLike = Pick<ChargeListItemDTO, 'status' | 'isVoided' | 'totalPaid' | 'balance'>;

export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  pending: 'Unpaid',
  partial: 'Part paid',
  paid: 'Paid',
  overdue: 'Overdue',
};

export const CHARGE_STATUS_OPTIONS: ChargeStatus[] = ['pending', 'partial', 'overdue', 'paid'];

export const CHARGE_KIND_LABELS: Record<ChargeKind, string> = {
  due: 'Dues',
  levy: 'Levies',
  penalty: 'Penalties',
  donation: 'Donations',
};

export const CHARGE_KIND_OPTIONS: ChargeKind[] = ['due', 'levy', 'penalty', 'donation'];

export const PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  mobile_money: 'Mobile money',
  cheque: 'Cheque',
  other: 'Other',
};

export const PAYMENT_METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABELS) as ManualPaymentMethod[]).map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));

/** What to show for a charge's state: a voided charge reads "Voided" whatever its old status was. */
export function chargeStatusLabel(charge: Pick<ChargeLike, 'status' | 'isVoided'>): string {
  if (charge.isVoided) return 'Voided';
  return CHARGE_STATUS_LABELS[charge.status as ChargeStatus] ?? charge.status;
}

/** The key `StatusChip` understands for a charge. */
export function chargeStatusKey(charge: Pick<ChargeLike, 'status' | 'isVoided'>): string {
  return charge.isVoided ? 'cancelled' : charge.status;
}

const paid = (charge: ChargeLike) => Number(charge.totalPaid) > 0;

/** Editing is only for a charge nothing has been paid on (the API refuses otherwise). */
export const chargeCanEdit = (charge: ChargeLike) => !charge.isVoided && !paid(charge);

/** Void-and-replace is for a charge that has payments on it. */
export const chargeCanVoid = (charge: ChargeLike) => !charge.isVoided && paid(charge);

/**
 * Deleting is only offered for a charge with no payments. Undo restores the charge but not its payments, so deleting a paid
 * charge could lose money that can't be brought back from the app.
 */
export const chargeCanDelete = (charge: ChargeLike) => !charge.isVoided && !paid(charge);

/** A payment can be recorded while something is still owed and the charge wasn't voided. */
export const chargeCanPay = (charge: ChargeLike) => !charge.isVoided && Number(charge.balance) > 0;

export function chargeMemberName(charge: Pick<ChargeListItemDTO | ChargeDetailDTO, 'member'>): string {
  return `${charge.member.firstName} ${charge.member.lastName}`.trim();
}

/** The collection rate: how much of what was billed has been collected. 0 when nothing has been billed. */
export function collectionRate(collected: number, outstanding: number): number {
  const total = collected + outstanding;
  if (total <= 0) return 0;
  return Math.round((collected / total) * 100);
}
