import type { LedgerStatementDTO } from '@/types/api/ledgerManage';

/** What a balance means: positive is owed by the member, negative is credit in their favour. */
export function balanceLabel(balance: number): 'owes' | 'credit' | 'settled' {
  if (balance > 0.004) return 'owes';
  if (balance < -0.004) return 'credit';
  return 'settled';
}

const naira = (n: number) => `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A member's statement as plain text, for the phone's share sheet (WhatsApp, email, notes…). No PDF file is made on the device: the
 * share sheet is the same way members share their own statement.
 */
export function statementShareText(statement: LedgerStatementDTO, associationName?: string): string {
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  const lines = [
    `${associationName ? `${associationName} — ` : ''}Statement of account`,
    `${statement.member.firstName} ${statement.member.lastName} (${statement.member.memberId})`,
    `${day(statement.period.startDate)} to ${day(statement.period.endDate)}`,
    '',
    `Opening balance: ${naira(Number(statement.openingBalance))}`,
    ...statement.entries.map((e) => {
      const debit = Number(e.debit);
      const credit = Number(e.credit);
      const amount = credit > 0 ? `paid ${naira(credit)}` : `charged ${naira(debit)}`;
      return `${day(e.date)} · ${e.description} · ${amount} · balance ${naira(Number(e.balance))}`;
    }),
    '',
    `Total charged: ${naira(Number(statement.totals.totalDebits))}`,
    `Total paid: ${naira(Number(statement.totals.totalCredits))}`,
    `Closing balance: ${naira(Number(statement.closingBalance))}`,
  ];
  return lines.join('\n');
}

export type StatementPreset = { label: string; startDate: string; endDate: string };

/** The ranges an officer can share: this year, the last three months, or everything. */
export function statementPresets(now: Date = new Date()): StatementPreset[] {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  return [
    { label: 'This year', startDate: `${now.getFullYear()}-01-01`, endDate: iso(now) },
    { label: 'Last 3 months', startDate: iso(threeMonthsAgo), endDate: iso(now) },
    { label: 'Everything', startDate: '2000-01-01', endDate: iso(now) },
  ];
}

/** The yyyy-mm-dd day of an ISO timestamp, as the statement endpoint wants it. */
export function toDay(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Why a custom statement range can't be shared yet, or null when it can: both dates chosen, the start not after the end, and
 * neither in the future (a statement can only cover what has happened).
 */
export function customRangeProblem(from: string, to: string, now: Date = new Date()): string | null {
  if (!from || !to) return 'Choose both dates.';
  if (toDay(from) > toDay(to)) return 'The start date must be on or before the end date.';
  const today = now.toISOString().slice(0, 10);
  if (toDay(to) > today) return 'The end date can’t be in the future.';
  return null;
}
