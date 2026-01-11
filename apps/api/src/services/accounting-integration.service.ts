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
      // Create journal entry
      const entry = await accountingService.createJournalEntry(
        associationId,
        userId,
        {
          ...entryData,
          entryDate: entryData.entryDate,
          description: entryData.description,
          reference: entryData.reference,
          lines: entryData.lines
        }
      );
      
      // Auto-post the entry (skip approval workflow for auto-sync)
      await accountingService.postJournalEntry(associationId, entry.id);
      
      // Update source record with sync status
      await this.updateSyncStatus(sourceTable, sourceId, entry.id);
      
      console.log(`✅ Synced ${sourceTable}:${sourceId} to accounting (Entry: ${entry.entryNumber})`);
      
      return entry;
    } catch (error) {
      await this.logSyncFailure(sourceTable, sourceId, error);
      throw error;
    }
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
  async logSyncFailure(tableName: string, recordId: number, error: any) {
    try {
      console.error(`❌ Accounting sync failed for ${tableName}:${recordId}:`, error);
      
      // Log to audit table
      await prisma.auditLog.create({
        data: {
          associationId: 0, // Will be updated if we have context
          userId: 0,
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
      // Determine accounts based on transaction type
      const accountMappings: Record<string, { debitCode: string; creditCode: string }> = {
        due: { debitCode: '1121', creditCode: '4110' }, // Dues Receivable -> Membership Dues
        levy: { debitCode: '1122', creditCode: '4200' }, // Levy Receivable -> Levy Income
        donation: { debitCode: '1112', creditCode: '4300' }, // Bank -> Donation Income
        penalty: { debitCode: '1121', creditCode: '4400' }, // Receivable -> Penalty Income
      };
      
      const categoryType = transaction.category?.type || 'due';
      const mapping = accountMappings[categoryType] || accountMappings.due;
      
      const debitAccount = await this.findAccount(transaction.associationId, mapping.debitCode);
      const creditAccount = await this.findAccount(transaction.associationId, mapping.creditCode);
      
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
      console.error('Failed to sync transaction to accounting:', error);
      // Don't throw - allow transaction creation to succeed
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
      const cashAccount = await this.findAccount(payment.associationId, '1112'); // Bank Account - Operating
      
      // Determine receivable account based on transaction type
      const categoryType = payment.transaction?.category?.type || 'due';
      const receivableCode = categoryType === 'levy' ? '1122' : '1121';
      const receivableAccount = await this.findAccount(payment.associationId, receivableCode);
      
      if (!cashAccount || !receivableAccount) {
        throw new Error('Required accounts not found (1112, 1121/1122)');
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
      // Don't throw - allow payment recording to succeed
    }
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
      const cashAccount = await this.findAccount(contribution.associationId, '1112'); // Bank Account
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
      const cashAccount = await this.findAccount(transaction.associationId, '1112');
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
      const cashAccount = await this.findAccount(repayment.associationId, '1112');
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
    }
  },
};




