import type { ChargeDetailDTO, ChargeKind, ChargeListItemDTO, ChargeStatus, ManualPaymentMethod } from '@/types/api/financeManage';

type ChargeLike = Pick<ChargeListItemDTO, 'status' | 'isVoided' | 'totalPaid' | 'balance'> & { dueDate?: string | null };

/** A charge still owed and past its due date is overdue, even if its stored status hasn't been updated yet. */
export function isChargeOverdue(charge: Pick<ChargeLike, 'status' | 'isVoided' | 'dueDate'>, now: Date = new Date()): boolean {
  if (charge.isVoided || !charge.dueDate) return false;
  if (!['pending', 'partial', 'overdue'].includes(charge.status)) return false;
  return new Date(charge.dueDate).getTime() < now.getTime();
}

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
export function chargeStatusLabel(charge: Pick<ChargeLike, 'status' | 'isVoided' | 'dueDate'>, now: Date = new Date()): string {
  if (charge.isVoided) return 'Voided';
  if (isChargeOverdue(charge, now)) return CHARGE_STATUS_LABELS.overdue;
  return CHARGE_STATUS_LABELS[charge.status as ChargeStatus] ?? charge.status;
}

/** The key `StatusChip` understands for a charge. */
export function chargeStatusKey(charge: Pick<ChargeLike, 'status' | 'isVoided' | 'dueDate'>, now: Date = new Date()): string {
  if (charge.isVoided) return 'cancelled';
  return isChargeOverdue(charge, now) ? 'overdue' : charge.status;
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

// ---------------------------------------------------------------- reminders

/** Whole days a charge is past its due date (0 when not yet due or no due date). */
export function daysOverdue(dueDate: string | null, now: Date = new Date()): number {
  if (!dueDate) return 0;
  const days = Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86_400_000);
  return days > 0 ? days : 0;
}

/** "Reminded today / yesterday / 3 days ago", or null when they never were. */
export function remindedLabel(lastReminderSentAt: string | null, now: Date = new Date()): string | null {
  if (!lastReminderSentAt) return null;
  const days = Math.floor((now.getTime() - new Date(lastReminderSentAt).getTime()) / 86_400_000);
  if (days <= 0) return 'Reminded today';
  return days === 1 ? 'Reminded yesterday' : `Reminded ${days} days ago`;
}

/** The newest reminder across a member's charges. */
export function lastRemindedAt(transactions: { lastReminderSentAt: string | null }[]): string | null {
  const stamps = transactions.map((t) => t.lastReminderSentAt).filter((v): v is string => v !== null);
  if (stamps.length === 0) return null;
  return stamps.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
}

/** A one-line, honest summary of what a send did, for the toast. */
export function reminderOutcomeSummary(result: { sent: number; failed: number; noContact: number; skippedRecently: number }): string {
  const parts: string[] = [];
  if (result.sent > 0) parts.push(`Reminded ${result.sent} ${result.sent === 1 ? 'member' : 'members'}`);
  if (result.skippedRecently > 0) parts.push(`${result.skippedRecently} ${result.skippedRecently === 1 ? 'charge' : 'charges'} skipped — reminded in the last 24 hours`);
  if (result.noContact > 0) parts.push(`${result.noContact} can't be reached (no email or login)`);
  if (result.failed > 0) parts.push(`${result.failed} failed`);
  return parts.length > 0 ? parts.join(' · ') : 'Nothing was sent.';
}
