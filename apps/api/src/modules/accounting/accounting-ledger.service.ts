import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { cashAccountIds } from './accounting.service';
import { MAX_LEDGER_LINES, ledgerTotals, withRunningBalance, type LedgerLineInput } from './accounting-ledger';
import { AccountingRuleError, balanceOf } from './accounting-rules';

export type LedgerQuery = { accountIds: number[]; from?: Date; to?: Date; search?: string; page?: number; limit?: number };

const lineWhere = (associationId: number, accountIds: number[], from?: Date, to?: Date): Prisma.JournalEntryLineWhereInput => ({
  accountId: { in: accountIds },
  journalEntry: { associationId, status: 'POSTED', ...(from || to ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
});

/** The balance of each account from debit and credit totals, added up. */
async function balanceOfAccounts(associationId: number, accounts: { id: number; normalBalance: string }[], from: Date | undefined, to: Date | undefined): Promise<Decimal> {
  if (accounts.length === 0) return new Decimal(0);
  const rows = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: lineWhere(associationId, accounts.map((a) => a.id), from, to),
    _sum: { debitAmount: true, creditAmount: true },
  });
  const sums = new Map(rows.map((r) => [r.accountId, r._sum]));
  return accounts.reduce((total, a) => {
    const s = sums.get(a.id);
    return s ? total.plus(balanceOf(a.normalBalance as 'DEBIT' | 'CREDIT', s.debitAmount ?? 0, s.creditAmount ?? 0)) : total;
  }, new Decimal(0));
}

const SCOPES = ['cash', 'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

export const accountingLedgerService = {
  /**
   * The accounts a whole section stands for, so a total on a statement or the dashboard can be opened without the screen knowing every
   * account: "cash" is the cash and bank accounts, the rest are the accounts of a type.
   */
  async accountsInScope(associationId: number, scope: string): Promise<number[]> {
    if (!SCOPES.includes(scope)) throw new AccountingRuleError('That is not something a ledger can open.', 400, 'INVALID_SCOPE');
    if (scope === 'cash') return cashAccountIds(associationId);
    const rows = await prisma.chartOfAccount.findMany({ where: { associationId, type: scope as 'ASSET' }, select: { id: true } });
    return rows.map((r) => r.id);
  },

  /**
   * The ledger of one account, or of several together (a statement section such as "Total revenue"): every posted line, in book order,
   * with the balance after each. Opening + movement = closing, and the closing figure is the one the statement shows for the same dates.
   * Drafts, pending and rejected entries are not in the books and are not here. A search narrows the lines shown; the balances stay those
   * of the whole ledger, so a line's balance never changes with what is typed.
   */
  async getLedger(associationId: number, query: LedgerQuery) {
    const accounts = await prisma.chartOfAccount.findMany({
      where: { associationId, id: { in: query.accountIds } },
      select: { id: true, code: true, name: true, type: true, normalBalance: true, parentId: true, isActive: true },
      orderBy: { code: 'asc' },
    });
    if (accounts.length !== query.accountIds.length) throw new AccountingRuleError('That account could not be found.', 404, 'ACCOUNT_NOT_FOUND');
    const normalOf = new Map(accounts.map((a) => [a.id, a.normalBalance as 'DEBIT' | 'CREDIT']));
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));

    // Before the start there is only the opening balance; with no start the books begin here
    const opening = query.from ? await balanceOfAccounts(associationId, accounts, undefined, new Date(query.from.getTime() - 1)) : new Decimal(0);

    const raw = await prisma.journalEntryLine.findMany({
      where: lineWhere(associationId, query.accountIds, query.from, query.to),
      select: { id: true, journalEntryId: true, accountId: true, debitAmount: true, creditAmount: true },
      orderBy: [{ journalEntry: { entryDate: 'asc' } }, { journalEntryId: 'asc' }, { id: 'asc' }],
      take: MAX_LEDGER_LINES + 1,
    });
    if (raw.length > MAX_LEDGER_LINES) {
      throw new AccountingRuleError('There are too many lines for these dates. Choose a shorter stretch.', 400, 'TOO_MANY_LINES');
    }

    const inputs: LedgerLineInput[] = raw.map((l) => ({
      lineId: l.id,
      entryId: l.journalEntryId,
      accountId: l.accountId,
      debit: new Decimal(l.debitAmount),
      credit: new Decimal(l.creditAmount),
      normal: normalOf.get(l.accountId) ?? 'DEBIT',
    }));
    const balanced = withRunningBalance(opening, inputs);
    const totals = ledgerTotals(opening, balanced);

    let shown = balanced;
    const text = query.search?.trim();
    if (text) {
      const matches = await prisma.journalEntryLine.findMany({
        where: {
          AND: [
            lineWhere(associationId, query.accountIds, query.from, query.to),
            {
              OR: [
                { description: { contains: text, mode: 'insensitive' } },
                { journalEntry: { OR: [{ entryNumber: { contains: text, mode: 'insensitive' } }, { description: { contains: text, mode: 'insensitive' } }, { reference: { contains: text, mode: 'insensitive' } }] } },
              ],
            },
          ],
        },
        select: { id: true },
      });
      const keep = new Set(matches.map((m) => m.id));
      shown = balanced.filter((l) => keep.has(l.lineId));
    }

    const slice = shown.slice((page - 1) * limit, page * limit);
    const details = await prisma.journalEntryLine.findMany({
      where: { id: { in: slice.map((l) => l.lineId) } },
      select: {
        id: true,
        description: true,
        account: { select: { code: true, name: true } },
        journalEntry: { select: { entryNumber: true, entryDate: true, description: true, reference: true, sourceType: true, sourceId: true } },
      },
    });
    const detailOf = new Map(details.map((d) => [d.id, d]));

    // Sub-accounts of a single account, each with what it moved over the same dates
    let subAccounts: { id: number; code: string; name: string; balance: Decimal }[] = [];
    if (accounts.length === 1) {
      const children = await prisma.chartOfAccount.findMany({
        where: { associationId, parentId: accounts[0].id },
        select: { id: true, code: true, name: true, normalBalance: true },
        orderBy: { code: 'asc' },
      });
      subAccounts = await Promise.all(
        children.map(async (c) => ({ id: c.id, code: c.code, name: c.name, balance: await balanceOfAccounts(associationId, [c], query.from, query.to) })),
      );
    }

    return {
      accounts: accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, normalBalance: a.normalBalance, parentId: a.parentId, isActive: a.isActive })),
      range: { from: query.from ?? null, to: query.to ?? null },
      opening,
      totalDebit: totals.debit,
      totalCredit: totals.credit,
      movement: totals.net,
      closing: totals.closing,
      subAccounts,
      lines: slice.map((l) => {
        const d = detailOf.get(l.lineId);
        return {
          lineId: l.lineId,
          entryId: l.entryId,
          entryNumber: d?.journalEntry.entryNumber ?? '',
          entryDate: d?.journalEntry.entryDate ?? null,
          entryDescription: d?.journalEntry.description ?? '',
          lineDescription: d?.description ?? null,
          reference: d?.journalEntry.reference ?? null,
          sourceType: d?.journalEntry.sourceType ?? null,
          accountId: l.accountId,
          accountCode: d?.account.code ?? '',
          accountName: d?.account.name ?? '',
          debit: l.debit,
          credit: l.credit,
          effect: l.effect,
          balance: l.balance,
        };
      }),
      pagination: { page, limit, totalCount: shown.length, totalPages: Math.max(1, Math.ceil(shown.length / limit)), hasMore: page * limit < shown.length },
    };
  },
};
