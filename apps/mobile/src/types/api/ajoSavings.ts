/**
 * A collector-thrift saver's own view (spec §16.6). Same shapes as apps/web `savingsHooks.ts`. Their own records only; money is a kobo
 * string.
 */
import type { PaymentStatus } from './ajoBoard';

export type SavingsDTO = {
  membershipId: number;
  groupName: string;
  cycleNo: number;
  amountKobo: string;
  cadence: string;
  startsOn: string;
  endsOn: string | null;
  timezone: string;
  saved: { savedKobo: string; carriedKobo: string; heldKobo: string; reportedKobo: string };
  progress: { total: number; made: number; missed: number; toGo: number };
  pace: { expectedToDateKobo: string; behindKobo: string; upToDate: boolean };
  receive: { savedKobo: string; feeKobo: string; netKobo: string; feeText: string; cycleEnds: string | null; text: string };
  payout: { state: 'UPCOMING' | 'PREPARED' | 'APPROVED' | 'PAID' | 'HELD' | 'CONTINUING'; holdReason: string | null; paidAt: string | null; referenceLast4: string | null; netKobo: string | null; willBe: 'WITHDRAW' | 'CONTINUE' };
  cycleChoice: { choice: 'PENDING' | 'WITHDRAW' | 'CONTINUE'; effective: 'WITHDRAW' | 'CONTINUE'; promptOpen: boolean };
  calendar: { id: number; dueDate: string; amountKobo: string; paidKobo: string; status: PaymentStatus; label: string; graceEndsOn: string | null; behindKobo: string; datePaid: string | null }[];
};

export type SavingsPaymentsDTO = {
  timezone: string;
  payments: { id: number; receivedAt: string; amountKobo: string; method: 'CASH' | 'TRANSFER'; status: string; reversed: boolean; counts: boolean; label: string; recordedBy: string; confirmedAt: string | null; confirmedBy: string | null; receiptNumber: string; canDownloadReceipt: boolean }[];
};

export type CashStage = 'RECORDED' | 'HANDED_IN' | 'CONFIRMED' | 'REJECTED' | 'REVERSED';

export type CashTrackerDTO = {
  timezone: string;
  targets: { handInHours: number; officeConfirmHours: number };
  payments: {
    id: number;
    amountKobo: string;
    stage: CashStage;
    recorded: { by: string; at: string };
    handedIn: { at: string; forDate: string } | null;
    confirmed: { by: string; at: string } | null;
    missingFromHandover: boolean;
    late: { step: 'HANDED_IN' | 'CONFIRMED'; text: string } | null;
    queryInstallmentId: number | null;
  }[];
};

export type CollectorInfoDTO = {
  collector: { name: string; initials: string; phone: string | null; since: string; dailyTargetKobo: string | null; lastVisitAt: string | null } | null;
  fee: { type: string; text: string };
};

export type RecordDTO = {
  trust: { band: string; onTimeCount: number; dueCount: number; onTimePercent: number | null; text: string };
  streak: number;
  pastCycles: { cycleNo: number; amountKobo: string; savedKobo: string; carriedInKobo: string; feeKobo: string; receivedKobo: string | null; payoutDate: string | null; choice: string }[];
};
