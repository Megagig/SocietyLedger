/**
 * Drill-down: every figure on a report opens the records that add up to it. A figure builds a link with `chargesHref` or
 * `paymentsHref`; the list pages read the same filters back. The filters are the ones the reports themselves use, so the list's total
 * equals the figure that was clicked.
 */

export type ChargeDrill = {
  scope: 'raised' | 'owing' | 'overdue' | 'aging';
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  categoryType?: string;
  memberId?: number;
  bucket?: 'notYetDue' | 'current' | 'days31to60' | 'days61to90' | 'over90';
  asOfDate?: string;
  status?: 'paid' | 'partial' | 'pending' | 'overdue' | 'waived';
  owingOnly?: boolean;
};

export type PaymentDrill = {
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  categoryType?: string;
  memberId?: number;
  paymentMethod?: string;
};

function query(values: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== '' && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export const chargesHref = (params: ChargeDrill, title: string): string => `/dashboard/reports/charges${query({ ...params, title })}`;
export const paymentsHref = (params: PaymentDrill, title: string): string => `/dashboard/reports/payments${query({ ...params, title })}`;
export const chargeHref = (id: number): string => `/dashboard/finance/transactions/${id}`;
