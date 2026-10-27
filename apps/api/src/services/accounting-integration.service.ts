/**
 * ACCOUNTING INTEGRATION SERVICE
 * 
 * Central service for integrating all financial modules with the accounting system.
 * Automatically creates journal entries for transactions across Finance, Welfare,
 * Cooperatives, and Nigerian Payments modules.
 * 
 * @module accounting-integration.service
 * @author SocietyLedger Development Team
 * @date January 11, 2026
 */

import { prisma } from '../lib/prisma';
import { accountingService } from '../modules/accounting/accounting.service';
import { Decimal } from '@prisma/client/runtime/library';
import { AsyncLocalStorage } from 'async_hooks';
import { STANDARD_CHART_OF_ACCOUNTS } from '../modules/accounting/accounting.types';
import { chargeMapping, receivableCodeFor } from '../modules/accounting/posting-rules';

// Cash collected by an officer sits in "Cash in hand" until it is lodged and verified, not in the bank account.
// Only code running inside runAsCashCollection() sees that; every other caller keeps the default bank account.
export const CASH_IN_HAND_CODE = '1114';
const BANK_OPERATING_CODE = '1112';
const cashCollectionContext = new AsyncLocalStorage<{ active: true }>();

export function runAsCashCollection<T>(fn: () => Promise<T>): Promise<T> {
  return cashCollectionContext.run({ active: true }, fn);
}

// ============================================
// TYPE DEFINITIONS
// ============================================

interface JournalEntryData {
  entryDate: string;
  description: string;
  reference: string;
  lines: {
    accountId: number;
    debitAmount: number;
    creditAmount: number;
    description: string;
  }[];
}

// ============================================
// ACCOUNTING INTEGRATION SERVICE
// ============================================

export const accountingIntegrationService = {
  
  // ==========================================
  // CORE HELPER METHODS
  // ==========================================
  
  /**
   * Check if accounting is initialized for an association
   */
  async checkAccountingInitialized(associationId: number): Promise<boolean> {
    try {
      const accountCount = await prisma.chartOfAccount.count({
        where: { associationId }
      });
      return accountCount > 0;
    } catch (error) {
      console.error('Error checking accounting initialization:', error);
      return false;
    }
  },
  
  /**
   * Find an account by code for an association
   */
  async findAccount(associationId: number, code: string) {
    try {
      return await prisma.chartOfAccount.findFirst({
        where: { 
          associationId, 
          code, 
          isActive: true 
        }
      });
    } catch (error) {
      console.error(`Error finding account ${code}:`, error);
      return null;
    }
  },
  
  /**
   * Find an account by code, or create it from the standard chart when this association's chart was set up before that account
   * existed (for example 1123 Donation Pledges Receivable). Only call it for an association whose accounting is initialised.
   */
  async findOrCreateStandardAccount(associationId: number, code: string) {
    const existing = await this.findAccount(associationId, code);
    if (existing) return existing;
    const standard = STANDARD_CHART_OF_ACCOUNTS.find((account) => account.code === code);
    if (!standard) return null;
    try {
      return await prisma.chartOfAccount.create({
        data: {
          associationId,
          code,
          name: standard.name,
          type: standard.type,
          subType: standard.subType,
          description: standard.description,
          normalBalance: standard.normalBalance ?? (standard.type === 'ASSET' || standard.type === 'EXPENSE' ? 'DEBIT' : 'CREDIT'),
          isSystemAccount: true,
        },
      });
    } catch {
      // Lost a race with another request creating it.
      return this.findAccount(associationId, code);
    }
  },

  /** Whether a charge or payment has already been posted to the books (so a repeated sync, or a repair, never posts it twice). */
  async hasPostedEntryFor(associationId: number, sourceTable: 'Transaction' | 'Payment', sourceId: number): Promise<boolean> {
    const entry = await prisma.journalEntry.findFirst({
      where: { associationId, sourceType: `auto_sync:${sourceTable}`, sourceId },
      select: { id: true },
    });
    return Boolean(entry);
  },

  /**
   * The account an inflow is debited to: the operating bank account by default, or "Cash in hand"
   * (created on first use) when called inside a cash collection.
   */
  async findInflowAccount(associationId: number) {
    if (!cashCollectionContext.getStore()?.active) {
      return this.findAccount(associationId, BANK_OPERATING_CODE);
    }
    return this.ensureCashInHandAccount(associationId);
  },

  async ensureCashInHandAccount(associationId: number) {
    const existing = await this.findAccount(associationId, CASH_IN_HAND_CODE);
    if (existing) return existing;
    const parent = await this.findAccount(associationId, '1110');
    try {
      return await prisma.chartOfAccount.create({
        data: {
          associationId,
          code: CASH_IN_HAND_CODE,
          name: 'Cash in Hand - Officers',
          type: 'ASSET',
          subType: 'current_asset',
          normalBalance: 'DEBIT',
          isSystemAccount: true,
          parentId: parent?.id ?? null,
        },
      });
    } catch {
      // Lost a race with another request creating it.
      return this.findAccount(associationId, CASH_IN_HAND_CODE);
    }
  },

  /**
   * Create and auto-post a journal entry
   */
  async createAndPostJournalEntry(
    associationId: number,
    userId: number,
    entryData: JournalEntryData,
    sourceTable: string,
    sourceId: number
  ) {
    try {
      // Written already posted, in one step (an automatic entry is never left half done). createJournalEntry enforces the
      // accounting-period check shared with the manual path — a closed/locked period throws here, gets caught below, logged via
      // logSyncFailure, and re-thrown; every onX... caller already swallows that non-critically, so the underlying business
      // action (recording a payment, etc.) is never blocked by an accounting period.
      const entry = await accountingService.createJournalEntry(
        associationId,
        userId,
        {
          ...entryData,
          entryDate: entryData.entryDate,
          description: entryData.description,
          reference: entryData.reference,
          lines: entryData.lines
        },
        { source: { type: sourceTable, id: sourceId }, autoPost: true }
      );

      // Update source record with sync status
      await this.updateSyncStatus(sourceTable, sourceId, entry.id);
      
      console.log(`✅ Synced ${sourceTable}:${sourceId} to accounting (Entry: ${entry.entryNumber})`);
      
      return entry;
    } catch (error) {
      await this.logSyncFailure(associationId, userId, sourceTable, sourceId, error);
      throw error;
    }
  },
  
  /**
   * Post the mirror image of an already-posted entry (debits and credits swapped), e.g. when a cash receipt is voided.
   * Does nothing when the original was never posted.
   */
  async reverseJournalEntry(associationId: number, userId: number, originalEntryId: number | null | undefined, description: string, reference: string) {
    if (!originalEntryId) return null;
    const lines = await prisma.journalEntryLine.findMany({ where: { journalEntryId: originalEntryId } });
    if (lines.length === 0) return null;

    return this.createAndPostJournalEntry(
      associationId,
      userId,
      {
        entryDate: new Date().toISOString(),
        description,
        reference,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debitAmount: Number(l.creditAmount),
          creditAmount: Number(l.debitAmount),
          description: 'Reversal',
        })),
      },
      'CashReversal',
      originalEntryId,
    );
  },

  /**
   * Update sync status on source record
   */
  async updateSyncStatus(tableName: string, recordId: number, entryId: number) {
    try {
      const updateData = {
        accountingSynced: true,
        accountingEntryId: entryId
      } as any; // Type assertion for Prisma update
      
      switch (tableName) {
        case 'Transaction':
          await prisma.transaction.update({
            where: { id: recordId },
            data: updateData
          });
          break;
        case 'Payment':
          await prisma.payment.update({
            where: { id: recordId },
            data: updateData
          });
          break;
        case 'WelfareContribution':
          await prisma.welfareContribution.update({
            where: { id: recordId },
            data: updateData
          });
          break;
        case 'WelfarePayoutRequest':
          await prisma.welfarePayoutRequest.update({
            where: { id: recordId },
            data: updateData
          });
          break;
        case 'SavingsTransaction':
          await prisma.savingsTransaction.update({
            where: { id: recordId },
            data: updateData
          });
          break;
        case 'Loan':
          await prisma.loan.update({
            where: { id: recordId },
            data: updateData
          });
          break;
        case 'LoanRepayment':
          await prisma.loanRepayment.update({
            where: { id: recordId },
            data: updateData
          });
          break;
        case 'CashLodgment':
          await prisma.cashLodgment.update({
            where: { id: recordId },
            data: { accountingEntryId: entryId }
          });
          break;
        case 'CashReversal':
          break; // a reversal has no source row of its own to mark
        case 'BooksCorrection':
          break; // a correction is tied to its charge by id, and has no flag of its own to set
        default:
          console.warn(`Unknown table name for sync status update: ${tableName}`);
      }
    } catch (error) {
      console.error(`Error updating sync status for ${tableName}:${recordId}:`, error);
      // Don't throw - this is not critical
    }
  },
  
  /**
   * Log sync failure for troubleshooting
   */
  async logSyncFailure(associationId: number, userId: number, tableName: string, recordId: number, error: any) {
    try {
      console.error(`❌ Accounting sync failed for ${tableName}:${recordId}:`, error);

      // Log to audit table with correct associationId and a real userId —
      // userId: 0 has no matching User row and always violated the FK silently (G89)
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'ACCOUNTING_SYNC_FAILED',
          tableName,
          recordId,
          newValues: { 
            error: error.message || 'Unknown error',
            stack: error.stack
          }
        }
      });
    } catch (logError) {
      console.error('Error logging sync failure:', logError);
    }
  },
  
  // ==========================================
  // FINANCE MODULE INTEGRATION
  // ==========================================
  
  /**
   * Sync transaction creation to accounting
   * Creates journal entry: Debit Receivable, Credit Income
   */
  async onTransactionCreated(transaction: any, userId: number) {
    const hasAccounting = await this.checkAccountingInitialized(transaction.associationId);
    if (!hasAccounting) {
      console.log(`⏭️  Skipping accounting sync - not initialized for association ${transaction.associationId}`);
      return;
    }
    
    try {
      // Already on the books (a repeated sync, a restore, a repair): never post a charge twice.
      if (await this.hasPostedEntryFor(transaction.associationId, 'Transaction', transaction.id)) return;

      // Dues and penalties -> Dues Receivable, levy -> Levy Receivable, donation -> Donation Pledges Receivable; credit the matching income.
      const categoryType = transaction.category?.type || 'due';
      const mapping = chargeMapping(categoryType);

      if (!mapping) {
        throw new Error(`No account mapping defined for category type "${categoryType}" — add one before using this category`);
      }

      const debitAccount = await this.findOrCreateStandardAccount(transaction.associationId, mapping.debitCode);
      const creditAccount = await this.findOrCreateStandardAccount(transaction.associationId, mapping.creditCode);
      
      if (!debitAccount || !creditAccount) {
        throw new Error(`Required accounts not found (${mapping.debitCode}, ${mapping.creditCode}). Please initialize chart of accounts.`);
      }
      
      const memberName = `${transaction.member?.firstName || ''} ${transaction.member?.lastName || ''}`.trim();
      
      await this.createAndPostJournalEntry(
        transaction.associationId,
        userId,
        {
          entryDate: transaction.createdAt.toISOString(),
          description: `${transaction.category?.name || 'Transaction'} - ${memberName}`,
          reference: transaction.referenceNumber,
          lines: [
            {
              accountId: debitAccount.id,
              debitAmount: Number(transaction.amount),
              creditAmount: 0,
              description: `${categoryType} receivable`
            },
            {
              accountId: creditAccount.id,
              debitAmount: 0,
              creditAmount: Number(transaction.amount),
              description: `${categoryType} income`
            }
          ]
        },
        'Transaction',
        transaction.id
      );
    } catch (error) {
      // Re-thrown (not swallowed) so a bulk-sync caller can report this as a real failure
      // instead of a false "synced" — every real-time call site already wraps this in its
      // own try/catch, so the underlying business action is still never blocked by this.
      console.error('Failed to sync transaction to accounting:', error);
      throw error;
    }
  },
  
  /**
   * Sync payment recording to accounting
   * Creates journal entry: Debit Cash, Credit Receivable
   */
  async onPaymentRecorded(payment: any, userId: number) {
    const hasAccounting = await this.checkAccountingInitialized(payment.associationId);
    if (!hasAccounting) {
      console.log(`⏭️  Skipping accounting sync - not initialized for association ${payment.associationId}`);
      return;
    }
    
    try {
      // Already on the books (a repeated sync, a repeated webhook, a repair): never post a payment twice.
      if (await this.hasPostedEntryFor(payment.associationId, 'Payment', payment.id)) return;

      const cashAccount = await this.findInflowAccount(payment.associationId); // Bank Account - Operating (Cash in hand inside a cash collection)

      // The payment clears the same receivable its charge created: dues/penalty 1121, levy 1122, donation 1123
      const categoryType = payment.transaction?.category?.type || 'due';
      const receivableCode = receivableCodeFor(categoryType);
      const receivableAccount = await this.findOrCreateStandardAccount(payment.associationId, receivableCode);
      
      if (!cashAccount || !receivableAccount) {
        throw new Error('Required accounts not found (1112/1114 and the receivable account)');
      }
      
      const memberName = `${payment.transaction?.member?.firstName || ''} ${payment.transaction?.member?.lastName || ''}`.trim();
      
      await this.createAndPostJournalEntry(
        payment.associationId,
        userId,
        {
          entryDate: payment.paymentDate.toISOString(),
          description: `Payment received - ${memberName}`,
          reference: payment.receiptNumber,
          lines: [
            {
              accountId: cashAccount.id,
              debitAmount: Number(payment.amountPaid),
              creditAmount: 0,
              description: 'Cash received'
            },
            {
              accountId: receivableAccount.id,
              debitAmount: 0,
              creditAmount: Number(payment.amountPaid),
              description: 'Receivable cleared'
            }
          ]
        },
        'Payment',
        payment.id
      );
    } catch (error) {
      console.error('Failed to sync payment to accounting:', error);
      throw error;
    }
  },
  
  /**
   * Undo the books for charges and payments that no longer exist (deleted, or voided with their receipt): post the mirror image of
   * every posted entry that came from them, including earlier corrections, skipping any that were already reversed.
   * Returns how many entries were reversed. One entry failing never stops the rest.
   */
  async reverseEntriesForSources(
    associationId: number,
    userId: number,
    sources: { transactionIds?: number[]; paymentIds?: number[] },
    description: string,
    reference: string,
  ): Promise<number> {
    const transactionIds = sources.transactionIds ?? [];
    const paymentIds = sources.paymentIds ?? [];
    if (transactionIds.length === 0 && paymentIds.length === 0) return 0;

    const originals = await prisma.journalEntry.findMany({
      where: {
        associationId,
        status: 'POSTED',
        OR: [
          ...(transactionIds.length ? [{ sourceType: { in: ['auto_sync:Transaction', 'auto_sync:BooksCorrection'] }, sourceId: { in: transactionIds } }] : []),
          ...(paymentIds.length ? [{ sourceType: 'auto_sync:Payment', sourceId: { in: paymentIds } }] : []),
        ],
      },
      select: { id: true },
    });
    if (originals.length === 0) return 0;

    const alreadyReversed = new Set(
      (
        await prisma.journalEntry.findMany({
          where: { associationId, sourceType: 'auto_sync:CashReversal', sourceId: { in: originals.map((entry) => entry.id) } },
          select: { sourceId: true },
        })
      ).map((entry) => entry.sourceId),
    );

    let reversed = 0;
    for (const original of originals) {
      if (alreadyReversed.has(original.id)) continue;
      try {
        if (await this.reverseJournalEntry(associationId, userId, original.id, description, reference)) reversed += 1;
      } catch (error) {
        console.error(`Could not reverse journal entry ${original.id} (non-critical):`, error);
      }
    }
    return reversed;
  },

  /**
   * A verified cash lodgment: the officer's cash in hand is now in the bank. Debit the operating bank account, credit Cash in hand.
   */
  async onCashLodgmentVerified(
    lodgment: { id: number; associationId: number; amount: any; depositDate: Date; bankReference: string | null },
    bankName: string,
    userId: number,
  ) {
    const hasAccounting = await this.checkAccountingInitialized(lodgment.associationId);
    if (!hasAccounting) return null;

    const bankAccount = await this.findAccount(lodgment.associationId, BANK_OPERATING_CODE);
    const cashInHand = await this.ensureCashInHandAccount(lodgment.associationId);
    if (!bankAccount || !cashInHand) {
      throw new Error('Required accounts not found (1112, 1114)');
    }

    return this.createAndPostJournalEntry(
      lodgment.associationId,
      userId,
      {
        entryDate: lodgment.depositDate.toISOString(),
        description: `Cash lodged into ${bankName}`,
        reference: lodgment.bankReference || `LODGMENT-${lodgment.id}`,
        lines: [
          { accountId: bankAccount.id, debitAmount: Number(lodgment.amount), creditAmount: 0, description: 'Cash paid into the bank' },
          { accountId: cashInHand.id, debitAmount: 0, creditAmount: Number(lodgment.amount), description: 'Cash in hand lodged' },
        ],
      },
      'CashLodgment',
      lodgment.id,
    );
  },

  // ==========================================
  // WELFARE MODULE INTEGRATION
  // ==========================================
  
  /**
   * Sync welfare contribution confirmation to accounting
   * Creates journal entry: Debit Cash, Credit Welfare Liability
   */
  async onWelfareContributionConfirmed(contribution: any, fund: any, userId: number) {
    const hasAccounting = await this.checkAccountingInitialized(contribution.associationId);
    if (!hasAccounting) {
      console.log(`⏭️  Skipping accounting sync - not initialized for association ${contribution.associationId}`);
      return;
    }
    
    try {
      const cashAccount = await this.findInflowAccount(contribution.associationId); // Bank Account
      const welfareAccount = await this.findAccount(contribution.associationId, '2300'); // Welfare Fund Liability
      
      if (!cashAccount || !welfareAccount) {
        throw new Error('Required accounts not found (1112, 2300). Please initialize chart of accounts.');
      }
      
      await this.createAndPostJournalEntry(
        contribution.associationId,
        userId,
        {
          entryDate: contribution.contributionDate.toISOString(),
          description: `Welfare contribution - ${fund.name}`,
          reference: `WC-${contribution.id}`,
          lines: [
            {
              accountId: cashAccount.id,
              debitAmount: Number(contribution.amount),
              creditAmount: 0,
              description: 'Cash received'
            },
            {
              accountId: welfareAccount.id,
              debitAmount: 0,
              creditAmount: Number(contribution.amount),
              description: `${fund.name} liability`
            }
          ]
        },
        'WelfareContribution',
        contribution.id
      );
    } catch (error) {
      console.error('Failed to sync welfare contribution to accounting:', error);
      throw error;
    }
  },
  
  /**
   * Sync welfare payout disbursement to accounting
   * Creates journal entry: Debit Welfare Liability, Credit Cash
   */
  async onWelfarePayoutDisbursed(payout: any, fund: any, userId: number) {
    const hasAccounting = await this.checkAccountingInitialized(payout.associationId);
    if (!hasAccounting) {
      console.log(`⏭️  Skipping accounting sync - not initialized for association ${payout.associationId}`);
      return;
    }
    
    try {
      const cashAccount = await this.findAccount(payout.associationId, '1112');
      const welfareAccount = await this.findAccount(payout.associationId, '2300');
      
      if (!cashAccount || !welfareAccount) {
        throw new Error('Required accounts not found (1112, 2300)');
      }
      
      const amount = payout.approvedAmount || payout.amount;
      
      await this.createAndPostJournalEntry(
        payout.associationId,
        userId,
        {
          entryDate: payout.disbursedAt.toISOString(),
          description: `Welfare payout - ${payout.payoutType}`,
          reference: payout.requestNumber,
          lines: [
            {
              accountId: welfareAccount.id,
              debitAmount: Number(amount),
              creditAmount: 0,
              description: `${fund.name} payout`
            },
            {
              accountId: cashAccount.id,
              debitAmount: 0,
              creditAmount: Number(amount),
              description: 'Cash disbursed'
            }
          ]
        },
        'WelfarePayoutRequest',
        payout.id
      );
    } catch (error) {
      console.error('Failed to sync welfare payout to accounting:', error);
      throw error;
    }
  },
  
  // ==========================================
  // COOPERATIVES MODULE INTEGRATION
  // ==========================================
  
  /**
   * Sync savings deposit to accounting
   * Creates journal entry: Debit Cash, Credit Savings Liability
   */
  async onSavingsDeposit(transaction: any, account: any, userId: number) {
    const hasAccounting = await this.checkAccountingInitialized(transaction.associationId);
    if (!hasAccounting) {
      console.log(`⏭️  Skipping accounting sync - not initialized for association ${transaction.associationId}`);
      return;
    }
    
    try {
      const cashAccount = await this.findInflowAccount(transaction.associationId);
      const savingsAccount = await this.findAccount(transaction.associationId, '2400'); // Member Savings Liability

      if (!cashAccount || !savingsAccount) {
        throw new Error('Required accounts not found (1112, 2400)');
      }

      await this.createAndPostJournalEntry(
        transaction.associationId,
        userId,
        {
          entryDate: transaction.transactionDate.toISOString(),
          description: `Savings deposit - ${account.accountNumber}`,
          reference: transaction.reference || `SD-${transaction.id}`,
          lines: [
            {
              accountId: cashAccount.id,
              debitAmount: Number(transaction.amount),
              creditAmount: 0,
              description: 'Cash received'
            },
            {
              accountId: savingsAccount.id,
              debitAmount: 0,
              creditAmount: Number(transaction.amount),
              description: 'Member savings liability'
            }
          ]
        },
        'SavingsTransaction',
        transaction.id
      );
    } catch (error) {
      console.error('Failed to sync savings deposit to accounting:', error);
      throw error;
    }
  },
  
  /**
   * Sync savings withdrawal to accounting
   * Creates journal entry: Debit Savings Liability, Credit Cash
   */
  async onSavingsWithdrawal(transaction: any, account: any, userId: number) {
    const hasAccounting = await this.checkAccountingInitialized(transaction.associationId);
    if (!hasAccounting) {
      console.log(`⏭️  Skipping accounting sync - not initialized for association ${transaction.associationId}`);
      return;
    }
    
    try {
      const cashAccount = await this.findAccount(transaction.associationId, '1112');
      const savingsAccount = await this.findAccount(transaction.associationId, '2400');
      
      if (!cashAccount || !savingsAccount) {
        throw new Error('Required accounts not found (1112, 2400)');
      }
      
      await this.createAndPostJournalEntry(
        transaction.associationId,
        userId,
        {
          entryDate: transaction.transactionDate.toISOString(),
          description: `Savings withdrawal - ${account.accountNumber}`,
          reference: transaction.reference || `SW-${transaction.id}`,
          lines: [
            {
              accountId: savingsAccount.id,
              debitAmount: Number(transaction.amount),
              creditAmount: 0,
              description: 'Member savings liability'
            },
            {
              accountId: cashAccount.id,
              debitAmount: 0,
              creditAmount: Number(transaction.amount),
              description: 'Cash paid out'
            }
          ]
        },
        'SavingsTransaction',
        transaction.id
      );
    } catch (error) {
      console.error('Failed to sync savings withdrawal to accounting:', error);
      throw error;
    }
  },
  
  /**
   * Sync loan disbursement to accounting
   * Creates journal entry: Debit Loans Receivable, Credit Cash
   */
  async onLoanDisbursed(loan: any, application: any, userId: number) {
    const hasAccounting = await this.checkAccountingInitialized(loan.associationId);
    if (!hasAccounting) {
      console.log(`⏭️  Skipping accounting sync - not initialized for association ${loan.associationId}`);
      return;
    }
    
    try {
      const cashAccount = await this.findAccount(loan.associationId, '1112');
      const loansReceivableAccount = await this.findAccount(loan.associationId, '1300'); // Loans Receivable
      
      if (!cashAccount || !loansReceivableAccount) {
        throw new Error('Required accounts not found (1112, 1300)');
      }
      
      await this.createAndPostJournalEntry(
        loan.associationId,
        userId,
        {
          entryDate: loan.disbursedAt.toISOString(),
          description: `Loan disbursed - ${loan.loanNumber}`,
          reference: loan.loanNumber,
          lines: [
            {
              accountId: loansReceivableAccount.id,
              debitAmount: Number(loan.principalAmount),
              creditAmount: 0,
              description: 'Loan receivable'
            },
            {
              accountId: cashAccount.id,
              debitAmount: 0,
              creditAmount: Number(loan.principalAmount),
              description: 'Cash disbursed'
            }
          ]
        },
        'Loan',
        loan.id
      );
    } catch (error) {
      console.error('Failed to sync loan disbursement to accounting:', error);
      throw error;
    }
  },
  
  /**
   * Sync loan repayment to accounting
   * Creates journal entry: Debit Cash, Credit Loans Receivable + Interest Income
   */
  async onLoanRepayment(repayment: any, loan: any, userId: number) {
    const hasAccounting = await this.checkAccountingInitialized(repayment.associationId);
    if (!hasAccounting) {
      console.log(`⏭️  Skipping accounting sync - not initialized for association ${repayment.associationId}`);
      return;
    }
    
    try {
      const cashAccount = await this.findInflowAccount(repayment.associationId);
      const loansReceivableAccount = await this.findAccount(repayment.associationId, '1300');
      const interestIncomeAccount = await this.findAccount(repayment.associationId, '4800'); // Loan Interest Income
      
      if (!cashAccount || !loansReceivableAccount || !interestIncomeAccount) {
        throw new Error('Required accounts not found (1112, 1300, 4800)');
      }
      
      const lines = [
        {
          accountId: cashAccount.id,
          debitAmount: Number(repayment.amount),
          creditAmount: 0,
          description: 'Cash received'
        },
        {
          accountId: loansReceivableAccount.id,
          debitAmount: 0,
          creditAmount: Number(repayment.principalPortion),
          description: 'Principal repayment'
        }
      ];
      
      // Add interest line if applicable
      const interestPortion = new Decimal(repayment.interestPortion || 0);
      if (interestPortion.greaterThan(0)) {
        lines.push({
          accountId: interestIncomeAccount.id,
          debitAmount: 0,
          creditAmount: Number(repayment.interestPortion),
          description: 'Interest income'
        });
      }
      
      await this.createAndPostJournalEntry(
        repayment.associationId,
        userId,
        {
          entryDate: repayment.paymentDate.toISOString(),
          description: `Loan repayment - ${loan.loanNumber}`,
          reference: repayment.reference || `LR-${repayment.id}`,
          lines
        },
        'LoanRepayment',
        repayment.id
      );
    } catch (error) {
      console.error('Failed to sync loan repayment to accounting:', error);
      throw error;
    }
  },
};




