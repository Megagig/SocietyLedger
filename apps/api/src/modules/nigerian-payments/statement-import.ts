import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { readStatementFile } from './statement-file';
import {
  fingerprints,
  readStatement,
  toSavedMapping,
  type ColumnKey,
  type Mapping,
  type SavedMapping,
  type StatementLine,
} from './statement-parser';

/**
 * Importing a bank statement: read the file, show what was understood (the preview), then save only the lines that are new for this
 * bank account. The preview and the import run the same code, so what was shown is what is saved.
 */

export type StatementInput = {
  bankAccountId: number;
  filename: string;
  buffer: Buffer;
  /** Column positions the officer chose, when the recognised ones were wrong. */
  manualMapping?: Mapping | null;
  headerRow?: number | null;
};

const money = (d: Decimal | null) => (d ? d.toFixed(2) : null);

async function analyse(associationId: number, input: StatementInput) {
  const account = await prisma.associationBankAccount.findFirst({ where: { id: input.bankAccountId, associationId } });
  if (!account) throw new RuleError('Bank account not found.', 404, 'ACCOUNT_NOT_FOUND');

  const grid = await readStatementFile(input.filename, input.buffer);
  const read = readStatement(grid, { manual: input.manualMapping, saved: (account.statementMapping as SavedMapping | null) ?? null, headerRow: input.headerRow });

  const prints = fingerprints(account.id, read.lines);
  const known = prints.length
    ? new Set((await prisma.bankStatementEntry.findMany({ where: { bankAccountId: account.id, fingerprint: { in: prints } }, select: { fingerprint: true } })).map((e) => e.fingerprint))
    : new Set<string | null>();
  const fresh = read.lines.map((line, i) => ({ line, fingerprint: prints[i]!, isNew: !known.has(prints[i]!) }));
  return { account, read, fresh };
}

function summarise(lines: StatementLine[]) {
  const credits = lines.filter((l) => l.creditAmount);
  const dates = lines.map((l) => l.transactionDate.getTime());
  return {
    lines: lines.length,
    credits: credits.length,
    debits: lines.length - credits.length,
    creditTotal: credits.reduce((sum, l) => sum.plus(l.creditAmount!), new Decimal(0)),
    startDate: dates.length ? new Date(Math.min(...dates)) : null,
    endDate: dates.length ? new Date(Math.max(...dates)) : null,
  };
}

/** What an import would do, without saving anything. */
export async function previewStatement(associationId: number, input: StatementInput) {
  const { account, read, fresh } = await analyse(associationId, input);
  const newLines = fresh.filter((f) => f.isNew).map((f) => f.line);
  const all = summarise(read.lines);
  const added = summarise(newLines);

  return {
    filename: input.filename,
    bankAccount: { id: account.id, bankName: account.bankName, accountNumber: account.accountNumber },
    layout: {
      headerRow: read.layout.headerRow,
      headers: read.layout.headers,
      mapping: read.layout.mapping,
      source: read.layout.source,
    },
    problems: read.problems,
    counts: {
      lines: all.lines,
      credits: all.credits,
      debits: all.debits,
      alreadyImported: fresh.length - newLines.length,
      newLines: added.lines,
      newCredits: added.credits,
      newCreditTotal: money(added.creditTotal),
      unreadable: read.skipped.length,
    },
    period: { startDate: all.startDate, endDate: all.endDate },
    sample: read.lines.slice(0, 8).map((l) => ({
      row: l.row,
      transactionDate: l.transactionDate,
      reference: l.reference,
      description: l.description,
      debitAmount: money(l.debitAmount),
      creditAmount: money(l.creditAmount),
      balance: money(l.balance),
    })),
    unreadableRows: read.skipped.slice(0, 10),
    canImport: read.problems.length === 0 && added.lines > 0,
  };
}

/**
 * Saves the new lines of a statement. A line imported before (for the same bank account) is skipped, so importing the same file
 * twice, or two statements that overlap, never records anything twice. The way the columns were read is remembered for the account.
 */
export async function importStatement(associationId: number, userId: number, input: StatementInput) {
  const { account, read, fresh } = await analyse(associationId, input);
  if (read.problems.length > 0) throw new RuleError(read.problems[0]!, 400, 'MAPPING_INCOMPLETE');
  if (read.lines.length === 0) throw new RuleError('No transactions could be read from this file.', 400, 'NO_LINES');

  const toSave = fresh.filter((f) => f.isNew);
  if (toSave.length === 0) throw new RuleError('Every line in this file was imported before, so nothing was added.', 409, 'NOTHING_NEW');

  const all = summarise(read.lines);
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.bankStatementImport.create({
      data: {
        associationId,
        bankAccountId: account.id,
        filename: input.filename,
        startDate: all.startDate,
        endDate: all.endDate,
        totalEntries: 0,
        status: 'PROCESSING',
        importedBy: userId,
      },
    });

    // The unique (account, fingerprint) index is the last word: two imports at once can't both add the same line
    const created = await tx.bankStatementEntry.createMany({
      data: toSave.map(({ line, fingerprint }) => ({
        importId: record.id,
        bankAccountId: account.id,
        fingerprint,
        transactionDate: line.transactionDate,
        valueDate: line.valueDate,
        reference: line.reference,
        description: line.description,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        balance: line.balance,
        matchStatus: 'UNMATCHED',
      })),
      skipDuplicates: true,
    });

    const credits = await tx.bankStatementEntry.count({ where: { importId: record.id, creditAmount: { not: null } } });
    const done = await tx.bankStatementImport.update({
      where: { id: record.id },
      data: {
        totalEntries: created.count,
        unmatchedEntries: credits,
        skippedEntries: read.lines.length - created.count,
        status: 'COMPLETED',
      },
    });

    await tx.associationBankAccount.update({
      where: { id: account.id },
      data: { statementMapping: toSavedMapping(read.layout.headers, read.layout.mapping) as object },
    });
    return { import: done, entriesCreated: created.count, creditLines: credits, alreadyImported: read.lines.length - created.count };
  });

  return result;
}

export const MAPPING_KEYS: ColumnKey[] = ['date', 'valueDate', 'description', 'reference', 'debit', 'credit', 'amount', 'balance'];

/** Reads a mapping sent by a client (`{"date": 0, "credit": 3}`), keeping only known columns that are whole numbers. */
export function parseMappingInput(raw: unknown): Mapping | null {
  if (raw === undefined || raw === null || raw === '') return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new RuleError('The column choices could not be read.', 400, 'BAD_MAPPING');
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RuleError('The column choices could not be read.', 400, 'BAD_MAPPING');
  const mapping: Mapping = {};
  for (const key of MAPPING_KEYS) {
    const v = (value as Record<string, unknown>)[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 200) throw new RuleError('The column choices could not be read.', 400, 'BAD_MAPPING');
    mapping[key] = v;
  }
  return mapping;
}
