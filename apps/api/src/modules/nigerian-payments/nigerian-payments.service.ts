// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES SERVICE
// ============================================

import { presentMemberPhoto } from '../../services/member-photo.service';
import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import {
  BankAccountInput,
  BankTransferInput,
  StatementImportInput,
  ReconcileInput,
  AutoMatchResult,
  PaymentProofInput,
  PaymentProofVerification,
  UnmatchedPaymentsDashboard,
} from './nigerian-payments.types';
// Accounting integration
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { memberLedgerService } from '../member-finance/member-ledger.service';
import { cacheInvalidationService } from '../../services/cache-invalidation.service';
import { decidePaymentProof, targetTransactionIds } from './payment-proof-decision';
import { confirmMatch, disputeMatch, proposeMatch, suggestMatches } from './reconciliation-engine';
import { assertNotLastActiveAccount, assertReferenceFree, assertTransferLinks, BankRuleError, promoteNewDefault } from './bank-rules';

/** Thrown when a reconciliation was already confirmed or disputed. The controller answers 409. */
export class ReconciliationDecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationDecisionError';
  }
}

export const nigerianPaymentsService = {
  // ==========================================
  // TASK-PAY-002: BANK ACCOUNT MANAGEMENT
  // ==========================================

  /** The first active account is always the default, so members are never shown an account list with none marked as the one to use. */
  async createBankAccount(associationId: number, data: BankAccountInput) {
    const activeCount = await prisma.associationBankAccount.count({ where: { associationId, isActive: true } });
    const makeDefault = Boolean(data.isDefault) || activeCount === 0;

    if (makeDefault) {
      await prisma.associationBankAccount.updateMany({
        where: { associationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.associationBankAccount.create({
      data: {
        associationId,
        bankName: data.bankName,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        isDefault: makeDefault,
        description: data.description,
      },
    });
  },

  /**
   * Edits an account. Rules that keep members' "pay to" details sound: a changed account number can't clash with another account; the
   * last active account can't be deactivated; only an active account can be the default; and the default can't be un-set directly —
   * it moves by making another account the default.
   */
  async updateBankAccount(id: number, associationId: number, data: Partial<BankAccountInput> & { isActive?: boolean }) {
    const existing = await prisma.associationBankAccount.findFirst({ where: { id, associationId } });
    if (!existing) throw new BankRuleError('NOT_FOUND', 'Bank account not found');

    if (data.accountNumber && data.accountNumber !== existing.accountNumber) {
      const clash = await prisma.associationBankAccount.findFirst({ where: { associationId, accountNumber: data.accountNumber, id: { not: id } }, select: { id: true } });
      if (clash) throw new BankRuleError('DUPLICATE_ACCOUNT', 'A bank account with this account number already exists.');
    }

    const retiring = data.isActive === false && existing.isActive;
    if (retiring) await assertNotLastActiveAccount(associationId, id);

    const willBeActive = data.isActive ?? existing.isActive;
    if (data.isDefault === true && !willBeActive) {
      throw new BankRuleError('INACTIVE_DEFAULT', 'An inactive account can’t be the default. Reactivate it first.');
    }

    // Making this the default moves the default; a retired account never keeps it.
    const becomesDefault = !retiring && (data.isDefault === true || existing.isDefault);
    if (data.isDefault === true && !retiring) {
      await prisma.associationBankAccount.updateMany({ where: { associationId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }

    const account = await prisma.associationBankAccount.update({
      where: { id },
      data: {
        bankName: data.bankName,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        description: data.description,
        isActive: data.isActive,
        isDefault: becomesDefault && willBeActive,
      },
    });

    const newDefaultId = retiring && existing.isDefault ? await promoteNewDefault(associationId) : null;
    return { account, newDefaultId };
  },

  /**
   * Removes an account. One that has transfers or statement imports is deactivated (its history stays); one with neither is deleted.
   * The last active account can't be removed, and if the default goes, the oldest remaining active account becomes the default.
   */
  async deleteBankAccount(id: number, associationId: number) {
    const existing = await prisma.associationBankAccount.findFirst({ where: { id, associationId } });
    if (!existing) throw new BankRuleError('NOT_FOUND', 'Bank account not found');
    if (existing.isActive) await assertNotLastActiveAccount(associationId, id);

    const [transferCount, importCount] = await Promise.all([
      prisma.bankTransfer.count({ where: { bankAccountId: id } }),
      prisma.bankStatementImport.count({ where: { bankAccountId: id } }),
    ]);

    let outcome: 'deleted' | 'deactivated';
    if (transferCount > 0 || importCount > 0) {
      await prisma.associationBankAccount.update({ where: { id }, data: { isActive: false, isDefault: false } });
      outcome = 'deactivated';
    } else {
      await prisma.associationBankAccount.delete({ where: { id } });
      outcome = 'deleted';
    }

    const newDefaultId = existing.isDefault ? await promoteNewDefault(associationId) : null;
    return { outcome, newDefaultId };
  },

  async getBankAccounts(associationId: number, isActive?: boolean) {
    return prisma.associationBankAccount.findMany({
      where: {
        associationId,
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async getBankAccountById(id: number, associationId: number) {
    return prisma.associationBankAccount.findFirst({
      where: { id, associationId },
      include: {
        _count: {
          select: { bankTransfers: true, statementImports: true },
        },
      },
    });
  },

  // ==========================================
  // TASK-PAY-001: BANK TRANSFER TRACKING
  // ==========================================

  async createBankTransfer(associationId: number, data: BankTransferInput, recordedBy?: number) {
    await assertTransferLinks(associationId, { bankAccountId: data.bankAccountId, memberId: data.memberId, transactionId: data.transactionId });
    await assertReferenceFree(associationId, data.reference);

    return prisma.bankTransfer.create({
      data: {
        associationId,
        recordedBy,
        transactionId: data.transactionId,
        bankAccountId: data.bankAccountId,
        memberId: data.memberId,
        senderBankName: data.senderBankName,
        senderAccountNumber: data.senderAccountNumber,
        senderAccountName: data.senderAccountName,
        amount: data.amount,
        reference: data.reference.trim(),
        transferDate: new Date(data.transferDate),
        narration: data.narration,
        notes: data.notes,
        status: 'PENDING',
      },
      include: {
        transaction: {
          select: { id: true, referenceNumber: true, amount: true, status: true },
        },
        member: {
          select: { id: true, memberId: true, firstName: true, lastName: true },
        },
        bankAccount: {
          select: { id: true, bankName: true, accountNumber: true },
        },
      },
    });
  },

  /**
   * Edits a transfer that is still waiting. The status is deliberately not editable here — verifying and rejecting go only through
   * `verifyBankTransfer`, which needs the approve permission — and the update itself only lands on a PENDING transfer, so an edit can't
   * slip in after someone verified it or after reconciliation matched it.
   */
  async updateBankTransfer(id: number, associationId: number, data: Partial<BankTransferInput>) {
    await assertTransferLinks(associationId, { bankAccountId: data.bankAccountId, memberId: data.memberId, transactionId: data.transactionId });
    if (data.reference) await assertReferenceFree(associationId, data.reference, id);

    const result = await prisma.bankTransfer.updateMany({
      where: { id, associationId, status: 'PENDING' },
      data: {
        transactionId: data.transactionId,
        bankAccountId: data.bankAccountId,
        memberId: data.memberId,
        senderBankName: data.senderBankName,
        senderAccountNumber: data.senderAccountNumber,
        senderAccountName: data.senderAccountName,
        amount: data.amount,
        reference: data.reference?.trim(),
        transferDate: data.transferDate ? new Date(data.transferDate) : undefined,
        narration: data.narration,
        notes: data.notes,
      },
    });
    if (result.count === 0) throw new BankRuleError('ALREADY_DECIDED', 'This transfer was already decided or matched, so it can no longer be edited.');

    return prisma.bankTransfer.findUniqueOrThrow({ where: { id } });
  },

  /**
   * Verifies or rejects a transfer, once. Only a PENDING transfer can be decided — the change is claimed atomically, so a second tap, a
   * second officer, or a transfer reconciliation already MATCHED can't be overwritten. Verifying confirms the money reached the account;
   * it records no payment (that happens when a member's proof is verified or a reconciliation is confirmed).
   */
  async verifyBankTransfer(id: number, associationId: number, userId: number, status: 'VERIFIED' | 'REJECTED', notes?: string) {
    const claimed = await prisma.bankTransfer.updateMany({
      // Whoever recorded a transfer can't also decide it (a transfer with no recorder, from before this was kept, can be decided by anyone allowed to).
      where: { id, associationId, status: 'PENDING', OR: [{ recordedBy: null }, { recordedBy: { not: userId } }] },
      data: { status, verifiedBy: userId, verifiedAt: new Date(), notes: notes || undefined },
    });

    if (claimed.count === 0) {
      const current = await prisma.bankTransfer.findFirst({ where: { id, associationId }, select: { status: true, recordedBy: true } });
      if (!current) throw new BankRuleError('NOT_FOUND', 'Bank transfer not found');
      if (current.status === 'PENDING' && current.recordedBy === userId) {
        throw new BankRuleError('OWN_TRANSFER', "You can't verify or reject a bank transfer you recorded yourself. Ask another officer.");
      }
      throw new BankRuleError('ALREADY_DECIDED', `This transfer is already ${current.status.toLowerCase()}. It can't be decided again.`);
    }

    return prisma.bankTransfer.findUniqueOrThrow({ where: { id } });
  },

  async getBankTransfers(
    associationId: number,
    options: {
      page: number;
      limit: number;
      status?: string;
      memberId?: number;
      bankAccountId?: number;
      startDate?: Date;
      endDate?: Date;
      search?: string;
    }
  ) {
    const { page, limit, status, memberId, bankAccountId, startDate, endDate, search } = options;
    const skip = (page - 1) * limit;

    const where: any = { associationId };

    if (status) where.status = status;
    if (memberId) where.memberId = memberId;
    if (bankAccountId) where.bankAccountId = bankAccountId;
    if (startDate || endDate) {
      where.transferDate = {};
      if (startDate) where.transferDate.gte = startDate;
      if (endDate) where.transferDate.lte = endDate;
    }
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { senderAccountName: { contains: search, mode: 'insensitive' } },
        { narration: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transfers, totalCount] = await Promise.all([
      prisma.bankTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transferDate: 'desc' },
        include: {
          transaction: {
            select: { id: true, referenceNumber: true, amount: true, status: true },
          },
          member: {
            select: { id: true, memberId: true, firstName: true, lastName: true },
          },
          bankAccount: {
            select: { id: true, bankName: true, accountNumber: true },
          },
          paymentProofs: {
            select: { 
              id: true, 
              filename: true, 
              filepath: true, 
              status: true, 
              uploadedAt: true 
            },
          },
        },
      }),
      prisma.bankTransfer.count({ where }),
    ]);

    return {
      // A linked proof's storage key stays server-side — clients only learn whether a file is attached.
      transfers: transfers.map((transfer) => ({
        ...transfer,
        paymentProofs: transfer.paymentProofs.map(({ filepath, ...proof }) => ({ ...proof, hasFile: Boolean(filepath) })),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + transfers.length < totalCount,
      },
    };
  },

  async getBankTransferById(id: number, associationId: number) {
    const transfer = await prisma.bankTransfer.findFirst({
      where: { id, associationId },
      include: {
        transaction: {
          include: {
            member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
            category: { select: { id: true, name: true, type: true } },
          },
        },
        member: {
          select: { id: true, memberId: true, firstName: true, lastName: true, email: true, phone: true },
        },
        bankAccount: true,
        paymentProofs: true,
      },
    });
    if (!transfer) return null;

    return {
      ...transfer,
      paymentProofs: transfer.paymentProofs.map(({ filepath, ...proof }) => ({ ...proof, hasFile: Boolean(filepath) })),
    };
  },


  // ==========================================
  // TASK-PAY-005: BANK STATEMENT IMPORT
  // ==========================================

  /** Kept for callers of the old JSON import: the real import reads the uploaded file (see statement-import.ts). */
  async importBankStatement(associationId: number, userId: number, data: StatementImportInput) {
    // The lines are checked the same way as a file's: each one needs a date and an amount, and a line saved before is skipped.
    const { fingerprints } = await import('./statement-parser');
    const { Decimal: D } = await import('@prisma/client/runtime/library');
    const account = await prisma.associationBankAccount.findFirst({ where: { id: data.bankAccountId, associationId } });
    if (!account) throw new Error('Bank account not found');
    const lines = data.entries.map((entry, i) => ({
      row: i + 1,
      transactionDate: new Date(entry.transactionDate),
      valueDate: entry.valueDate ? new Date(entry.valueDate) : null,
      reference: entry.reference ?? null,
      description: entry.description,
      debitAmount: entry.debitAmount ? new D(entry.debitAmount) : null,
      creditAmount: entry.creditAmount ? new D(entry.creditAmount) : null,
      balance: entry.balance !== undefined && entry.balance !== null ? new D(entry.balance) : null,
    }));
    const prints = fingerprints(account.id, lines);
    return prisma.$transaction(async (tx) => {
      const record = await tx.bankStatementImport.create({
        data: { associationId, bankAccountId: account.id, filename: data.filename, startDate: data.startDate ? new Date(data.startDate) : null, endDate: data.endDate ? new Date(data.endDate) : null, totalEntries: 0, status: 'PROCESSING', importedBy: userId },
      });
      const created = await tx.bankStatementEntry.createMany({
        data: lines.map((l, i) => ({ importId: record.id, bankAccountId: account.id, fingerprint: prints[i]!, transactionDate: l.transactionDate, valueDate: l.valueDate, reference: l.reference, description: l.description, debitAmount: l.debitAmount, creditAmount: l.creditAmount, balance: l.balance, matchStatus: 'UNMATCHED' as const })),
        skipDuplicates: true,
      });
      const done = await tx.bankStatementImport.update({ where: { id: record.id }, data: { totalEntries: created.count, skippedEntries: lines.length - created.count, status: 'COMPLETED' } });
      return { import: done, entriesCreated: created.count };
    });
  },

  async getStatementImports(associationId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [imports, totalCount] = await Promise.all([
      prisma.bankStatementImport.findMany({
        where: { associationId },
        skip,
        take: limit,
        orderBy: { importDate: 'desc' },
        include: {
          bankAccount: {
            select: { id: true, bankName: true, accountNumber: true },
          },
          _count: {
            select: { entries: true },
          },
        },
      }),
      prisma.bankStatementImport.count({ where: { associationId } }),
    ]);

    // How many of each import's money-in lines are matched, worked out from the lines themselves (the stored counters are not kept up to date)
    const grouped = await prisma.bankStatementEntry.groupBy({
      by: ['importId', 'matchStatus'],
      where: { importId: { in: imports.map((i) => i.id) }, creditAmount: { gt: 0 } },
      _count: { _all: true },
    });
    const countFor = (importId: number, matched: boolean) =>
      grouped.filter((g) => g.importId === importId && (g.matchStatus !== 'UNMATCHED') === matched).reduce((n, g) => n + g._count._all, 0);
    const withCounts = imports.map((i) => ({ ...i, matchedEntries: countFor(i.id, true), unmatchedEntries: countFor(i.id, false) }));

    return {
      imports: withCounts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + imports.length < totalCount,
      },
    };
  },

  async getStatementEntries(
    associationId: number,
    options: {
      page: number;
      limit: number;
      importId?: number;
      matchStatus?: string;
      creditsOnly?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const { page, limit, importId, matchStatus, creditsOnly, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      import: { associationId },
    };

    if (importId) where.importId = importId;
    if (matchStatus) where.matchStatus = matchStatus;
    if (creditsOnly) where.creditAmount = { gt: 0 };
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = startDate;
      if (endDate) where.transactionDate.lte = endDate;
    }

    const [entries, totalCount] = await Promise.all([
      prisma.bankStatementEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          import: {
            select: {
              id: true,
              filename: true,
              bankAccount: { select: { bankName: true, accountNumber: true } },
            },
          },
        },
      }),
      prisma.bankStatementEntry.count({ where }),
    ]);

    return {
      entries,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + entries.length < totalCount,
      },
    };
  },

  // ==========================================
  // TASK-PAY-003: PAYMENT RECONCILIATION
  // ==========================================

  /**
   * Proposes a match between a bank line (or a declared transfer) and a charge. The amount is the bank line's own, never the one
   * the caller sends. See reconciliation-engine.ts for the rules.
   */
  async reconcilePayment(associationId: number, userId: number, data: ReconcileInput) {
    return proposeMatch(associationId, userId, {
      transactionId: data.transactionId,
      statementEntryId: data.statementEntryId ?? null,
      bankTransferId: data.bankTransferId ?? null,
      matchType: data.matchType,
      notes: data.notes ?? null,
    });
  },

  async confirmReconciliation(id: number, associationId: number, userId: number, status: 'CONFIRMED' | 'DISPUTED', notes?: string) {
    return status === 'CONFIRMED' ? confirmMatch(id, associationId, userId, notes) : disputeMatch(id, associationId, userId, notes);
  },

  async getReconciliations(
    associationId: number,
    options: {
      page: number;
      limit: number;
      status?: string;
      matchType?: string;
    }
  ) {
    const { page, limit, status, matchType } = options;
    const skip = (page - 1) * limit;

    const where: any = { associationId };
    if (status) where.status = status;
    if (matchType) where.matchType = matchType;

    const [reconciliations, totalCount] = await Promise.all([
      prisma.paymentReconciliation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          transaction: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              category: { select: { id: true, name: true, type: true } },
            },
          },
          bankTransfers: {
            select: { id: true, reference: true, amount: true, senderBankName: true },
          },
        },
      }),
      prisma.paymentReconciliation.count({ where }),
    ]);

    // Each match with the bank line it holds (the relation is by id), so a screen can show what the money was
    const entryIds = reconciliations.map((r) => r.statementEntryId).filter((id): id is number => id !== null);
    const entries = entryIds.length
      ? await prisma.bankStatementEntry.findMany({ where: { id: { in: entryIds } }, select: { id: true, transactionDate: true, reference: true, description: true, creditAmount: true } })
      : [];
    const entryById = new Map(entries.map((e) => [e.id, e]));
    const withLines = reconciliations.map((r) => ({ ...r, statementEntry: r.statementEntryId ? (entryById.get(r.statementEntryId) ?? null) : null }));

    return {
      reconciliations: withLines,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + reconciliations.length < totalCount,
      },
    };
  },


  // ==========================================
  // TASK-PAY-004: AUTO-MATCHING TRANSACTIONS
  // ==========================================

  /** The ranked suggestions, in the shape the older screens read, with the full detail alongside. */
  async autoMatchTransactions(associationId: number): Promise<AutoMatchResult & { suggestions: Awaited<ReturnType<typeof suggestMatches>>['suggestions']; counts: Awaited<ReturnType<typeof suggestMatches>>['counts'] }> {
    const { suggestions, counts } = await suggestMatches(associationId);
    return {
      matched: suggestions.length,
      unmatched: counts.withoutSuggestion,
      matches: suggestions.map((m) => ({
        transactionId: m.transactionId,
        bankTransferId: m.bankTransferId ?? undefined,
        statementEntryId: m.statementEntryId ?? undefined,
        confidence: m.confidence,
        matchType: m.matchType,
      })),
      suggestions,
      counts,
    };
  },

  /** Proposes each chosen match. One that can't be made says why and the rest still go ahead. Nothing is recorded until confirmed. */
  async applyAutoMatches(associationId: number, userId: number, matches: AutoMatchResult['matches']) {
    const results = [];
    for (const match of matches) {
      try {
        const reconciliation = await proposeMatch(associationId, userId, {
          transactionId: match.transactionId,
          bankTransferId: match.bankTransferId ?? null,
          statementEntryId: match.statementEntryId ?? null,
          matchType: match.matchType === 'AUTO_REFERENCE' ? 'AUTO_REFERENCE' : match.matchType === 'MANUAL' ? 'MANUAL' : 'AUTO_AMOUNT',
          confidence: match.confidence,
        });
        results.push({ success: true, reconciliationId: reconciliation.id, ...match });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message, ...match });
      }
    }
    return results;
  },

  // ==========================================
  // TASK-PAY-007: PAYMENT PROOF UPLOAD
  // ==========================================

  async uploadPaymentProof(
    associationId: number,
    memberId: number,
    data: PaymentProofInput
  ) {
    return prisma.paymentProof.create({
      data: {
        associationId,
        transactionId: data.transactionId,
        transactionIds: data.transactionIds || [],
        bankTransferId: data.bankTransferId,
        paymentMethod: data.paymentMethod,
        memberId,
        filename: data.filename,
        filepath: data.filepath,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        declarationNote: data.declarationNote,
        status: 'PENDING',
        notes: data.notes,
      },
      include: {
        transaction: {
          select: { id: true, referenceNumber: true, amount: true },
        },
        bankTransfer: {
          select: { id: true, reference: true, amount: true },
        },
        member: {
          select: { id: true, memberId: true, firstName: true, lastName: true },
        },
      },
    });
  },

  // ==========================================
  // TASK-PAY-008: PAYMENT VERIFICATION WORKFLOW
  // ==========================================

  /** Decides a proof once — see payment-proof-decision.ts for the guards (pending only, no self-approval, something to apply). */
  async verifyPaymentProof(id: number, associationId: number, userId: number, verification: PaymentProofVerification) {
    return decidePaymentProof(id, associationId, userId, verification);
  },

  async getPaymentProofs(
    associationId: number,
    options: {
      page: number;
      limit: number;
      status?: string;
      memberId?: number;
      transactionId?: number;
    },
    requestHost?: string
  ) {
    const { page, limit, status, memberId, transactionId } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentProofWhereInput = { associationId };
    if (status) where.status = status as Prisma.EnumPaymentProofStatusFilter;
    if (memberId) where.memberId = memberId;
    if (transactionId) where.transactionId = transactionId;

    const [proofs, totalCount] = await Promise.all([
      prisma.paymentProof.findMany({
        where,
        skip,
        take: limit,
        orderBy: { uploadedAt: 'desc' },
        include: {
          transaction: {
            select: { id: true, referenceNumber: true, amount: true, status: true },
          },
          bankTransfer: {
            select: { id: true, reference: true, amount: true },
          },
          member: {
            select: { id: true, memberId: true, firstName: true, lastName: true, photoKey: true, photoThumbKey: true },
          },
        },
      }),
      prisma.paymentProof.count({ where }),
    ]);

    return {
      // The storage key stays server-side — clients only learn whether a file is attached and fetch it through the link endpoints.
      proofs: await Promise.all(
        proofs.map(async ({ filepath, member, ...rest }) => ({ ...rest, member: await presentMemberPhoto(member, requestHost), hasFile: Boolean(filepath) }))
      ),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + proofs.length < totalCount,
      },
    };
  },

  /**
   * One proof with the charges it asks to settle expanded (`declaredItems`), so the officer can compare them with the bank
   * statement. `declaredBalance` is what approving will record: each charge's remaining balance, summed — voided and waived
   * charges and ones already settled count for nothing. `file` is never the storage key, only whether one is attached.
   */
  async getPaymentProofById(id: number, associationId: number, requestHost?: string) {
    const proof = await prisma.paymentProof.findFirst({
      where: { id, associationId },
      include: {
        transaction: {
          include: {
            member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
            category: { select: { id: true, name: true, type: true } },
          },
        },
        bankTransfer: true,
        member: true,
      },
    });
    if (!proof) return null;

    const ids = targetTransactionIds(proof);
    const transactions = ids.length
      ? await prisma.transaction.findMany({
          where: { id: { in: ids }, associationId },
          include: { category: { select: { id: true, name: true, type: true } }, payments: { select: { amountPaid: true } } },
          orderBy: { dueDate: 'asc' },
        })
      : [];

    const declaredItems = transactions.map((txn) => {
      const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
      const remaining = new Decimal(txn.amount).minus(paid);
      const counts = !txn.isVoided && txn.status !== 'waived' && remaining.greaterThan(0);
      return {
        id: txn.id,
        referenceNumber: txn.referenceNumber,
        category: txn.category,
        dueDate: txn.dueDate,
        status: txn.status,
        isVoided: txn.isVoided,
        amount: txn.amount,
        paid,
        balance: counts ? remaining : new Decimal(0),
      };
    });
    const declaredBalance = declaredItems.reduce((sum, item) => sum.plus(item.balance), new Decimal(0));

    return {
      ...proof,
      member: await presentMemberPhoto(proof.member, requestHost),
      // Never expose the storage key — the file is fetched through the short-lived link endpoints.
      filepath: undefined,
      hasFile: Boolean(proof.filepath),
      declaredItems,
      declaredBalance,
    };
  },

  // ==========================================
  // TASK-PAY-006: UNMATCHED PAYMENTS DASHBOARD
  // ==========================================

  async getUnmatchedPaymentsDashboard(associationId: number): Promise<UnmatchedPaymentsDashboard> {
    const [
      pendingTransfers,
      pendingEntries,
      pendingProofs,
      recentTransfers,
      recentEntries,
    ] = await Promise.all([
      // Count pending bank transfers
      prisma.bankTransfer.aggregate({
        where: { associationId, status: 'PENDING' },
        _count: { id: true },
        _sum: { amount: true },
      }),
      // Count unmatched statement entries
      prisma.bankStatementEntry.aggregate({
        where: {
          import: { associationId },
          matchStatus: 'UNMATCHED',
        },
        _count: { id: true },
        _sum: { creditAmount: true },
      }),
      // Count pending payment proofs
      prisma.paymentProof.count({
        where: { associationId, status: 'PENDING' },
      }),
      // Recent unmatched bank transfers
      prisma.bankTransfer.findMany({
        where: { associationId, status: 'PENDING' },
        take: 5,
        orderBy: { transferDate: 'desc' },
        select: {
          id: true,
          amount: true,
          reference: true,
          transferDate: true,
          senderBankName: true,
        },
      }),
      // Recent unmatched statement entries
      prisma.bankStatementEntry.findMany({
        where: {
          import: { associationId },
          matchStatus: 'UNMATCHED',
          creditAmount: { not: null },
        },
        take: 5,
        orderBy: { transactionDate: 'desc' },
        select: {
          id: true,
          creditAmount: true,
          reference: true,
          transactionDate: true,
          description: true,
        },
      }),
    ]);

    const recentUnmatched = [
      ...recentTransfers.map((t) => ({
        type: 'bank_transfer' as const,
        id: t.id,
        amount: t.amount,
        reference: t.reference,
        date: t.transferDate,
        description: t.senderBankName,
      })),
      ...recentEntries.map((e) => ({
        type: 'statement_entry' as const,
        id: e.id,
        amount: e.creditAmount!,
        reference: e.reference,
        date: e.transactionDate,
        description: e.description,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);

    const totalUnmatchedAmount = new Decimal(pendingTransfers._sum.amount || 0)
      .plus(pendingEntries._sum.creditAmount || 0);

    return {
      totalUnmatched: pendingTransfers._count.id + pendingEntries._count.id,
      totalUnmatchedAmount,
      pendingBankTransfers: pendingTransfers._count.id,
      pendingStatementEntries: pendingEntries._count.id,
      pendingPaymentProofs: pendingProofs,
      recentUnmatched,
    };
  },
};
