import { useQuery } from '@tanstack/react-query';
import { bff } from '@/lib/bff';

/** Types and helpers for the Ajo screens in the admin console (T9). Money is whole kobo from the API; show it with formatKobo. */

export const ajoKeys = {
  me: ['admin', 'me'] as const,
  verifications: (qs: string) => ['ajo', 'verifications', qs] as const,
  verification: (id: number) => ['ajo', 'verification', id] as const,
  groups: (qs: string) => ['ajo', 'groups', qs] as const,
  group: (id: number) => ['ajo', 'group', id] as const,
  analytics: ['ajo', 'analytics'] as const,
  pricing: ['ajo', 'pricing'] as const,
};

export const REVIEW_ROLES = ['SUPER_ADMIN', 'COMPLIANCE_ADMIN'] as const;

/** The signed-in staff member's platform role. The API enforces permissions; this only decides which buttons to show. */
export function useAdminRole() {
  const q = useQuery({ queryKey: ajoKeys.me, queryFn: () => bff<{ platformRole: string }>('admin/me'), staleTime: 5 * 60_000 });
  return { role: q.data?.platformRole ?? null, isLoading: q.isLoading };
}

export const jsonPost = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const errMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

export interface VerificationRow {
  id: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  association: { id: number; name: string };
  memberId: number;
  name: string;
  hasPayoutAccount: boolean;
  payoutAccount: { bankName: string; masked: string } | null;
}

export interface VerificationList {
  total: number;
  items: VerificationRow[];
}

export interface VerificationDetail {
  id: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  reviewedAt: string | null;
  association: { id: number; name: string };
  current: {
    name: string;
    phone: string | null;
    address: string | null;
    payoutAccountName: string | null;
    payoutAccount: { bankName: string; masked: string; changedAt: string | null } | null;
  };
  checklist: { nameMatchesAccount: boolean | null; phoneConfirmed: boolean | null; addressFilled: boolean | null };
  history: { id: number; status: string; rejectionReason: string | null; reviewedAt: string | null; createdAt: string }[];
}

export const OVERRIDE_ROLES = ['SUPER_ADMIN', 'FINANCE_ADMIN'] as const;

export interface GroupRow {
  id: number;
  name: string;
  association: { id: number; name: string; kind: 'ASSOCIATION' | 'THRIFT_GROUP'; status: string };
  model: 'COLLECTOR_THRIFT' | 'ROTATING_POT';
  status: string;
  frequency: string;
  contributionKobo: number;
  participants: number;
  maxParticipants: number;
  openPayouts: number;
  openCases: number;
  tier: { code: string; name: string } | null;
  createdAt: string;
}

export interface GroupList {
  total: number;
  items: GroupRow[];
}

export interface TierOption {
  addonId: number;
  code: string;
  name: string;
  priceMonthlyKobo: number;
  priceAnnualKobo: number;
  contributorLimit: number | null;
}

export interface GroupDetail {
  id: number;
  name: string;
  association: { id: number; name: string; kind: 'ASSOCIATION' | 'THRIFT_GROUP'; status: string; subdomain: string };
  model: 'COLLECTOR_THRIFT' | 'ROTATING_POT';
  status: string;
  frequency: string;
  contributionKobo: number;
  maxParticipants: number;
  startDate: string;
  startedAt: string | null;
  cancelReason: string | null;
  members: Record<string, number>;
  payouts: { id: number; name: string; round: number | null; cycleNo: number; status: string; netKobo: number; preparedAt: string; paidAt: string | null; voidReason: string | null }[];
  cases: { id: number; name: string; status: string; outstandingKobo: number; openedAt: string }[];
  tier: {
    current: { addonId: number; code: string; name: string; endsAt: string; paid: boolean; pendingAddonId: number | null; contributorLimit: number | null } | null;
    activeContributors: number;
    options: TierOption[];
  };
  levy: { associations: { totals: Record<string, { count: number; kobo: string }> }[]; totals: Record<string, { kobo: string; amount: string }> };
}

export interface TierPreview {
  direction: 'UPGRADE' | 'DOWNGRADE' | 'SAME' | 'NEW';
  timing: 'NOW' | 'PERIOD_END';
  blockers: string[];
  effectiveAt: string | null;
  from: string | null;
  to: string;
}

export const MODEL_LABEL = { COLLECTOR_THRIFT: 'Collector thrift', ROTATING_POT: 'Rotating pot' } as const;
export const KIND_LABEL = { ASSOCIATION: 'Association', THRIFT_GROUP: 'Standalone thrift group' } as const;

export interface AjoAnalytics {
  asOf: string;
  adoption: {
    tiers: { code: string; name: string; holders: number; paying: number; standalone: number; monthlyRecurringKobo: number }[];
    holders: number;
    paying: number;
    owners: { associations: number; standalone: number };
    groups: { byStatus: Record<string, number>; byModel: Record<string, number> };
  };
  contributors: { windowDays: number; active: number; previousWindow: number };
  revenue: {
    subscriptionMonthlyKobo: number;
    levy: { accruedKobo: number; billedKobo: number; paidKobo: number; waivedKobo: number };
    levySeries: { month: string; kobo: number }[];
  };
}
