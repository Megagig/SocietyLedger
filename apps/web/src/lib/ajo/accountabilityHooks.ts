'use client';

/** Officer accountability (spec §16.7): the report, for officers only. The API refuses anyone else. */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

type Envelope<T> = { success: boolean; data: T };

export type AccountabilityDTO = {
  groupId: number;
  groupName: string;
  model: 'COLLECTOR_THRIFT' | 'ROTATING_POT';
  timezone: string;
  separation: {
    flaggedCount: number;
    payouts: Array<{ id: number; recipient: string; round: number | null; cycleNo: number | null; netKobo: string; status: string; preparedBy: string | null; approvedBy: string | null; recordedPaidBy: string | null; preparedAt: string; approvedAt: string | null; paidAt: string | null; singleAdminApproval: boolean; sameRecorder: boolean }>;
  };
  backlog: {
    total: number;
    targetHours: number;
    pastTarget: number;
    oldestHours: number | null;
    buckets: Array<{ key: string; label: string; count: number }>;
    oldest: Array<{ id: number; member: string; amountKobo: string; method: 'CASH' | 'TRANSFER'; status: string; ageHours: number; receivedAt: string }>;
  };
  cash: Array<{ id: number; date: string; collector: string | null; expectedKobo: string; collectedKobo: string; handedOverKobo: string; countedKobo: string | null; differenceKobo: string; countDifferenceKobo: string | null; reconciled: boolean; reconciledBy: string | null; reconciledAt: string | null }> | null;
  exceptions: Array<{ at: string; kind: 'REVERSAL' | 'WAIVER' | 'ORDER_CHANGE' | 'RULES' | 'PAYOUT_VOIDED' | 'PAYOUT_REVERSED'; text: string; reason: string | null; by: string | null }>;
};

export const useAccountability = (groupId: number) =>
  useQuery({ queryKey: ['ajo', 'accountability', groupId], queryFn: async () => ((await api.get(`/ajo/groups/${groupId}/accountability`)) as { data: Envelope<AccountabilityDTO> }).data.data, enabled: groupId > 0, staleTime: 30_000 });
