'use client';

/**
 * Recording received payments from the officer screens, and exporting the "who has paid" lists. One dialog serves the levy campaign,
 * Member Ledgers, Donations and Penalties; the server does all the checking (balance, partial payments, own-debt rule) and says which
 * charge it stopped on, so nothing here repeats a rule.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateFor } from '@societyledger/query';
import api from '@/lib/axios';
import { useQueryScope, useScopedQuery } from '@/lib/query';

export type SettlementFilter = 'all' | 'paid' | 'part' | 'unpaid' | 'owing';
export type Settlement = 'paid' | 'part' | 'unpaid';
export type PaymentSource = 'levy-campaign' | 'member-ledger' | 'donations' | 'penalties';
export type CollectionScreen = PaymentSource;

export const SETTLEMENT_TABS: Array<{ value: SettlementFilter; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'owing', label: 'Yet to pay' },
  { value: 'unpaid', label: 'Not paid' },
  { value: 'part', label: 'Part paid' },
  { value: 'paid', label: 'Paid' },
];

/** The member-ledger screen has only two real states, so it offers fewer tabs. */
export const LEDGER_TABS: Array<{ value: SettlementFilter; label: string }> = [
  { value: 'all', label: 'Everyone' },
  { value: 'owing', label: 'Owing' },
  { value: 'paid', label: 'Cleared' },
];

export const PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export interface OpenCharge {
  transactionId: number;
  kind: 'levy' | 'pledge' | 'penalty' | 'charge';
  label: string;
  category: string;
  /** The campaign, cause or penalty this is for, when more specific than the category. */
  purpose: string | null;
  amount: number;
  paid: number;
  balance: number;
  status: Settlement;
  dueDate: string | null;
}

export interface OpenCharges {
  member: { id: number; memberNumber: string; name: string };
  /** False when this officer is looking at their own debts and the association has not allowed recording them. */
  canRecord: boolean;
  reason: string | null;
  charges: OpenCharge[];
  totalOwed: number;
}

export interface RecordedPayment {
  paymentId: number;
  transactionId: number;
  label: string;
  amountPaid: string | number;
  receiptNumber: string;
  transactionStatus: 'paid' | 'partial';
  remainingBalance: string | number;
}

export interface RecordPaymentsInput {
  items: Array<{ transactionId: number; amountPaid: number }>;
  paymentMethod: string;
  /** ISO date-time. */
  paymentDate?: string;
  notes?: string;
  source: PaymentSource;
}

type Envelope<T> = { success: boolean; message?: string; data: T };

/** The plain-words reason, and which charge it was about, from a refused request. */
export function paymentError(error: unknown): { message: string; code?: string; transactionId?: number } {
  const body = (error as { response?: { data?: { message?: string; code?: string; transactionId?: number } } })?.response?.data;
  return { message: body?.message || 'We could not record that payment. Nothing was saved. Please try again.', code: body?.code, transactionId: body?.transactionId };
}

export const collectionsApi = {
  openCharges: async (memberId: number) => (await api.get<Envelope<OpenCharges>>(`/finance/collections/members/${memberId}/open-charges`)).data.data,
  record: async (input: RecordPaymentsInput) => (await api.post<Envelope<{ payments: RecordedPayment[] }>>('/finance/payments/batch', input)).data.data.payments,
};

export const useOpenCharges = (memberId: number | null) =>
  useScopedQuery({
    domain: 'payments',
    parts: ['open-charges', memberId ?? 'none'],
    queryFn: () => collectionsApi.openCharges(memberId as number),
    enabled: memberId !== null,
  });

/** Records the payments, then refreshes everything that shows that money (dues, balances, ledgers, dashboards, reports). */
export function useRecordPayments() {
  const queryClient = useQueryClient();
  const { tenant } = useQueryScope();
  return useMutation({
    mutationFn: (input: RecordPaymentsInput) => collectionsApi.record(input),
    onSuccess: () => invalidateFor(queryClient, tenant, 'payment.changed'),
  });
}

export interface ExportParams {
  screen: CollectionScreen;
  format: 'xlsx' | 'pdf';
  status: SettlementFilter;
  search?: string;
  id?: number;
  allocationId?: number;
}

/** Asks the server for the filtered list as a file and saves it. The server builds it, so it holds every row, not just the page on screen. */
export async function downloadCollection(params: ExportParams): Promise<void> {
  const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const response = await api.get<Blob>('/finance/collections/export', { params: query, responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `export.${params.format}`;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A failed export comes back as a blob; read the message out of it. */
export async function exportErrorMessage(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string };
      if (parsed.message) return parsed.message;
    } catch {
      /* fall through */
    }
  }
  return 'We could not create the file. Please try again.';
}
