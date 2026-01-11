import { Request, Response } from 'express';

/**
 * ACCOUNTING SYNC MANAGEMENT CONTROLLER
 * Handles manual sync operations and sync status monitoring
 */
export const accountingSyncController = {
  /**
   * Get sync status for all modules
   * GET /api/accounting/sync/status
   */
  async getSyncStatus(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');

      // Get sync status for all modules
      const [
        transactionsTotal,
        transactionsSynced,
        paymentsTotal,
        paymentsSynced,
        welfareContributionsTotal,
        welfareContributionsSynced,
        welfarePayoutsTotal,
        welfarePayoutsSynced,
        savingsTransactionsTotal,
        savingsTransactionsSynced,
        loansTotal,
        loansSynced,
        loanRepaymentsTotal,
        loanRepaymentsSynced,
      ] = await Promise.all([
        prisma.transaction.count({ where: { associationId } }),
        prisma.transaction.count({ where: { associationId, accountingSynced: true } as any }),
        prisma.payment.count({ where: { associationId } }),
        prisma.payment.count({ where: { associationId, accountingSynced: true } as any }),
        prisma.welfareContribution.count({ where: { associationId, status: 'CONFIRMED' } }),
        prisma.welfareContribution.count({ where: { associationId, status: 'CONFIRMED', accountingSynced: true } as any }),
        prisma.welfarePayoutRequest.count({ where: { associationId, status: 'DISBURSED' } }),
        prisma.welfarePayoutRequest.count({ where: { associationId, status: 'DISBURSED', accountingSynced: true } as any }),
        prisma.savingsTransaction.count({ where: { associationId } }),
        prisma.savingsTransaction.count({ where: { associationId, accountingSynced: true } as any }),
        prisma.loan.count({ where: { associationId, status: { in: ['ACTIVE', 'PAID_OFF'] } } }),
        prisma.loan.count({ where: { associationId, status: { in: ['ACTIVE', 'PAID_OFF'] }, accountingSynced: true } as any }),
        prisma.loanRepayment.count({ where: { associationId } }),
        prisma.loanRepayment.count({ where: { associationId, accountingSynced: true } as any }),
      ]);

      const status = {
        finance: {
          transactions: {
            total: transactionsTotal,
            synced: transactionsSynced,
            unsynced: transactionsTotal - transactionsSynced,
            syncRate: transactionsTotal > 0 ? ((transactionsSynced / transactionsTotal) * 100).toFixed(2) : '0',
          },
          payments: {
            total: paymentsTotal,
            synced: paymentsSynced,
            unsynced: paymentsTotal - paymentsSynced,
            syncRate: paymentsTotal > 0 ? ((paymentsSynced / paymentsTotal) * 100).toFixed(2) : '0',
          },
        },
        welfare: {
          contributions: {
            total: welfareContributionsTotal,
            synced: welfareContributionsSynced,
            unsynced: welfareContributionsTotal - welfareContributionsSynced,
            syncRate: welfareContributionsTotal > 0 ? ((welfareContributionsSynced / welfareContributionsTotal) * 100).toFixed(2) : '0',
          },
          payouts: {
            total: welfarePayoutsTotal,
            synced: welfarePayoutsSynced,
            unsynced: welfarePayoutsTotal - welfarePayoutsSynced,
            syncRate: welfarePayoutsTotal > 0 ? ((welfarePayoutsSynced / welfarePayoutsTotal) * 100).toFixed(2) : '0',
          },
        },
        cooperatives: {
          savingsTransactions: {
            total: savingsTransactionsTotal,
            synced: savingsTransactionsSynced,
            unsynced: savingsTransactionsTotal - savingsTransactionsSynced,
            syncRate: savingsTransactionsTotal > 0 ? ((savingsTransactionsSynced / savingsTransactionsTotal) * 100).toFixed(2) : '0',
          },
          loans: {
            total: loansTotal,
            synced: loansSynced,
            unsynced: loansTotal - loansSynced,
            syncRate: loansTotal > 0 ? ((loansSynced / loansTotal) * 100).toFixed(2) : '0',
          },
          loanRepayments: {
            total: loanRepaymentsTotal,
            synced: loanRepaymentsSynced,
            unsynced: loanRepaymentsTotal - loanRepaymentsSynced,
            syncRate: loanRepaymentsTotal > 0 ? ((loanRepaymentsSynced / loanRepaymentsTotal) * 100).toFixed(2) : '0',
          },
        },
        overall: {
          total: transactionsTotal + paymentsTotal + welfareContributionsTotal + welfarePayoutsTotal + savingsTransactionsTotal + loansTotal + loanRepaymentsTotal,
          synced: transactionsSynced + paymentsSynced + welfareContributionsSynced + welfarePayoutsSynced + savingsTransactionsSynced + loansSynced + loanRepaymentsSynced,
        },
      };

      status.overall = {
        ...status.overall,
        unsynced: status.overall.total - status.overall.synced,
        syncRate: status.overall.total > 0 ? ((status.overall.synced / status.overall.total) * 100).toFixed(2) : '0',
      } as any;

      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error getting sync status:', error);
      return res.status(500).json({ success: false, message: 'Failed to get sync status' });
    }
  },

  /**
   * Bulk sync unsynced transactions
   * POST /api/accounting/sync/transactions/bulk
   */
  async bulkSyncTransactions(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');
      const { accountingIntegrationService } = await import('../../services/accounting-integration.service');

      // Get all unsynced transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          associationId,
          accountingSynced: false,
        } as any,
        include: {
          member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
          category: { select: { id: true, name: true, type: true } },
        },
        take: 100, // Limit to 100 at a time
      });

      let synced = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const transaction of transactions) {
        try {
          await accountingIntegrationService.onTransactionCreated(transaction, req.user!.id);
          synced++;
        } catch (error: any) {
          failed++;
          errors.push({
            transactionId: transaction.id,
            referenceNumber: transaction.referenceNumber,
            error: error.message,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} transactions, ${failed} failed`,
        data: {
          total: transactions.length,
          synced,
          failed,
          errors: errors.slice(0, 10), // Return first 10 errors
        },
      });
    } catch (error) {
      console.error('Error bulk syncing transactions:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync transactions' });
    }
  },

  /**
   * Bulk sync unsynced payments
   * POST /api/accounting/sync/payments/bulk
   */
  async bulkSyncPayments(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');
      const { accountingIntegrationService } = await import('../../services/accounting-integration.service');

      // Get all unsynced payments
      const payments = await prisma.payment.findMany({
        where: {
          associationId,
          accountingSynced: false,
        } as any,
        include: {
          transaction: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
              category: { select: { id: true, name: true, type: true } },
            },
          },
        },
        take: 100,
      });

      let synced = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const payment of payments) {
        try {
          await accountingIntegrationService.onPaymentRecorded(payment, req.user!.id);
          synced++;
        } catch (error: any) {
          failed++;
          errors.push({
            paymentId: payment.id,
            receiptNumber: payment.receiptNumber,
            error: error.message,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} payments, ${failed} failed`,
        data: {
          total: payments.length,
          synced,
          failed,
          errors: errors.slice(0, 10),
        },
      });
    } catch (error) {
      console.error('Error bulk syncing payments:', error);
      return res.status(500).json({ success: false, message: 'Failed to bulk sync payments' });
    }
  },

  /**
   * Get sync error logs
   * GET /api/accounting/sync/errors
   */
  async getSyncErrors(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const { prisma } = await import('../../lib/prisma');

      const errors = await prisma.auditLog.findMany({
        where: {
          associationId,
          action: 'ACCOUNTING_SYNC_FAILED',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      });

      return res.status(200).json({
        success: true,
        data: errors,
      });
    } catch (error) {
      console.error('Error getting sync errors:', error);
      return res.status(500).json({ success: false, message: 'Failed to get sync errors' });
    }
  },
};
