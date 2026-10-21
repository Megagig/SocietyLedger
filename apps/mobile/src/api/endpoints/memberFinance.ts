import { client } from '../client';
import { unwrap } from '../envelope';
import { toDecimal } from '@/lib/money';
import type { FinanceSummaryDTO, MemberPaymentsResponseDTO } from '@/types/api/memberFinance';

/** `/members/me/*` — no `X-Tenant` needed (api-contract.md §4). Only what H1 needs so far;
 * `/outstanding`, `/pay`, `/dues` etc. land here as F2.6+ build them. */
export const memberFinanceApi = {
  /** GET /members/me/finance-summary — verified against member-finance.controller.ts
   * getFinanceSummary (2026-10-20). */
  async getFinanceSummary(): Promise<FinanceSummaryDTO> {
    return unwrap<FinanceSummaryDTO>(client.get('/members/me/finance-summary'));
  },

  /** GET /members/me/payments — verified against member-finance.controller.ts getPayments
   * (2026-10-20). Returns every payment ever made, newest first — no server-side limit; the
   * caller slices. Converts `amount` to `Decimal` at this boundary layer, same as every other
   * money field, even though the server already sends it as a plain number here. */
  async getPayments() {
    const data = await unwrap<MemberPaymentsResponseDTO>(client.get('/members/me/payments'));
    return data.payments.map((payment) => ({ ...payment, amount: toDecimal(payment.amount) }));
  },
};
