import type { AgingBucketKey, ChargeCategoryType, ChargeListParams, ChargeScope, ChargeStatusFilter, PaymentListParams } from '@/types/api/reports';

/**
 * Drill-down: every figure on a report opens the records that add up to it. A figure's screen builds a link with `chargesHref` or
 * `paymentsHref`; the list screens read it back with `parseChargeParams` / `parsePaymentParams`. The filters are the ones the
 * reports themselves use, so the list's total equals the figure that was tapped.
 */

const BASE = '/(app)/(tabs)/manage/reports';

function query(values: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function chargesHref(params: ChargeListParams, title: string): string {
  return `${BASE}/charges${query({ ...params, title })}`;
}

export function paymentsHref(params: PaymentListParams, title: string): string {
  return `${BASE}/payments${query({ ...params, title })}`;
}

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
const num = (v: string | string[] | undefined): number | undefined => {
  const n = Number(one(v));
  return one(v) !== undefined && Number.isFinite(n) ? n : undefined;
};

export function parseChargeParams(raw: Raw): ChargeListParams {
  const scope = (one(raw.scope) as ChargeScope | undefined) ?? 'owing';
  return {
    scope,
    startDate: one(raw.startDate),
    endDate: one(raw.endDate),
    categoryId: num(raw.categoryId),
    categoryType: one(raw.categoryType) as ChargeCategoryType | undefined,
    memberId: num(raw.memberId),
    bucket: one(raw.bucket) as AgingBucketKey | undefined,
    asOfDate: one(raw.asOfDate),
    status: one(raw.status) as ChargeStatusFilter | undefined,
    owingOnly: one(raw.owingOnly) === 'true' ? true : undefined,
  };
}

export function parsePaymentParams(raw: Raw): PaymentListParams {
  return {
    paymentMethod: one(raw.paymentMethod),
    startDate: one(raw.startDate),
    endDate: one(raw.endDate),
    categoryId: num(raw.categoryId),
    categoryType: one(raw.categoryType) as ChargeCategoryType | undefined,
    memberId: num(raw.memberId),
  };
}

/** Where a single charge opens: the Finance charge screen. */
export const chargeHref = (id: number): string => `/(app)/(tabs)/manage/finance/transactions/${id}`;
/** Where a member's whole account opens: their ledger. */
export const ledgerHref = (memberId: number): string => `/(app)/(tabs)/manage/finance/ledgers/${memberId}`;
