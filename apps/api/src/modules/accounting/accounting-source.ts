/**
 * Where a journal entry came from. An entry made by the app itself records the kind and id of the record behind it (a charge, a
 * payment, a welfare payout...). This turns that pair into plain facts for the screen, scoped to the association, and names the
 * ids a screen needs to open the record. An entry typed in by an officer has no source.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';

export type SourceKind =
  | 'charge'
  | 'payment'
  | 'welfare_contribution'
  | 'welfare_payout'
  | 'savings_transaction'
  | 'loan'
  | 'loan_repayment'
  | 'cash_lodgment'
  | 'reversal';

export type EntrySource = {
  kind: SourceKind;
  id: number;
  /** "Charge", "Loan repayment"... */
  title: string;
  /** One plain line: what it was, and for whom. */
  summary: string;
  member: string | null;
  amount: Decimal | null;
  date: Date | null;
  status: string | null;
  reference: string | null;
  /** True when the record can no longer be found (it was removed). The entry stays readable. */
  missing: boolean;
  /** Ids a screen may need to open the record, or the nearest screen that exists for it. */
  ids: { transactionId?: number; memberId?: number; savingsAccountId?: number; loanId?: number; fundId?: number; entryId?: number };
};

const KIND_BY_TABLE: Record<string, { kind: SourceKind; title: string }> = {
  Transaction: { kind: 'charge', title: 'Charge' },
  Payment: { kind: 'payment', title: 'Payment' },
  WelfareContribution: { kind: 'welfare_contribution', title: 'Welfare contribution' },
  WelfarePayoutRequest: { kind: 'welfare_payout', title: 'Welfare payout' },
  SavingsTransaction: { kind: 'savings_transaction', title: 'Savings transaction' },
  Loan: { kind: 'loan', title: 'Loan' },
  LoanRepayment: { kind: 'loan_repayment', title: 'Loan repayment' },
  CashLodgment: { kind: 'cash_lodgment', title: 'Cash lodgment' },
  CashReversal: { kind: 'reversal', title: 'Reversal of an earlier entry' },
};

/** "auto_sync:Payment" → "Payment". Manual entries and anything unrecognised have no source. */
export function sourceTable(sourceType: string | null | undefined): string | null {
  if (!sourceType?.startsWith('auto_sync:')) return null;
  const table = sourceType.slice('auto_sync:'.length);
  return table in KIND_BY_TABLE ? table : null;
}

const fullName = (m: { firstName: string | null; lastName: string | null } | null | undefined): string | null => {
  const name = `${m?.firstName ?? ''} ${m?.lastName ?? ''}`.trim();
  return name === '' ? null : name;
};

const humanize = (text: string): string => {
  const spaced = text.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const memberSelect = { select: { id: true, firstName: true, lastName: true } } as const;

/** The facts behind an entry's source, or null for a manual entry. A source that is gone still answers, marked `missing`. */
export async function resolveEntrySource(associationId: number, sourceType: string | null | undefined, sourceId: number | null | undefined): Promise<EntrySource | null> {
  const table = sourceTable(sourceType);
  if (!table || !sourceId) return null;
  const { kind, title } = KIND_BY_TABLE[table];
  const gone = (): EntrySource => ({
    kind,
    id: sourceId,
    title,
    summary: `This ${title.toLowerCase()} can no longer be found.`,
    member: null,
    amount: null,
    date: null,
    status: null,
    reference: null,
    missing: true,
    ids: {},
  });
  const where = { id: sourceId, associationId };

  switch (table) {
    case 'Transaction': {
      const row = await prisma.transaction.findFirst({ where, include: { member: memberSelect, category: { select: { name: true } } } });
      if (!row) return gone();
      const member = fullName(row.member);
      return {
        kind, id: row.id, title, summary: `${row.category?.name ?? 'Charge'}${member ? ` for ${member}` : ''}`, member, amount: row.amount,
        date: row.paymentDate ?? row.dueDate ?? row.createdAt, status: row.isVoided ? 'Voided' : humanize(row.status), reference: row.referenceNumber, missing: false,
        ids: { transactionId: row.id, memberId: row.memberId },
      };
    }
    case 'Payment': {
      const row = await prisma.payment.findFirst({ where, include: { transaction: { include: { member: memberSelect, category: { select: { name: true } } } } } });
      if (!row) return gone();
      const member = fullName(row.transaction?.member);
      return {
        kind, id: row.id, title, summary: `Payment of ${row.transaction?.category?.name ?? 'a charge'}${member ? ` by ${member}` : ''}`, member, amount: row.amountPaid,
        date: row.paymentDate, status: row.confirmedAt ? 'Confirmed' : 'Recorded', reference: row.receiptNumber, missing: false,
        ids: { transactionId: row.transactionId, memberId: row.transaction?.memberId },
      };
    }
    case 'WelfareContribution': {
      const row = await prisma.welfareContribution.findFirst({ where, include: { member: memberSelect, fund: { select: { name: true } } } });
      if (!row) return gone();
      const member = fullName(row.member);
      return {
        kind, id: row.id, title, summary: `Contribution to ${row.fund?.name ?? 'a welfare fund'}${member ? ` by ${member}` : ''}`, member, amount: row.amount,
        date: row.contributionDate, status: humanize(row.status), reference: row.reference, missing: false, ids: { memberId: row.memberId, fundId: row.fundId },
      };
    }
    case 'WelfarePayoutRequest': {
      const row = await prisma.welfarePayoutRequest.findFirst({ where, include: { member: memberSelect, fund: { select: { name: true } } } });
      if (!row) return gone();
      const member = fullName(row.member);
      return {
        kind, id: row.id, title, summary: `${humanize(row.payoutType)} payout from ${row.fund?.name ?? 'a welfare fund'}${member ? ` to ${member}` : ''}`, member,
        amount: row.approvedAmount ?? row.amount, date: row.disbursedAt ?? row.requestedAt, status: humanize(row.status), reference: row.disbursementReference ?? row.requestNumber,
        missing: false, ids: { memberId: row.memberId, fundId: row.fundId },
      };
    }
    case 'SavingsTransaction': {
      const row = await prisma.savingsTransaction.findFirst({ where, include: { savingsAccount: { include: { member: memberSelect } } } });
      if (!row) return gone();
      const member = fullName(row.savingsAccount?.member);
      return {
        kind, id: row.id, title, summary: `${humanize(row.type)} on savings account ${row.savingsAccount?.accountNumber ?? ''}${member ? ` of ${member}` : ''}`.replace(/\s+/g, ' '), member,
        amount: row.amount, date: row.transactionDate, status: null, reference: row.reference, missing: false,
        ids: { savingsAccountId: row.savingsAccountId, memberId: row.savingsAccount?.memberId },
      };
    }
    case 'Loan': {
      const row = await prisma.loan.findFirst({ where, include: { member: memberSelect } });
      if (!row) return gone();
      const member = fullName(row.member);
      return {
        kind, id: row.id, title, summary: `Loan ${row.loanNumber}${member ? ` to ${member}` : ''}`, member, amount: row.principalAmount, date: row.disbursedAt,
        status: humanize(row.status), reference: row.loanNumber, missing: false, ids: { loanId: row.id, memberId: row.memberId },
      };
    }
    case 'LoanRepayment': {
      const row = await prisma.loanRepayment.findFirst({ where, include: { loan: { include: { member: memberSelect } } } });
      if (!row) return gone();
      const member = fullName(row.loan?.member);
      return {
        kind, id: row.id, title, summary: `Repayment of loan ${row.loan?.loanNumber ?? ''}${member ? ` by ${member}` : ''}`.replace(/\s+/g, ' '), member, amount: row.amount,
        date: row.paymentDate, status: null, reference: row.reference, missing: false, ids: { loanId: row.loanId, memberId: row.loan?.memberId },
      };
    }
    case 'CashLodgment': {
      const row = await prisma.cashLodgment.findFirst({ where });
      if (!row) return gone();
      return {
        kind, id: row.id, title, summary: 'Cash paid into the bank', member: null, amount: row.amount, date: row.depositDate, status: humanize(row.status),
        reference: row.bankReference, missing: false, ids: {},
      };
    }
    case 'CashReversal': {
      // For a reversal the source id is the entry that was reversed
      const row = await prisma.journalEntry.findFirst({ where, select: { id: true, entryNumber: true, description: true, entryDate: true } });
      if (!row) return gone();
      return {
        kind, id: row.id, title, summary: `Reverses ${row.entryNumber}: ${row.description}`, member: null, amount: null, date: row.entryDate, status: null,
        reference: row.entryNumber, missing: false, ids: { entryId: row.id },
      };
    }
    default:
      return null;
  }
}
