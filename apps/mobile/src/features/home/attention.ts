import { Banknote, FileText, HandHeart, Hourglass, Inbox, LifeBuoy, PiggyBank, ReceiptText, Landmark, Trophy, UserCheck, Vote, Wallet, type LucideIcon } from 'lucide-react-native';

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

/** Only the queues that have a screen in the app are listed here, so a row never links nowhere. */
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
  loanApplications: {
    icon: FileText,
    tone: 'warning',
    label: (n) => `${plural(n, 'loan application', 'loan applications')} to review`,
    href: '/(app)/(tabs)/manage/cooperatives/applications',
  },
  loanRepayments: {
    icon: Wallet,
    tone: 'info',
    label: (n) => `${plural(n, 'loan payment', 'loan payments')} to confirm`,
    href: '/(app)/(tabs)/manage/cooperatives/repayments',
  },
  savingsDeposits: {
    icon: PiggyBank,
    tone: 'info',
    label: (n) => `${plural(n, 'savings deposit', 'savings deposits')} to confirm`,
    href: '/(app)/(tabs)/manage/cooperatives/deposits',
  },
  welfarePayouts: {
    icon: HandHeart,
    tone: 'warning',
    label: (n) => `${plural(n, 'welfare request', 'welfare requests')} to decide`,
    href: '/(app)/(tabs)/manage/welfare/payouts',
  },
  welfareContributions: {
    icon: Inbox,
    tone: 'info',
    label: (n) => `${plural(n, 'welfare contribution', 'welfare contributions')} to confirm`,
    href: '/(app)/(tabs)/manage/welfare/contributions',
  },
  electionNominations: {
    icon: Vote,
    tone: 'warning',
    label: (n) => `${plural(n, 'election nomination', 'election nominations')} to decide`,
    href: '/(app)/(tabs)/manage/elections',
  },
  electionsToClose: {
    icon: Hourglass,
    tone: 'warning',
    label: (n) => `${plural(n, 'election', 'elections')} to close — voting has ended`,
    href: '/(app)/(tabs)/manage/elections',
  },
  electionResults: {
    icon: Trophy,
    tone: 'info',
    label: (n) => `${plural(n, 'election result', 'election results')} to publish`,
    href: '/(app)/(tabs)/manage/elections',
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
