import { Banknote, LifeBuoy, ReceiptText, Landmark, UserCheck, Wallet, type LucideIcon } from 'lucide-react-native';

import type { AttentionItemDTO, AttentionKey } from '@/api/endpoints/dashboard';

type IconTone = 'primary' | 'warning' | 'info';

type AttentionLine = {
  icon: LucideIcon;
  tone: IconTone;
  /** Shown in the danger colour (money already late). */
  urgent?: boolean;
  /** "3 payment proofs to verify" */
  label: (count: number) => string;
  /** Where the queue lives in the app. */
  href: string;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Only the queues that have a screen in the app are listed here. Loan applications, loan repayments, savings deposits and
 * welfare payouts are counted by the API but have no mobile queue yet, so they are left out rather than linking nowhere.
 */
export const ATTENTION_LINES: Partial<Record<AttentionKey, AttentionLine>> = {
  memberApprovals: {
    icon: UserCheck,
    tone: 'warning',
    label: (n) => `${plural(n, 'new member', 'new members')} to approve`,
    href: '/(app)/(tabs)/manage/members/approvals',
  },
  paymentProofs: {
    icon: ReceiptText,
    tone: 'warning',
    label: (n) => `${plural(n, 'payment proof', 'payment proofs')} to verify`,
    href: '/(app)/(tabs)/manage/payments/proofs',
  },
  bankTransfers: {
    icon: Landmark,
    tone: 'info',
    label: (n) => `${plural(n, 'bank transfer', 'bank transfers')} to confirm`,
    href: '/(app)/(tabs)/manage/payments/transfers',
  },
  cashLodgments: {
    icon: Banknote,
    tone: 'warning',
    label: (n) => `${plural(n, 'cash lodgment', 'cash lodgments')} to check`,
    href: '/(app)/(tabs)/manage/cash/lodgments',
  },
  overdueCharges: {
    icon: Wallet,
    tone: 'warning',
    urgent: true,
    label: (n) => `${plural(n, 'charge', 'charges')} overdue`,
    href: '/(app)/(tabs)/manage/finance/overdue',
  },
  supportTickets: {
    icon: LifeBuoy,
    tone: 'info',
    label: (n) => `${plural(n, 'support ticket', 'support tickets')} need a reply`,
    href: '/(app)/(tabs)/manage/support',
  },
};

export type AttentionRow = AttentionLine & { key: AttentionKey; count: number };

/** The rows to show on Home: the kinds that have a screen, with something waiting, in the order the API sent them. */
export function attentionRows(items: AttentionItemDTO[] | undefined): AttentionRow[] {
  const rows: AttentionRow[] = [];
  for (const item of items ?? []) {
    const line = ATTENTION_LINES[item.key];
    if (line && item.count > 0) rows.push({ ...line, key: item.key, count: item.count });
  }
  return rows;
}
