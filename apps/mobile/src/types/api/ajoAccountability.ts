/** Officer accountability (spec §16.7). Same shapes as apps/web `accountabilityHooks.ts`. Officers only; money is a kobo string. */

export type AccountabilityDTO = {
  groupId: number;
  groupName: string;
  model: 'COLLECTOR_THRIFT' | 'ROTATING_POT';
  timezone: string;
  separation: {
    flaggedCount: number;
    payouts: {
      id: number;
      recipient: string;
      round: number | null;
      cycleNo: number | null;
      netKobo: string;
      status: string;
      preparedBy: string | null;
      approvedBy: string | null;
      recordedPaidBy: string | null;
      preparedAt: string;
      approvedAt: string | null;
      paidAt: string | null;
      singleAdminApproval: boolean;
      sameRecorder: boolean;
    }[];
  };
  backlog: {
    total: number;
    targetHours: number;
    pastTarget: number;
    oldestHours: number | null;
    buckets: { key: string; label: string; count: number }[];
    oldest: { id: number; member: string; amountKobo: string; method: 'CASH' | 'TRANSFER'; status: string; ageHours: number; receivedAt: string }[];
  };
  cash:
    | {
        id: number;
        date: string;
        collector: string | null;
        expectedKobo: string;
        collectedKobo: string;
        handedOverKobo: string;
        countedKobo: string | null;
        differenceKobo: string;
        countDifferenceKobo: string | null;
        reconciled: boolean;
        reconciledBy: string | null;
        reconciledAt: string | null;
      }[]
    | null;
  exceptions: { at: string; kind: 'REVERSAL' | 'WAIVER' | 'ORDER_CHANGE' | 'RULES' | 'PAYOUT_VOIDED' | 'PAYOUT_REVERSED'; text: string; reason: string | null; by: string | null }[];
};
