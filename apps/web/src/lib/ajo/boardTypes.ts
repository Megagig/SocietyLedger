/**
 * What the Circle board API sends (spec §16.4). These are the member-safe shapes: names are already display names, there is no phone,
 * email, address, bank account, guarantor, note or proof link, and money is a kobo string. Do not add personal fields here.
 */

export type PaymentStatus = 'PAID_ON_TIME' | 'PAID_LATE' | 'REPORTED' | 'DUE' | 'OVERDUE' | 'MISSED' | 'UNDER_REVIEW' | 'WAIVED' | 'UPCOMING';
export type StatusCounts = Record<PaymentStatus, number>;

export type RoundSummaryDTO = {
  expectedCount: number;
  paidCount: number;
  expectedKobo: string;
  collectedKobo: string;
  collectionBps: number | null;
  counts: StatusCounts;
};

export type PayoutPositionStatus = 'UPCOMING' | 'PREPARED' | 'APPROVED' | 'PAID' | 'HELD';

export type BoardStatusDTO = { status: PaymentStatus; label: string; graceEndsOn: string | null; behindKobo: string; daysLate: number };

export type BoardOverviewDTO = {
  header: { name: string; status: string; round: number; totalRounds: number; contributionPerShareKobo: string; frequency: string; cadence: string; startDate: string; endsOn: string | null; timezone: string; cutoffTime: string };
  thisRound: RoundSummaryDTO & { round: number; dueDate: string | null; dueIn: string | null; rows: number };
  upNext: { position: number; recipient: string; isYou: boolean; scheduledOn: string | null; status: PayoutPositionStatus; holdReason: string | null } | null;
  you: { thisRound: BoardStatusDTO | null; shares: number; positions: Array<{ position: number; scheduledOn: string | null; status: PayoutPositionStatus }>; behindKobo: string; upToDate: boolean } | null;
  health: { collectionBps: number | null; onTimeBps: number | null; roundsCompleted: number; totalRounds: number; payoutsRecordedCount: number; payoutsRecordedKobo: string };
  visibility: { anonymisedUntilAccepted: boolean };
};

export type BoardRoundDTO = {
  round: number;
  totalRounds: number;
  isCurrent: boolean;
  dueDate: string;
  timezone: string;
  summary: RoundSummaryDTO;
  people: Array<BoardStatusDTO & { membershipId: number; name: string; isYou: boolean; shares: number; amountKobo: string; datePaid: string | null; confirmedAt: string | null; method: 'CASH' | 'TRANSFER' | null; receiptLast4: string | null }>;
};

export type BoardMatrixDTO = {
  timezone: string;
  rounds: Array<{ round: number; dueDate: string } & RoundSummaryDTO>;
  members: Array<{ membershipId: number; name: string; isYou: boolean; shares: number; roundsPaid: number; roundsDue: number; cells: Array<{ round: number; status: PaymentStatus; label: string; datePaid: string | null }> }>;
};

export type BoardPayoutsDTO = {
  timezone: string;
  drawn: boolean;
  draw: { drawnAt: string; seed: string | null; howToCheck: string } | null;
  rows: Array<{ position: number; shareNo: number; recipient: string; isYou: boolean; scheduledOn: string | null; status: PayoutPositionStatus; holdReason: string | null; potKobo: string; recordedAt: string | null; referenceLast4: string | null; recordedBy: string | null; approvedBy: string | null }>;
  changes: Array<{ id: number; type: 'SWAP' | 'EXCEPTION'; at: string; approvedBy: string | null; reason: string | null; summary: string; people: string[] }>;
};

export type BoardMembersDTO = {
  counts: { members: number; shares: number; verified: number };
  people: Array<{ membershipId: number; name: string; isYou: boolean; joinedOn: string | null; shares: number; positions: number[]; status: 'Active' | 'Pending' | 'Left'; verified: boolean }>;
};

export type BoardArrearsRowDTO = { membershipId: number; name: string; isYou: boolean; roundsMissed: number; behindKobo: string; behindText: string; daysOverdue: number; status: 'Overdue' | 'Repayment plan agreed' | 'Under review'; afterPayoutRound: number | null };

export type BoardArrearsDTO = {
  behind: BoardArrearsRowDTO[];
  afterPayout: Array<BoardArrearsRowDTO & { text: string }>;
  lateFees: { chargedKobo: string; waivedKobo: string; paidKobo: string };
  confirmation: { waitingCount: number; oldestDays: number | null; targetHours: number; pastTargetCount: number };
};

export type BoardMetricsDTO = {
  perRound: Array<{ round: number; dueDate: string; expectedKobo: string; collectedKobo: string; onTimeBps: number | null }>;
  cumulative: Array<{ round: number; contributionsKobo: string; payoutsKobo: string }>;
  recordedBalance: { kobo: string; caption: string };
  statusMix: Partial<Record<PaymentStatus, number>>;
  payoutPunctuality: { paidCount: number; onScheduleCount: number; onScheduleBps: number | null };
  averageDaysLate: number | null;
  membersUpToDate: { upToDate: number; total: number };
  totalBehindKobo: string;
  nextPayout: { position: number; scheduledOn: string; daysTo: number } | null;
};

export type BoardActivityDTO = { timezone: string; entries: Array<{ at: string; kind: string; text: string }>; nextBefore: string | null };
