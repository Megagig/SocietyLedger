import type { AttentionItem, AttentionKey } from '@/lib/api/dashboard';

interface AttentionLine {
  label: (count: number) => string;
  href: string;
  /** Money already late — shown in red. */
  urgent?: boolean;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** How each kind of waiting work is worded, and where its queue lives. */
export const ATTENTION_LINES: Record<AttentionKey, AttentionLine> = {
  memberApprovals: { label: (n) => `${plural(n, 'new member', 'new members')} to approve`, href: '/dashboard/settings/pending-approvals' },
  paymentProofs: { label: (n) => `${plural(n, 'payment proof', 'payment proofs')} to verify`, href: '/dashboard/payments/nigerian/verification' },
  bankTransfers: { label: (n) => `${plural(n, 'bank transfer', 'bank transfers')} to confirm`, href: '/dashboard/payments/nigerian/transfers' },
  cashLodgments: { label: (n) => `${plural(n, 'cash lodgment', 'cash lodgments')} to check`, href: '/dashboard/cash/lodgments' },
  overdueCharges: { label: (n) => `${plural(n, 'charge', 'charges')} overdue`, href: '/dashboard/finance/overdue', urgent: true },
  supportTickets: { label: (n) => `${plural(n, 'support ticket', 'support tickets')} need a reply`, href: '/dashboard/help/tickets' },
  loanApplications: { label: (n) => `${plural(n, 'loan application', 'loan applications')} to review`, href: '/dashboard/cooperatives/applications' },
  loanRepayments: { label: (n) => `${plural(n, 'loan repayment', 'loan repayments')} to confirm`, href: '/dashboard/cooperatives/loan-repayments' },
  savingsDeposits: { label: (n) => `${plural(n, 'savings deposit', 'savings deposits')} to confirm`, href: '/dashboard/cooperatives/savings-deposits' },
  welfarePayouts: { label: (n) => `${plural(n, 'welfare request', 'welfare requests')} to review`, href: '/dashboard/welfare/requests' },
};

export interface AttentionRow extends AttentionLine {
  key: AttentionKey;
  count: number;
}

/** The rows to show: the kinds with something waiting, in the order the API sent them. */
export function attentionRows(items: AttentionItem[] | undefined): AttentionRow[] {
  const rows: AttentionRow[] = [];
  for (const item of items ?? []) {
    const line = ATTENTION_LINES[item.key];
    if (line && item.count > 0) rows.push({ ...line, key: item.key, count: item.count });
  }
  return rows;
}
