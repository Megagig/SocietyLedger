import { prisma } from '../lib/prisma';
import { accountingIntegrationService } from './accounting-integration.service';
import { memberLedgerService } from '../modules/member-finance/member-ledger.service';
import { isChargeCategory } from '../modules/accounting/posting-rules';
import { correctionLines, inflowCodeOf, netOf, targetPosting, type CorrectionLine, type EntryLineLike, type NetByAccount } from '../modules/accounting/books-correction-rules';

/**
 * Brings every association's member ledgers and books into agreement with their charges and payments. It exists because donations used to
 * be recorded as a credit with no matching debit (every donor looked as if the association owed them money) and were posted to the books
 * two or three times; online payments never reached the member ledger; and deleted charges stayed counted. New code no longer does any of
 * that: this fixes what is already stored.
 *
 * Safe to run on every start:
 *  - the member ledger is made to match each member's charges and payments; waivers, savings, loans and adjustments are never touched;
 *  - the books are never edited. Every fix is a new, balanced journal entry dated today, so a closed accounting period is never rewritten;
 *  - fixing is a difference (what the books should hold minus what they hold), so a second run finds nothing to do.
 */

export interface RepairOptions {
  dryRun?: boolean;
  onlyAssociationId?: number;
}

export interface AssociationReport {
  associationId: number;
  slug: string;
  members: number;
  ledger: { membersChanged: number; created: number; removed: number; updated: number };
  books: { initialised: boolean; orphansReversed: number; correctionsPosted: number; blocked: string | null };
  checks: { ledgerMismatches: number; donationLedgerVsBooks: string | null };
  problems: string[];
}

type JournalWithLines = {
  id: number;
  sourceType: string | null;
  sourceId: number | null;
  lines: Array<{ debitAmount: unknown; creditAmount: unknown; account: { code: string } }>;
};

const SOURCE_TRANSACTION = 'auto_sync:Transaction';
const SOURCE_PAYMENT = 'auto_sync:Payment';
const SOURCE_CORRECTION = 'auto_sync:BooksCorrection';
const SOURCE_REVERSAL = 'auto_sync:CashReversal';

const toLines = (entry: JournalWithLines): EntryLineLike[] =>
  entry.lines.map((l) => ({ accountCode: l.account.code, debit: Number(l.debitAmount), credit: Number(l.creditAmount) }));

export async function repairAllAssociations(options: RepairOptions = {}): Promise<AssociationReport[]> {
  const associations = await prisma.association.findMany({
    where: options.onlyAssociationId ? { id: options.onlyAssociationId } : {},
    select: { id: true, slug: true },
    orderBy: { id: 'asc' },
  });
  const reports: AssociationReport[] = [];
  for (const association of associations) {
    try {
      reports.push(await repairAssociation(association.id, association.slug ?? String(association.id), options));
    } catch (error) {
      console.error(`Repair failed for association ${association.id}:`, error);
      reports.push({
        associationId: association.id,
        slug: association.slug ?? String(association.id),
        members: 0,
        ledger: { membersChanged: 0, created: 0, removed: 0, updated: 0 },
        books: { initialised: false, orphansReversed: 0, correctionsPosted: 0, blocked: null },
        checks: { ledgerMismatches: 0, donationLedgerVsBooks: null },
        problems: [`The repair stopped with an error: ${(error as Error).message}`],
      });
    }
  }
  return reports;
}

export async function repairAssociation(associationId: number, slug: string, options: RepairOptions = {}): Promise<AssociationReport> {
  const dryRun = Boolean(options.dryRun);
  const report: AssociationReport = {
    associationId,
    slug,
    members: 0,
    ledger: { membersChanged: 0, created: 0, removed: 0, updated: 0 },
    books: { initialised: false, orphansReversed: 0, correctionsPosted: 0, blocked: null },
    checks: { ledgerMismatches: 0, donationLedgerVsBooks: null },
    problems: [],
  };

  // An association with no charges, no ledger entries and no books (the platform's own, or a brand-new one) has nothing to repair.
  const [anyCharge, anyEntry, anyAccount] = await Promise.all([
    prisma.transaction.findFirst({ where: { associationId }, select: { id: true } }),
    prisma.memberFinancialLedger.findFirst({ where: { associationId }, select: { id: true } }),
    prisma.chartOfAccount.findFirst({ where: { associationId }, select: { id: true } }),
  ]);
  if (!anyCharge && !anyEntry && !anyAccount) return report;

  // Entries need a real user to be attributed to: an admin of the association, else anyone in it.
  const actor =
    (await prisma.user.findFirst({ where: { associationId, role: 'admin' }, orderBy: { id: 'asc' }, select: { id: true } })) ??
    (await prisma.user.findFirst({ where: { associationId }, orderBy: { id: 'asc' }, select: { id: true } }));
  if (!actor) {
    report.problems.push('No user in this association to attribute the repair to; skipped.');
    return report;
  }

  await repairLedgers(associationId, actor.id, dryRun, report);
  const historyBeforeBooks = await repairBooks(associationId, actor.id, dryRun, report);
  if (!dryRun) await verify(associationId, report, historyBeforeBooks);
  return report;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Member ledgers
// ---------------------------------------------------------------------------------------------------------------------------------

async function repairLedgers(associationId: number, actorId: number, dryRun: boolean, report: AssociationReport) {
  const [withCharges, withEntries] = await Promise.all([
    prisma.transaction.findMany({ where: { associationId }, distinct: ['memberId'], select: { memberId: true } }),
    prisma.memberFinancialLedger.findMany({ where: { associationId }, distinct: ['memberId'], select: { memberId: true } }),
  ]);
  const memberIds = [...new Set([...withCharges.map((m) => m.memberId), ...withEntries.map((m) => m.memberId)])];
  report.members = memberIds.length;

  for (const memberId of memberIds) {
    try {
      const result = await memberLedgerService.reconcileMemberLedger(associationId, memberId, actorId, { dryRun });
      if (result.created || result.removed || result.updated) report.ledger.membersChanged += 1;
      report.ledger.created += result.created;
      report.ledger.removed += result.removed;
      report.ledger.updated += result.updated;
    } catch (error) {
      report.problems.push(`Ledger of member ${memberId}: ${(error as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------------------------------------------------------------

/** Returns true when some charges were made before the association's books existed (their opening position is not in the books). */
async function repairBooks(associationId: number, actorId: number, dryRun: boolean, report: AssociationReport): Promise<boolean> {
  const firstAccount = await prisma.chartOfAccount.findFirst({ where: { associationId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
  if (!firstAccount) return false; // accounting was never set up for this association: nothing to correct
  report.books.initialised = true;
  const booksStartedAt = new Date(firstAccount.createdAt.getTime() - 60_000);

  const [transactions, entries] = await Promise.all([
    prisma.transaction.findMany({
      where: { associationId },
      select: {
        id: true,
        amount: true,
        isVoided: true,
        createdAt: true,
        referenceNumber: true,
        category: { select: { type: true, name: true } },
        payments: { select: { id: true, amountPaid: true, paymentDate: true, receiptNumber: true } },
      },
    }),
    prisma.journalEntry.findMany({
      where: { associationId, status: 'POSTED', sourceType: { in: [SOURCE_TRANSACTION, SOURCE_PAYMENT, SOURCE_CORRECTION, SOURCE_REVERSAL] } },
      select: { id: true, sourceType: true, sourceId: true, lines: { select: { debitAmount: true, creditAmount: true, account: { select: { code: true } } } } },
    }),
  ]);

  const txnIds = new Set(transactions.map((t) => t.id));
  const paymentIds = new Set(transactions.flatMap((t) => t.payments.map((p) => p.id)));
  const reversedOriginals = new Set(entries.filter((e) => e.sourceType === SOURCE_REVERSAL && e.sourceId).map((e) => e.sourceId as number));
  let historyBeforeBooks = false;
  const reversalsOf = new Map<number, JournalWithLines[]>();
  for (const e of entries) {
    if (e.sourceType === SOURCE_REVERSAL && e.sourceId) reversalsOf.set(e.sourceId, [...(reversalsOf.get(e.sourceId) ?? []), e]);
  }

  try {
    // 1. Entries from charges and payments that no longer exist (deleted, or the donation voided with its receipt), not already reversed.
    const orphans = entries.filter((e) => {
      if (reversedOriginals.has(e.id) || !e.sourceId) return false;
      if (e.sourceType === SOURCE_TRANSACTION || e.sourceType === SOURCE_CORRECTION) return !txnIds.has(e.sourceId);
      if (e.sourceType === SOURCE_PAYMENT) return !paymentIds.has(e.sourceId);
      return false;
    });
    for (const orphan of orphans) {
      if (!dryRun) {
        await accountingIntegrationService.reverseJournalEntry(associationId, actorId, orphan.id, 'Reversal: the charge or payment behind this entry was deleted', `ORPHAN-${orphan.id}`);
      }
      report.books.orphansReversed += 1;
      reversedOriginals.add(orphan.id);
    }

    // 2. Each charge and its payments: make the books agree with what the posting rules say.
    const bySource = new Map<string, JournalWithLines[]>();
    const push = (key: string, entry: JournalWithLines) => bySource.set(key, [...(bySource.get(key) ?? []), entry]);
    for (const e of entries) {
      if (!e.sourceId) continue;
      if (e.sourceType === SOURCE_TRANSACTION) push(`T:${e.sourceId}`, e);
      else if (e.sourceType === SOURCE_PAYMENT) push(`P:${e.sourceId}`, e);
      else if (e.sourceType === SOURCE_CORRECTION) push(`C:${e.sourceId}`, e);
    }

    for (const txn of transactions) {
      if (!isChargeCategory(txn.category.type)) continue;
      const own = [...(bySource.get(`T:${txn.id}`) ?? []), ...(bySource.get(`C:${txn.id}`) ?? [])];
      const paymentEntries = new Map(txn.payments.map((p) => [p.id, bySource.get(`P:${p.id}`) ?? []] as const));
      const allEntries = [...own, ...[...paymentEntries.values()].flat()];
      const hasAnyEntry = allEntries.length > 0;
      // Books that did not exist yet when this charge was made are the association's opening position, not a missing posting.
      if (!hasAnyEntry && txn.createdAt < booksStartedAt) {
        if (txn.category.type === 'donation') historyBeforeBooks = true;
        continue;
      }

      const withReversals = [...allEntries, ...allEntries.flatMap((e) => reversalsOf.get(e.id) ?? [])];
      const amount = Number(txn.amount);
      const reference = txn.referenceNumber ?? `TXN-${txn.id}`;

      if (txn.category.type === 'donation') {
        // Donations were posted wrongly (bank income plus a dues payment, a third copy from the cash route): compare in full and correct.
        const actual: NetByAccount = netOf(withReversals.flatMap(toLines));
        const target = targetPosting({
          categoryType: 'donation',
          amount,
          isVoided: txn.isVoided,
          includeCharge: true,
          payments: txn.payments.map((p) => ({
            amountPaid: Number(p.amountPaid),
            inflowCode: inflowCodeOf((paymentEntries.get(p.id) ?? []).flatMap(toLines)),
            include: true,
          })),
        });
        const fix = correctionLines(target, actual);
        if (fix.length) await postFix(associationId, actorId, dryRun, report, fix, 'BooksCorrection', txn.id, `Correction: donation ${reference}`, reference);
        continue;
      }

      // Dues, levies and penalties were posted correctly. Only post what is missing altogether (for example a Nomba payment, which never reached the books).
      const chargeMissing = !txn.isVoided && !(bySource.get(`T:${txn.id}`)?.length);
      if (chargeMissing) {
        const lines = correctionLines(targetPosting({ categoryType: txn.category.type, amount, isVoided: false, includeCharge: true, payments: [] }), {});
        await postFix(associationId, actorId, dryRun, report, lines, 'Transaction', txn.id, `${txn.category.name} (posted late)`, reference);
      }
      for (const p of txn.payments) {
        if ((paymentEntries.get(p.id) ?? []).length) continue;
        const lines = correctionLines(
          targetPosting({ categoryType: txn.category.type, amount, isVoided: false, includeCharge: false, payments: [{ amountPaid: Number(p.amountPaid), inflowCode: inflowCodeOf([]), include: true }] }),
          {},
        );
        await postFix(associationId, actorId, dryRun, report, lines, 'Payment', p.id, `Payment received (posted late) ${p.receiptNumber ?? ''}`.trim(), p.receiptNumber ?? reference);
      }
    }
  } catch (error) {
    const code = (error as { code?: string }).code;
    report.books.blocked = code === 'PERIOD_CLOSED' ? `The current accounting period is closed: ${(error as Error).message}` : (error as Error).message;
    report.problems.push(`Books: ${report.books.blocked}`);
  }
  return historyBeforeBooks;
}

/** Posts one balanced correction, dated today so no closed period is touched. */
async function postFix(
  associationId: number,
  actorId: number,
  dryRun: boolean,
  report: AssociationReport,
  lines: CorrectionLine[],
  sourceTable: 'BooksCorrection' | 'Transaction' | 'Payment',
  sourceId: number,
  description: string,
  reference: string,
) {
  if (!lines.length) return;
  report.books.correctionsPosted += 1;
  if (dryRun) return;

  const journalLines = [];
  for (const line of lines) {
    const account = await accountingIntegrationService.findOrCreateStandardAccount(associationId, line.accountCode);
    if (!account) throw new Error(`Account ${line.accountCode} is missing from this association's chart and cannot be created.`);
    journalLines.push({ accountId: account.id, debitAmount: line.debit, creditAmount: line.credit, description: 'Correction' });
  }
  await accountingIntegrationService.createAndPostJournalEntry(
    associationId,
    actorId,
    { entryDate: new Date().toISOString(), description, reference, lines: journalLines },
    sourceTable,
    sourceId,
  );
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Verification: the things "balanced" must mean
// ---------------------------------------------------------------------------------------------------------------------------------

async function verify(associationId: number, report: AssociationReport, historyBeforeBooks: boolean) {
  // Every member's ledger agrees with their charges and payments (a dry-run reconcile finds nothing left to change).
  const members = await prisma.memberFinancialLedger.findMany({ where: { associationId }, distinct: ['memberId'], select: { memberId: true } });
  const withCharges = await prisma.transaction.findMany({ where: { associationId }, distinct: ['memberId'], select: { memberId: true } });
  const memberIds = [...new Set([...members.map((m) => m.memberId), ...withCharges.map((m) => m.memberId)])];
  for (const memberId of memberIds) {
    const left = await memberLedgerService.reconcileMemberLedger(associationId, memberId, 0, { dryRun: true });
    if (left.created || left.removed || left.updated) report.checks.ledgerMismatches += 1;
  }
  if (report.checks.ledgerMismatches) report.problems.push(`${report.checks.ledgerMismatches} member ledger(s) still differ from their charges and payments.`);

  // Donations: what the ledgers say is owed on donations equals the Donation Pledges Receivable account.
  if (!report.books.initialised || report.books.blocked || historyBeforeBooks) return;
  const [debits, credits, account] = await Promise.all([
    prisma.memberFinancialLedger.aggregate({ where: { associationId, category: 'DONATION', entryType: 'DEBIT' }, _sum: { amount: true } }),
    prisma.memberFinancialLedger.aggregate({ where: { associationId, category: 'DONATION', entryType: 'CREDIT' }, _sum: { amount: true } }),
    prisma.chartOfAccount.findFirst({ where: { associationId, code: '1123' }, select: { id: true } }),
  ]);
  const ledgerOwed = Number(debits._sum.amount ?? 0) - Number(credits._sum.amount ?? 0);
  let booksOwed = 0;
  if (account) {
    const sums = await prisma.journalEntryLine.aggregate({
      where: { accountId: account.id, journalEntry: { status: 'POSTED' } },
      _sum: { debitAmount: true, creditAmount: true },
    });
    booksOwed = Number(sums._sum.debitAmount ?? 0) - Number(sums._sum.creditAmount ?? 0);
  }
  if (Math.abs(ledgerOwed - booksOwed) >= 0.005) {
    report.checks.donationLedgerVsBooks = `member ledgers owe ${ledgerOwed.toFixed(2)} on donations, books show ${booksOwed.toFixed(2)}`;
    report.problems.push(`Donations: ${report.checks.donationLedgerVsBooks}`);
  }
}

