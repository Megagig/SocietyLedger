'use client';

/**
 * A collector-thrift saver's own view (spec §16.6): savings, calendar, payments, where the cash is, collector, record, and the statement
 * and receipt downloads. Their own records only; the API refuses anyone else.
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';

type Envelope<T> = { success: boolean; data: T };
const get = async <T>(url: string): Promise<T> => ((await api.get(url)) as { data: Envelope<T> }).data.data;

export type SavingsStatus = 'PAID_ON_TIME' | 'PAID_LATE' | 'REPORTED' | 'DUE' | 'OVERDUE' | 'MISSED' | 'UNDER_REVIEW' | 'WAIVED' | 'UPCOMING';

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
  calendar: Array<{ id: number; dueDate: string; amountKobo: string; paidKobo: string; status: SavingsStatus; label: string; graceEndsOn: string | null; behindKobo: string; datePaid: string | null }>;
};

export type SavingsPaymentsDTO = {
  timezone: string;
  payments: Array<{ id: number; receivedAt: string; amountKobo: string; method: 'CASH' | 'TRANSFER'; status: string; reversed: boolean; counts: boolean; label: string; recordedBy: string; confirmedAt: string | null; confirmedBy: string | null; receiptNumber: string; canDownloadReceipt: boolean }>;
};

export type CashStage = 'RECORDED' | 'HANDED_IN' | 'CONFIRMED' | 'REJECTED' | 'REVERSED';
export type CashTrackerDTO = {
  timezone: string;
  targets: { handInHours: number; officeConfirmHours: number };
  payments: Array<{
    id: number;
    amountKobo: string;
    stage: CashStage;
    recorded: { by: string; at: string };
    handedIn: { at: string; forDate: string } | null;
    confirmed: { by: string; at: string } | null;
    missingFromHandover: boolean;
    late: { step: 'HANDED_IN' | 'CONFIRMED'; text: string } | null;
    queryInstallmentId: number | null;
  }>;
};

export type CollectorInfoDTO = {
  collector: { name: string; initials: string; phone: string | null; since: string; dailyTargetKobo: string | null; lastVisitAt: string | null } | null;
  fee: { type: string; text: string };
};

export type RecordDTO = {
  trust: { band: string; onTimeCount: number; dueCount: number; onTimePercent: number | null; text: string };
  streak: number;
  pastCycles: Array<{ cycleNo: number; amountKobo: string; savedKobo: string; carriedInKobo: string; feeKobo: string; receivedKobo: string | null; payoutDate: string | null; choice: string }>;
};

const useOwn = <T,>(name: string, membershipId: number, path: string) => useQuery({ queryKey: ['ajo', name, membershipId], queryFn: () => get<T>(`/ajo/memberships/${membershipId}/${path}`), enabled: membershipId > 0 });

export const useSavings = (membershipId: number) => useOwn<SavingsDTO>('savings', membershipId, 'savings');
export const useSavingsPayments = (membershipId: number) => useOwn<SavingsPaymentsDTO>('savings-payments', membershipId, 'payments');
export const useCashTracker = (membershipId: number) => useOwn<CashTrackerDTO>('savings-cash', membershipId, 'cash');
export const useCollectorInfo = (membershipId: number) => useOwn<CollectorInfoDTO>('savings-collector', membershipId, 'collector');
export const useSavingsRecord = (membershipId: number) => useOwn<RecordDTO>('savings-record', membershipId, 'record');

/** Save a file the API generated (a statement or a receipt). The sign-in header travels with the request, so a plain link would not work. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = (await api.get(path, { responseType: 'blob' })) as { data: Blob; headers?: Record<string, string> };
  const disposition = response.headers?.['content-disposition'] ?? '';
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
