import { client } from '../client';
import { unwrap } from '../envelope';
import { toDecimal } from '@/lib/money';
import type {
  DonateRequestDTO,
  DonationsResponseDTO,
  DuesResponseDTO,
  FinanceSummaryDTO,
  LeviesResponseDTO,
  MemberPaymentsResponseDTO,
  OutstandingResponseDTO,
  PaymentInfoDTO,
  PenaltiesResponseDTO,
} from '@/types/api/memberFinance';

/** `/members/me/*` — no `X-Tenant` needed (api-contract.md §4). */
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

  /** GET /members/me/outstanding — no pagination (api-contract.md §10). */
  async getOutstanding() {
    const data = await unwrap<OutstandingResponseDTO>(client.get('/members/me/outstanding'));
    return data.items.map((item) => ({
      ...item,
      amount: toDecimal(item.amount),
      balance: toDecimal(item.balance),
    }));
  },

  /** GET /members/me/dues — all dues for this member, newest first. Amounts are already
   * Number() server-side but we run through toDecimal() for consistency. */
  async getDues() {
    const data = await unwrap<DuesResponseDTO>(client.get('/members/me/dues'));
    return data.dues.map((d) => ({
      ...d,
      amount: toDecimal(d.amount),
      paid: toDecimal(d.paid),
      balance: toDecimal(d.balance),
      payments: d.payments.map((p) => ({ ...p, amount: toDecimal(p.amount) })),
    }));
  },

  /** GET /members/me/levies — all levy assignments for this member. */
  async getLevies() {
    const data = await unwrap<LeviesResponseDTO>(client.get('/members/me/levies'));
    return data.levies.map((l) => ({
      ...l,
      amount: toDecimal(l.amount),
      paid: toDecimal(l.paid),
      balance: toDecimal(l.balance),
    }));
  },

  /** GET /members/me/penalties — all penalties for this member, newest first. */
  async getPenalties() {
    const data = await unwrap<PenaltiesResponseDTO>(client.get('/members/me/penalties'));
    return data.penalties.map((p) => ({
      ...p,
      amount: toDecimal(p.amount),
      paid: toDecimal(p.paid),
      balance: toDecimal(p.balance),
      payments: p.payments.map((pay) => ({ ...pay, amount: toDecimal(pay.amount) })),
    }));
  },

  /** GET /members/me/donations — member's donation history + donation categories for the
   * cause picker (donationCategories[] is the member-safe source, matching web). */
  async getDonations() {
    const data = await unwrap<DonationsResponseDTO>(client.get('/members/me/donations'));
    return {
      donations: data.donations.map((d) => ({
        ...d,
        amount: toDecimal(d.amount),
      })),
      donationCategories: data.donationCategories,
    };
  },

  /** POST /members/me/donate — submit a donation. */
  async makeDonation(body: DonateRequestDTO) {
    return unwrap(client.post('/members/me/donate', body));
  },

  /** GET /members/me/payment-info — F2.8/F2.9: paystackEnabled flag + active bank accounts. */
  async getPaymentInfo(): Promise<PaymentInfoDTO> {
    return unwrap<PaymentInfoDTO>(client.get('/members/me/payment-info'));
  },

  /** POST /payments/paystack/initialize — F2.8: start a Paystack checkout for a transaction. */
  async initializePaystackPayment(transactionId: number, callbackUrl: string) {
    return unwrap<{ reference: string; authorizationUrl: string; amount: number }>(
      client.post('/payments/paystack/initialize', { transactionId, callbackUrl })
    );
  },

  /** GET /payments/paystack/verify/:reference — F2.8: confirm outcome after browser returns. */
  async verifyPaystackPayment(reference: string) {
    return unwrap<{
      status: 'success' | 'failed';
      reference: string;
      amount: number;
      receiptNumber?: string;
      transactionId?: number;
      transactionStatus?: string;
      paidAt?: string;
      gatewayResponse?: string;
    }>(client.get(`/payments/paystack/verify/${reference}`));
  },
};
