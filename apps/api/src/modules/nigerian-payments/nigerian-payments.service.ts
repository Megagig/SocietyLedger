// ============================================
// PHASE 3.5: NIGERIAN PAYMENT FEATURES SERVICE
// ============================================

import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
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

export const nigerianPaymentsService = {
  // ==========================================
  // TASK-PAY-002: BANK ACCOUNT MANAGEMENT
  // ==========================================

  async createBankAccount(associationId: number, data: BankAccountInput) {
    // If setting as default, unset other defaults first
    if (data.isDefault) {
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
        isDefault: data.isDefault || false,
        description: data.description,
      },
    });
  },

  async updateBankAccount(id: number, associationId: number, data: Partial<BankAccountInput>) {
    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await prisma.associationBankAccount.updateMany({
        where: { associationId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.associationBankAccount.update({
      where: { id },
      data: {
        bankName: data.bankName,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        isDefault: data.isDefault,
        description: data.description,
      },
    });
  },

  async deleteBankAccount(id: number, associationId: number) {
    // Check if account has any transfers
    const transferCount = await prisma.bankTransfer.count({
      where: { bankAccountId: id },
    });

    if (transferCount > 0) {
      // Soft delete by deactivating
      return prisma.associationBankAccount.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return prisma.associationBankAccount.delete({ where: { id } });
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
        reference: data.reference,
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

  async updateBankTransfer(id: number, associationId: number, data: Partial<BankTransferInput & { status: string }>) {
    return prisma.bankTransfer.update({
      where: { id },
      data: {
        transactionId: data.transactionId,
        bankAccountId: data.bankAccountId,
        memberId: data.memberId,
        senderBankName: data.senderBankName,
        senderAccountNumber: data.senderAccountNumber,
        senderAccountName: data.senderAccountName,
        amount: data.amount,
        reference: data.reference,
        transferDate: data.transferDate ? new Date(data.transferDate) : undefined,
        narration: data.narration,
        notes: data.notes,
        status: data.status as any,
      },
    });
  },

  async verifyBankTransfer(id: number, associationId: number, userId: number, status: 'VERIFIED' | 'REJECTED', notes?: string) {
    return prisma.bankTransfer.update({
      where: { id },
      data: {
        status,
        verifiedBy: userId,
        verifiedAt: new Date(),
        notes: notes || undefined,
      },
    });
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
      transfers,
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
    return prisma.bankTransfer.findFirst({
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
        bankTransferId: data.bankTransferId,
        memberId,
        filename: data.filename,
        filepath: data.filepath,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
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

  async verifyPaymentProof(
    id: number,
    associationId: number,
    userId: number,
    verification: PaymentProofVerification
  ) {
    const proof = await prisma.paymentProof.update({
      where: { id },
      data: {
        status: verification.status,
        verifiedBy: userId,
        verifiedAt: new Date(),
        rejectionReason: verification.rejectionReason,
        notes: verification.notes,
      },
      include: {
        transaction: true,
        bankTransfer: true,
      },
    });

    // If approved and linked to a transaction, update transaction status
    if (verification.status === 'APPROVED' && proof.transactionId) {
      await prisma.transaction.update({
        where: { id: proof.transactionId },
        data: {
          status: 'paid',
          paymentDate: new Date(),
          paymentMethod: 'bank_transfer',
        },
      });

      // Create payment record
      const paymentCount = await prisma.payment.count({ where: { associationId } });
      const payment = await prisma.payment.create({
        data: {
          associationId,
          transactionId: proof.transactionId,
          amountPaid: proof.transaction!.amount,
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
    }

    // If approved and linked to bank transfer, update transfer status
    if (verification.status === 'APPROVED' && proof.bankTransferId) {
      await prisma.bankTransfer.update({
        where: { id: proof.bankTransferId },
        data: {
          status: 'VERIFIED',
          verifiedBy: userId,
          verifiedAt: new Date(),
        },
      });
    }

    return proof;
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

    const where: any = { associationId };
    if (status) where.status = status;
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
      proofs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + proofs.length < totalCount,
      },
    };
  },

  async getPaymentProofById(id: number, associationId: number) {
    return prisma.paymentProof.findFirst({
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
