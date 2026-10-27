/**
 * Which accounts a member charge and its payment post to. One place, so the charge, the payment, the repair job and the tests cannot
 * disagree again.
 *
 *   charge   (dues, levy, donation, penalty):  debit the receivable, credit the income
 *   payment  (any of them):                    debit the cash or bank account, credit the same receivable
 *
 * A donation follows the same two steps as dues. An instant donation is a charge that is paid at once, so its receivable nets to
 * zero and only the cash and the income remain; an unpaid pledge leaves the amount in Donation Pledges Receivable until it is paid.
 * That receivable then always equals the donation total on the members' ledgers, which is what lets the two be checked against each other.
 */

export type ChargeCategory = 'due' | 'levy' | 'donation' | 'penalty';

export const BANK_OPERATING_CODE = '1112';
export const CASH_IN_HAND_CODE = '1114';
export const DUES_RECEIVABLE_CODE = '1121';
export const LEVY_RECEIVABLE_CODE = '1122';
export const DONATION_PLEDGES_RECEIVABLE_CODE = '1123';
export const DONATION_INCOME_CODE = '4300';

const RECEIVABLE: Record<ChargeCategory, string> = {
  due: DUES_RECEIVABLE_CODE,
  penalty: DUES_RECEIVABLE_CODE,
  levy: LEVY_RECEIVABLE_CODE,
  donation: DONATION_PLEDGES_RECEIVABLE_CODE,
};

const INCOME: Record<ChargeCategory, string> = {
  due: '4110',
  levy: '4200',
  donation: DONATION_INCOME_CODE,
  penalty: '4400',
};

export function isChargeCategory(type: unknown): type is ChargeCategory {
  return type === 'due' || type === 'levy' || type === 'donation' || type === 'penalty';
}

/** The receivable account a charge of this kind sits in until it is paid. Unknown kinds fall back to dues, as payments always have. */
export function receivableCodeFor(categoryType: string | null | undefined): string {
  return isChargeCategory(categoryType) ? RECEIVABLE[categoryType] : DUES_RECEIVABLE_CODE;
}

/** Charge posting: debit receivable, credit income. Null for a kind that has no mapping. */
export function chargeMapping(categoryType: string | null | undefined): { debitCode: string; creditCode: string } | null {
  if (!isChargeCategory(categoryType)) return null;
  return { debitCode: RECEIVABLE[categoryType], creditCode: INCOME[categoryType] };
}
