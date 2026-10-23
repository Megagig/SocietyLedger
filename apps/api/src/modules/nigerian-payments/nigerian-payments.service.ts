// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES SERVICE
// ============================================

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
import { decidePaymentProof, targetTransactionIds } from './payment-proof-decision';
import { assertNotLastActiveAccount, assertReferenceFree, assertTransferLinks, BankRuleError, promoteNewDefault } from './bank-rules';

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

  async createBankTransfer(associationId: number, data: BankTransferInput) {
    await assertTransferLinks(associationId, { bankAccountId: data.bankAccountId, memberId: data.memberId, transactionId: data.transactionId });
    await assertReferenceFree(associationId, data.reference);

    return prisma.bankTransfer.create({
      data: {
        associationId,
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
      where: { id, associationId, status: 'PENDING' },
      data: { status, verifiedBy: userId, verifiedAt: new Date(), notes: notes || undefined },
    });

    if (claimed.count === 0) {
      const current = await prisma.bankTransfer.findFirst({ where: { id, associationId }, select: { status: true } });
      if (!current) throw new BankRuleError('NOT_FOUND', 'Bank transfer not found');
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

  async importBankStatement(associationId: number, userId: number, data: StatementImportInput) {
    // Create the import record
    const importRecord = await prisma.bankStatementImport.create({
      data: {
        associationId,
        bankAccountId: data.bankAccountId,
        filename: data.filename,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        totalEntries: data.entries.length,
        status: 'PROCESSING',
        importedBy: userId,
      },
    });

    // Create all statement entries
    const entries = await prisma.bankStatementEntry.createMany({
      data: data.entries.map((entry) => ({
        importId: importRecord.id,
        transactionDate: new Date(entry.transactionDate),
        valueDate: entry.valueDate ? new Date(entry.valueDate) : null,
        reference: entry.reference,
        description: entry.description,
        debitAmount: entry.debitAmount,
        creditAmount: entry.creditAmount,
        balance: entry.balance,
        matchStatus: 'UNMATCHED',
      })),
    });

    // Update import record status
    await prisma.bankStatementImport.update({
      where: { id: importRecord.id },
      data: { status: 'COMPLETED' },
    });

    return {
      import: importRecord,
      entriesCreated: entries.count,
    };
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

    return {
      imports,
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
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const { page, limit, importId, matchStatus, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      import: { associationId },
    };

    if (importId) where.importId = importId;
    if (matchStatus) where.matchStatus = matchStatus;
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

  async reconcilePayment(associationId: number, userId: number, data: ReconcileInput) {
    // Verify transaction exists
    const transaction = await prisma.transaction.findFirst({
      where: { id: data.transactionId, associationId },
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Create reconciliation record
    const reconciliation = await prisma.paymentReconciliation.create({
      data: {
        associationId,
        transactionId: data.transactionId,
        statementEntryId: data.statementEntryId,
        matchType: data.matchType,
        matchedAmount: data.matchedAmount,
        variance: data.variance || 0,
        status: 'PENDING',
        notes: data.notes,
      },
    });

    // If bank transfer provided, link it to reconciliation
    if (data.bankTransferId) {
      await prisma.bankTransfer.update({
        where: { id: data.bankTransferId },
        data: {
          reconciliationId: reconciliation.id,
          status: 'MATCHED',
        },
      });
    }

    // Update statement entry if provided
    if (data.statementEntryId) {
      await prisma.bankStatementEntry.update({
        where: { id: data.statementEntryId },
        data: {
          matchStatus: data.matchType === 'MANUAL' ? 'MANUAL_MATCHED' : 'AUTO_MATCHED',
          matchedTransactionId: data.transactionId,
          matchConfidence: data.matchType === 'AUTO_REFERENCE' ? 100 : data.matchType === 'AUTO_AMOUNT' ? 80 : 100,
          matchedAt: new Date(),
          matchedBy: userId,
        },
      });
    }

    return reconciliation;
  },

  async confirmReconciliation(id: number, associationId: number, userId: number, status: 'CONFIRMED' | 'DISPUTED', notes?: string) {
    const reconciliation = await prisma.paymentReconciliation.update({
      where: { id },
      data: {
        status,
        reconciledBy: userId,
        reconciledAt: new Date(),
        notes: notes || undefined,
      },
      include: {
        transaction: true,
      },
    });

    // If confirmed, update the transaction status to paid
    if (status === 'CONFIRMED') {
      await prisma.transaction.update({
        where: { id: reconciliation.transactionId },
        data: {
          status: 'paid',
          paymentDate: new Date(),
          paymentMethod: 'bank_transfer',
        },
      });

      // Create a payment record
      const paymentCount = await prisma.payment.count({ where: { associationId } });
      const payment = await prisma.payment.create({
        data: {
          associationId,
          transactionId: reconciliation.transactionId,
          amountPaid: reconciliation.matchedAmount,
          paymentDate: new Date(),
          paymentMethod: 'bank_transfer',
          receiptNumber: `RCP${String(paymentCount + 1).padStart(6, '0')}`,
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
        include: {
          transaction: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              category: { select: { id: true, name: true, type: true } },
            },
          },
        },
      });

      // Accounting integration: Sync payment to accounting module
      try {
        await accountingIntegrationService.onPaymentRecorded(payment, userId);
      } catch (syncError) {
        console.error('Accounting sync failed (non-critical):', syncError);
        // Don't throw - payment creation succeeded
      }

      // Ledger sync: create CREDIT entry for the auto-reconciled payment
      try {
        await memberLedgerService.createFromPayment(payment.id, userId);
      } catch (ledgerError) {
        console.error('Ledger sync failed (non-critical):', ledgerError);
      }
    }

    return reconciliation;
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

    return {
      reconciliations,
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

  async autoMatchTransactions(associationId: number): Promise<AutoMatchResult> {
    const matches: AutoMatchResult['matches'] = [];

    // Get unmatched bank transfers (VERIFIED but not matched to transaction)
    const unmatchedTransfers = await prisma.bankTransfer.findMany({
      where: {
        associationId,
        status: 'VERIFIED',
        transactionId: null,
      },
    });

    console.log(`[Auto-Match] Found ${unmatchedTransfers.length} unmatched transfers`);

    // Get pending transactions (case-insensitive status check)
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        associationId,
        status: {
          in: ['PENDING', 'OVERDUE', 'pending', 'overdue', 'Pending', 'Overdue'],
        },
      },
      include: {
        member: true,
      },
    });

    console.log(`[Auto-Match] Found ${pendingTransactions.length} pending transactions`);

    for (const transfer of unmatchedTransfers) {
      // Try to match by reference number first
      let matchedTransaction = pendingTransactions.find((txn) => {
        if (!transfer.reference || !txn.referenceNumber) return false;
        return transfer.reference.toLowerCase().includes(txn.referenceNumber.toLowerCase()) ||
               txn.referenceNumber.toLowerCase().includes(transfer.reference.toLowerCase());
      });

      if (matchedTransaction) {
        matches.push({
          transactionId: matchedTransaction.id,
          bankTransferId: transfer.id,
          confidence: 100,
          matchType: 'AUTO_REFERENCE',
        });
        continue;
      }

      // Try to match by amount and member
      if (transfer.memberId) {
        matchedTransaction = pendingTransactions.find((txn) => {
          return txn.memberId === transfer.memberId &&
                 new Decimal(txn.amount).equals(transfer.amount);
        });

        if (matchedTransaction) {
          matches.push({
            transactionId: matchedTransaction.id,
            bankTransferId: transfer.id,
            confidence: 90,
            matchType: 'AUTO_AMOUNT',
          });
          continue;
        }
      }

      // Try to match by amount only (lower confidence)
      matchedTransaction = pendingTransactions.find((txn) => {
        return new Decimal(txn.amount).equals(transfer.amount);
      });

      if (matchedTransaction) {
        matches.push({
          transactionId: matchedTransaction.id,
          bankTransferId: transfer.id,
          confidence: 70,
          matchType: 'AUTO_AMOUNT',
        });
      }
    }

    // Also try to match statement entries
    const unmatchedEntries = await prisma.bankStatementEntry.findMany({
      where: {
        import: { associationId },
        matchStatus: 'UNMATCHED',
        creditAmount: { not: null },
      },
    });

    for (const entry of unmatchedEntries) {
      if (!entry.creditAmount) continue;

      // Try to match by reference
      let matchedTransaction = pendingTransactions.find((txn) => {
        if (!entry.reference || !txn.referenceNumber) return false;
        return entry.reference.toLowerCase().includes(txn.referenceNumber.toLowerCase()) ||
               txn.referenceNumber.toLowerCase().includes(entry.reference.toLowerCase());
      });

      if (matchedTransaction) {
        matches.push({
          transactionId: matchedTransaction.id,
          statementEntryId: entry.id,
          confidence: 100,
          matchType: 'AUTO_REFERENCE',
        });
        continue;
      }

      // Try to match by amount
      matchedTransaction = pendingTransactions.find((txn) => {
        return new Decimal(txn.amount).equals(entry.creditAmount!);
      });

      if (matchedTransaction) {
        matches.push({
          transactionId: matchedTransaction.id,
          statementEntryId: entry.id,
          confidence: 70,
          matchType: 'AUTO_AMOUNT',
        });
      }
    }

    return {
      matched: matches.length,
      unmatched: unmatchedTransfers.length + unmatchedEntries.length - matches.length,
      matches,
    };
  },

  async applyAutoMatches(associationId: number, userId: number, matches: AutoMatchResult['matches']) {
    const results = [];

    for (const match of matches) {
      try {
        const reconciliation = await this.reconcilePayment(associationId, userId, {
          transactionId: match.transactionId,
          bankTransferId: match.bankTransferId,
          statementEntryId: match.statementEntryId,
          matchType: match.matchType as any,
          matchedAmount: 0, // Will be set from transaction
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
    }
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
            select: { id: true, memberId: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.paymentProof.count({ where }),
    ]);

    return {
      // The storage key stays server-side — clients only learn whether a file is attached and fetch it through the link endpoints.
      proofs: proofs.map(({ filepath, ...rest }) => ({ ...rest, hasFile: Boolean(filepath) })),
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
  async getPaymentProofById(id: number, associationId: number) {
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
