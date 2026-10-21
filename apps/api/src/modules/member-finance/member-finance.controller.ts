import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { SettingsService } from '../settings/settings.service';

// Validation schemas
// Same canonical 6-value set used everywhere else (finance.controller.ts, welfare.validation.ts,
// the dashboard's PAYMENT_METHOD_CONFIG) — this validator previously used a different,
// uppercase 5-value set with no "cheque"/"other" and a "POS" value nothing else recognised (G58)
const memberPaymentMethodSchema = z.enum(['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'other']);

// R7.2 (G17): paymentMethod no longer defaults to bank_transfer here — bank transfer
// needs a real uploaded file, which this JSON endpoint can't carry, so it's submitted
// through POST /nigerian-payments/proofs (multipart) instead; see processPayment below.
const paymentSchema = z.object({
  transactionIds: z.array(z.number().int().positive()).min(1, 'At least one transaction is required'),
  paymentMethod: memberPaymentMethodSchema,
  declarationNote: z.string().min(20, 'Please describe the payment in more detail (at least 20 characters) — who it was paid to, when, and the circumstances'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const donationSchema = z.object({
  categoryId: z.number().int().positive('Category ID is required'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: memberPaymentMethodSchema.default('bank_transfer'),
  reference: z.string().optional(),
  notes: z.string().optional(),
  isAnonymous: z.boolean().default(false),
});

// Auto-links an admin-created member (userId: null) to the logged-in user by email on first
// access. Once linked, subsequent lookups find them by userId directly.
async function findAndAutoLinkMember(userId: number, associationId: number, userEmail?: string) {
  let member = await prisma.member.findFirst({ where: { userId, associationId } });
  if (!member && userEmail) {
    const byEmail = await prisma.member.findFirst({
      where: { email: userEmail, associationId, userId: null },
    });
    if (byEmail) {
      member = await prisma.member.update({ where: { id: byEmail.id }, data: { userId } });
    }
  }
  return member;
}

export const memberFinanceController = {
  // Get member's finance summary (overview)
  async getFinanceSummary(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Get member record for this user
      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);

      // If user is not a member, return empty summary (they might be admin without member profile)
      if (!member) {
        return res.json({
          success: true,
          message: 'No member profile found - this user may be an admin without a member record',
          data: {
            totalDue: 0,
            totalPaid: 0,
            paidThisMonth: 0,
            totalOutstanding: 0,
            overdueAmount: 0,
            overdueCount: 0,
            duesSummary: { total: 0, paid: 0, outstanding: 0, count: 0 },
            leviesSummary: { total: 0, paid: 0, outstanding: 0, count: 0 },
            penaltiesSummary: { total: 0, paid: 0, outstanding: 0, count: 0 },
            donationsSummary: { total: 0, count: 0 },
            recentTransactions: [],
            upcomingPayments: [],
            hasMemberProfile: false,
          },
        });
      }

      // Get all transactions for this member
      const transactions = await prisma.transaction.findMany({
        where: { memberId: member.id, associationId },
        include: {
          category: { select: { id: true, name: true, type: true } },
          payments: { select: { amountPaid: true, paymentDate: true } },
        },
      });

      // Get levy assignments
      const levyAssignments = await prisma.levyCampaignAssignment.findMany({
        where: { memberId: member.id },
        include: {
          campaign: { select: { id: true, name: true, targetAmount: true, deadline: true, status: true } },
          transaction: { include: { payments: true } },
        },
      });

      // Calculate summaries
      let totalDue = new Decimal(0);
      let totalPaid = new Decimal(0);
      let paidThisMonth = new Decimal(0);
      let overdueAmount = new Decimal(0);
      let overdueCount = 0;

      const duesSummary = { total: new Decimal(0), paid: new Decimal(0), outstanding: new Decimal(0), count: 0 };
      const leviesSummary = { total: new Decimal(0), paid: new Decimal(0), outstanding: new Decimal(0), count: 0 };
      const penaltiesSummary = { total: new Decimal(0), paid: new Decimal(0), outstanding: new Decimal(0), count: 0 };
      const donationsSummary = { total: new Decimal(0), count: 0 };

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      transactions.forEach(txn => {
        const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
        const paidThisTxnThisMonth = txn.payments
          .filter(p => new Date(p.paymentDate) >= monthStart)
          .reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
        paidThisMonth = paidThisMonth.plus(paidThisTxnThisMonth);
        const balance = new Decimal(txn.amount).minus(paid);
        
        totalDue = totalDue.plus(txn.amount);
        totalPaid = totalPaid.plus(paid);

        // Check if overdue
        if (txn.dueDate && new Date(txn.dueDate) < now && balance.greaterThan(0)) {
          overdueAmount = overdueAmount.plus(balance);
          overdueCount++;
        }

        // Categorize by type
        switch (txn.category.type) {
          case 'due':
            duesSummary.total = duesSummary.total.plus(txn.amount);
            duesSummary.paid = duesSummary.paid.plus(paid);
            duesSummary.outstanding = duesSummary.outstanding.plus(balance);
            duesSummary.count++;
            break;
          case 'levy':
            leviesSummary.total = leviesSummary.total.plus(txn.amount);
            leviesSummary.paid = leviesSummary.paid.plus(paid);
            leviesSummary.outstanding = leviesSummary.outstanding.plus(balance);
            leviesSummary.count++;
            break;
          case 'penalty':
            penaltiesSummary.total = penaltiesSummary.total.plus(txn.amount);
            penaltiesSummary.paid = penaltiesSummary.paid.plus(paid);
            penaltiesSummary.outstanding = penaltiesSummary.outstanding.plus(balance);
            penaltiesSummary.count++;
            break;
          case 'donation':
            donationsSummary.total = donationsSummary.total.plus(paid);
            donationsSummary.count++;
            break;
        }
      });

      // Get upcoming payments (pending/partial with due dates)
      const upcomingPayments = transactions
        .filter(txn => {
          const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
          return new Decimal(txn.amount).minus(paid).greaterThan(0) && txn.dueDate;
        })
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
        .slice(0, 5)
        .map(txn => {
          const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
          return {
            id: txn.id,
            category: txn.category,
            amount: txn.amount,
            balance: new Decimal(txn.amount).minus(paid),
            dueDate: txn.dueDate,
            status: txn.status,
          };
        });

      // Get recent transactions
      const recentTransactions = transactions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(txn => {
          const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
          return {
            id: txn.id,
            category: txn.category,
            amount: txn.amount,
            paid,
            balance: new Decimal(txn.amount).minus(paid),
            status: txn.status,
            createdAt: txn.createdAt,
          };
        });

      return res.status(200).json({
        success: true,
        data: {
          totalDue: Number(totalDue),
          totalPaid: Number(totalPaid),
          paidThisMonth: Number(paidThisMonth),
          totalOutstanding: Number(totalDue.minus(totalPaid)),
          overdueAmount: Number(overdueAmount),
          overdueCount,
          duesSummary: {
            total: Number(duesSummary.total),
            paid: Number(duesSummary.paid),
            outstanding: Number(duesSummary.outstanding),
            count: duesSummary.count,
          },
          leviesSummary: {
            total: Number(leviesSummary.total),
            paid: Number(leviesSummary.paid),
            outstanding: Number(leviesSummary.outstanding),
            count: leviesSummary.count,
          },
          penaltiesSummary: {
            total: Number(penaltiesSummary.total),
            paid: Number(penaltiesSummary.paid),
            outstanding: Number(penaltiesSummary.outstanding),
            count: penaltiesSummary.count,
          },
          donationsSummary: {
            total: Number(donationsSummary.total),
            count: donationsSummary.count,
          },
          upcomingPayments,
          recentTransactions,
        },
      });
    } catch (error) {
      console.error('Error fetching finance summary:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch finance summary' });
    }
  },

  // Get member's dues
  async getDues(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const transactions = await prisma.transaction.findMany({
        where: {
          memberId: member.id,
          associationId,
          category: { type: 'due' },
        },
        include: {
          category: { select: { id: true, name: true, type: true, frequency: true } },
          payments: { select: { id: true, amountPaid: true, paymentDate: true, paymentMethod: true } },
        },
        orderBy: { dueDate: 'asc' },
      });

      const dues = transactions.map(txn => {
        const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
        const balance = new Decimal(txn.amount).minus(paid);
        const isOverdue = txn.dueDate && new Date(txn.dueDate) < new Date() && balance.greaterThan(0);
        
        return {
          id: txn.id,
          referenceNumber: txn.referenceNumber,
          category: txn.category,
          amount: Number(txn.amount),
          paid: Number(paid),
          balance: Number(balance),
          dueDate: txn.dueDate,
          status: txn.status,
          isOverdue,
          payments: txn.payments,
          createdAt: txn.createdAt,
        };
      });

      return res.status(200).json({
        success: true,
        data: { dues },
      });
    } catch (error) {
      console.error('Error fetching dues:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch dues' });
    }
  },

  // Get member's levies
  async getLevies(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      // Get levy assignments for this member
      const assignments = await prisma.levyCampaignAssignment.findMany({
        where: { memberId: member.id },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              description: true,
              targetAmount: true,
              deadline: true,
              status: true,
              category: { select: { id: true, name: true, type: true } },
            },
          },
          transaction: {
            include: {
              payments: { select: { id: true, amountPaid: true, paymentDate: true, paymentMethod: true } },
            },
          },
        },
        orderBy: { campaign: { deadline: 'asc' } },
      });

      // Also include levy transactions that were created directly (not via a campaign assignment).
      // The finance summary counts these too, so the levies screen must show them for parity.
      const assignedTransactionIds = new Set(
        assignments.map(a => a.transactionId).filter((id): id is number => id !== null)
      );
      const orphanLevyTxns = await prisma.transaction.findMany({
        where: {
          memberId: member.id,
          associationId,
          category: { type: 'levy' },
          // Only rows with no campaign assignment (levyAssignment relation is null)
          levyAssignment: null,
        },
        include: {
          category: { select: { id: true, name: true, type: true } },
          payments: { select: { id: true, amountPaid: true, paymentDate: true, paymentMethod: true } },
        },
        orderBy: { dueDate: 'asc' },
      });

      const levies = [
        ...assignments.map(assignment => {
          const paid = assignment.transaction?.payments.reduce(
            (sum, p) => sum.plus(p.amountPaid),
            new Decimal(0)
          ) ?? new Decimal(0);
          const balance = new Decimal(assignment.amount).minus(paid);
          const isOverdue = assignment.campaign.deadline && new Date(assignment.campaign.deadline) < new Date() && balance.greaterThan(0);

          return {
            id: assignment.id,
            campaign: assignment.campaign,
            amount: Number(assignment.amount),
            paid: Number(paid),
            balance: Number(balance),
            status: assignment.status,
            isOverdue,
            transactionId: assignment.transactionId,
            assignedAt: assignment.assignedAt,
          };
        }),
        // Orphan levy transactions — synthesise a campaign-like shape from the transaction
        ...orphanLevyTxns
          .filter(txn => !assignedTransactionIds.has(txn.id))
          .map(txn => {
            const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
            const balance = new Decimal(txn.amount).minus(paid);
            const isOverdue = txn.dueDate && new Date(txn.dueDate) < new Date() && balance.greaterThan(0);

            return {
              id: -txn.id, // negative to avoid colliding with real assignment ids
              campaign: {
                id: 0,
                name: txn.notes?.replace(/^Levy Campaign:\s*/i, '') || txn.category.name,
                description: null,
                targetAmount: Number(txn.amount),
                deadline: txn.dueDate ? txn.dueDate.toISOString() : null,
                status: txn.status,
                category: txn.category,
              },
              amount: Number(txn.amount),
              paid: Number(paid),
              balance: Number(balance),
              status: txn.status,
              isOverdue,
              transactionId: txn.id,
              assignedAt: txn.createdAt.toISOString(),
            };
          }),
      ];

      return res.status(200).json({
        success: true,
        data: { levies },
      });
    } catch (error) {
      console.error('Error fetching levies:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch levies' });
    }
  },

  // Get member's penalties
  async getPenalties(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const transactions = await prisma.transaction.findMany({
        where: {
          memberId: member.id,
          associationId,
          category: { type: 'penalty' },
        },
        include: {
          category: { select: { id: true, name: true, type: true } },
          payments: { select: { id: true, amountPaid: true, paymentDate: true, paymentMethod: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const penalties = transactions.map(txn => {
        const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
        const balance = new Decimal(txn.amount).minus(paid);

        return {
          id: txn.id,
          referenceNumber: txn.referenceNumber,
          category: txn.category,
          amount: Number(txn.amount),
          paid: Number(paid),
          balance: Number(balance),
          reason: txn.notes,
          status: txn.status,
          payments: txn.payments,
          createdAt: txn.createdAt,
        };
      });

      return res.status(200).json({
        success: true,
        data: { penalties },
      });
    } catch (error) {
      console.error('Error fetching penalties:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch penalties' });
    }
  },

  // Get member's donations
  async getDonations(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      // Get donation transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          memberId: member.id,
          associationId,
          category: { type: 'donation' },
        },
        include: {
          category: { select: { id: true, name: true, type: true } },
          payments: { select: { id: true, amountPaid: true, paymentDate: true, paymentMethod: true } },
          donationRecord: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get donation categories for making new donations
      const donationCategories = await prisma.financialCategory.findMany({
        where: { associationId, type: 'donation', isActive: true },
        select: { id: true, name: true, description: true },
      });

      const donations = transactions.map(txn => {
        const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));

        return {
          id: txn.id,
          referenceNumber: txn.referenceNumber,
          category: txn.category,
          amount: Number(txn.amount), // Use transaction amount, not just paid amount
          amountPaid: Number(paid),   // Also include paid amount for reference
          purpose: txn.category.name,
          isAnonymous: txn.donationRecord?.isAnonymous || false,
          receiptNumber: txn.donationRecord?.receiptNumber,
          payments: txn.payments,
          createdAt: txn.createdAt,
        };
      });

      return res.status(200).json({
        success: true,
        data: { donations, donationCategories },
      });
    } catch (error) {
      console.error('Error fetching donations:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch donations' });
    }
  },

  // Get member's payment history
  async getPayments(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const payments = await prisma.payment.findMany({
        where: {
          associationId,
          transaction: { memberId: member.id },
        },
        include: {
          transaction: {
            include: {
              category: { select: { id: true, name: true, type: true } },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
      });

      const formattedPayments = payments.map(payment => ({
        id: payment.id,
        amount: Number(payment.amountPaid),
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        reference: payment.receiptNumber,
        transaction: {
          id: payment.transaction.id,
          referenceNumber: payment.transaction.referenceNumber,
          category: payment.transaction.category,
        },
        createdAt: payment.createdAt,
      }));

      return res.status(200).json({
        success: true,
        data: { payments: formattedPayments },
      });
    } catch (error) {
      console.error('Error fetching payments:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
  },

  // R7.2 (G17): member-safe view of the association's receiving bank accounts —
  // name/number/bank only, no internal fields. The existing officer endpoint for
  // this is gated by SETTINGS_VIEW, which members never hold.
  async getAssociationBankAccounts(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const accounts = await prisma.associationBankAccount.findMany({
        where: { associationId, isActive: true },
        select: { id: true, bankName: true, accountName: true, accountNumber: true, isDefault: true },
        orderBy: { isDefault: 'desc' },
      });

      return res.status(200).json({ success: true, data: { accounts } });
    } catch (error) {
      console.error('Error fetching association bank accounts:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch bank accounts' });
    }
  },

  // R7.2 (G17): a member's own submitted payment declarations/proofs — lets the
  // dashboard show "Awaiting Verification" instead of the plain outstanding status.
  async getMyPaymentProofs(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await prisma.member.findFirst({ where: { userId, associationId } });
      if (!member) {
        return res.status(200).json({ success: true, data: { proofs: [] } });
      }

      const proofs = await prisma.paymentProof.findMany({
        where: { associationId, memberId: member.id },
        orderBy: { uploadedAt: 'desc' },
        take: 50,
      });

      return res.status(200).json({ success: true, data: { proofs } });
    } catch (error) {
      console.error('Error fetching payment proofs:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch payment proofs' });
    }
  },

  // Get all outstanding items for payment
  async getOutstanding(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      // Get all transactions with outstanding balance
      const transactions = await prisma.transaction.findMany({
        where: {
          memberId: member.id,
          associationId,
          status: { in: ['pending', 'overdue', 'partial'] },
        },
        include: {
          category: { select: { id: true, name: true, type: true } },
          payments: { select: { amountPaid: true } },
          levyAssignment: {
            include: {
              campaign: { select: { name: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      });

      const items = transactions
        .map(txn => {
          const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
          const balance = new Decimal(txn.amount).minus(paid);

          if (balance.lessThanOrEqualTo(0)) return null;

          return {
            id: txn.id,
            type: txn.category.type as 'dues' | 'levy' | 'penalty',
            category: txn.category,
            campaign: txn.levyAssignment?.campaign,
            amount: Number(txn.amount),
            balance: Number(balance),
            dueDate: txn.dueDate,
          };
        })
        .filter(Boolean);

      return res.status(200).json({
        success: true,
        data: { items },
      });
    } catch (error) {
      console.error('Error fetching outstanding items:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch outstanding items' });
    }
  },


  // Process payment for selected transactions
  async processPayment(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const validatedData = paymentSchema.parse(req.body);

      // R7.2 (G17): bank transfer needs a real uploaded receipt, which this JSON
      // endpoint can't carry — the frontend submits that through the multipart
      // POST /nigerian-payments/proofs endpoint instead. Defensive guard in case
      // this is ever called directly with bank_transfer.
      if (validatedData.paymentMethod === 'bank_transfer') {
        return res.status(400).json({
          success: false,
          message: 'Bank Transfer payments require an uploaded receipt — use the proof-upload endpoint instead',
        });
      }

      // R4.6/G53 + G85: same enabledChannels check finance.controller.ts's recordPayment
      // already enforces.
      const paymentSettings = await SettingsService.getSettings(associationId, 'payments');
      const enabledChannels: string[] = paymentSettings.enabledChannels || [];
      if (enabledChannels.length > 0 && !enabledChannels.includes(validatedData.paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: `Payment method "${validatedData.paymentMethod}" is not enabled for this association`,
        });
      }

      // Verify all transactions belong to this member and are genuinely outstanding
      const transactions = await prisma.transaction.findMany({
        where: {
          id: { in: validatedData.transactionIds },
          memberId: member.id,
          associationId,
          status: { in: ['pending', 'overdue', 'partial'] },
        },
      });

      if (transactions.length !== validatedData.transactionIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some transactions not found or already paid',
        });
      }

      // R7.2 (G17): no Payment row and no status change yet — this only records a
      // pending declaration. An officer reviewing it from the verification queue is
      // what actually completes the payment (nigerian-payments.service.ts's
      // verifyPaymentProof, extended to handle transactionIds).
      const proof = await prisma.paymentProof.create({
        data: {
          associationId,
          memberId: member.id,
          transactionIds: validatedData.transactionIds,
          paymentMethod: validatedData.paymentMethod,
          declarationNote: validatedData.declarationNote,
          notes: validatedData.notes,
          status: 'PENDING',
        },
      });

      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'MEMBER_PAYMENT_DECLARED',
          tableName: 'payment_proofs',
          recordId: proof.id,
          newValues: {
            transactionIds: validatedData.transactionIds,
            paymentMethod: validatedData.paymentMethod,
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Your payment has been submitted for verification. It will appear once an officer approves it.',
        data: { proof },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error declaring payment:', error);
      return res.status(500).json({ success: false, message: 'Failed to submit payment for verification' });
    }
  },

  // Make a donation
  async makeDonation(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await findAndAutoLinkMember(userId, associationId, req.user?.email);

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const validatedData = donationSchema.parse(req.body);

      // Verify category exists and is a donation type
      const category = await prisma.financialCategory.findFirst({
        where: {
          id: validatedData.categoryId,
          associationId,
          type: 'donation',
          isActive: true,
        },
      });

      if (!category) {
        return res.status(404).json({ success: false, message: 'Donation category not found' });
      }

      // Create donation in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Generate reference numbers
        const txnCount = await tx.transaction.count({ where: { associationId } });
        const paymentCount = await tx.payment.count({ where: { associationId } });
        const donationCount = await tx.donationRecord.count({ where: { transaction: { associationId } } });

        const txnRef = `TXN${String(txnCount + 1).padStart(6, '0')}`;
        const receiptNumber = `PAY${String(paymentCount + 1).padStart(6, '0')}`;
        const donationReceiptNumber = `DON${String(donationCount + 1).padStart(6, '0')}`;

        // Create transaction
        const transaction = await tx.transaction.create({
          data: {
            associationId,
            memberId: member.id,
            categoryId: validatedData.categoryId,
            amount: validatedData.amount,
            referenceNumber: txnRef,
            status: 'paid',
            notes: validatedData.notes,
            createdBy: userId,
          },
        });

        // Create payment
        await tx.payment.create({
          data: {
            associationId,
            transactionId: transaction.id,
            amountPaid: validatedData.amount,
            paymentDate: new Date(),
            paymentMethod: validatedData.paymentMethod.toLowerCase(),
            receiptNumber,
            confirmedBy: userId,
            confirmedAt: new Date(),
          },
        });

        // Create donation record
        const donationRecord = await tx.donationRecord.create({
          data: {
            transactionId: transaction.id,
            isAnonymous: validatedData.isAnonymous,
            receiptNumber: donationReceiptNumber,
          },
        });

        return { transaction, donationRecord };
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'MEMBER_DONATION',
          tableName: 'donations',
          recordId: result.transaction.id,
          newValues: {
            amount: validatedData.amount,
            category: category.name,
            isAnonymous: validatedData.isAnonymous,
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Donation recorded successfully',
        data: {
          transactionId: result.transaction.id,
          receiptNumber: result.donationRecord.receiptNumber,
          amount: validatedData.amount,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error making donation:', error);
      return res.status(500).json({ success: false, message: 'Failed to record donation' });
    }
  },

  // Create or link member profile for current user
  async createOrLinkMemberProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      const userEmail = req.user?.email;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Check if user already has a member profile in this association
      const existingMember = await prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (existingMember) {
        return res.json({
          success: true,
          message: 'Member profile already exists',
          data: { member: existingMember, isNew: false },
        });
      }

      // Try to find a member by email to link
      if (userEmail) {
        const memberByEmail = await prisma.member.findFirst({
          where: { email: userEmail, associationId, userId: null },
        });

        if (memberByEmail) {
          // Link the existing member to this user
          const linkedMember = await prisma.member.update({
            where: { id: memberByEmail.id },
            data: { userId },
          });

          // Create audit log
          await prisma.auditLog.create({
            data: {
              associationId,
              userId,
              action: 'MEMBER_PROFILE_LINKED',
              tableName: 'members',
              recordId: linkedMember.id,
              newValues: { userId, linkedByEmail: userEmail },
            },
          });

          return res.json({
            success: true,
            message: 'Your user account has been linked to your existing member profile',
            data: { member: linkedMember, isNew: false, wasLinked: true },
          });
        }
      }

      // No existing member found - create a new one
      // Use email prefix as default name or generic placeholder
      const emailPrefix = userEmail ? userEmail.split('@')[0] : 'User';
      const nameParts = emailPrefix.trim().split(/[._-]/); // Split on common email separators
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || 'Account';

      // Generate a unique member ID
      const lastMember = await prisma.member.findFirst({
        where: { associationId },
        orderBy: { createdAt: 'desc' },
        select: { memberId: true },
      });

      let memberIdNumber = 1;
      if (lastMember?.memberId) {
        const match = lastMember.memberId.match(/(\d+)$/);
        if (match) {
          memberIdNumber = parseInt(match[1], 10) + 1;
        }
      }
      const memberIdPrefix = (await SettingsService.getSetting(associationId, 'members_access', 'memberIdPrefix')) || 'MEM';
      const memberId = `${memberIdPrefix}${memberIdNumber.toString().padStart(4, '0')}`;

      const newMember = await prisma.member.create({
        data: {
          associationId,
          userId,
          memberId,
          firstName,
          lastName,
          email: userEmail || null,
          phone: null,
          address: null,
          joinDate: new Date(),
          status: 'active',
          category: 'regular',
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'MEMBER_PROFILE_CREATED',
          tableName: 'members',
          recordId: newMember.id,
          newValues: { memberId, firstName, lastName, email: userEmail, createdBySelf: true },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Member profile created successfully',
        data: { member: newMember, isNew: true },
      });
    } catch (error) {
      console.error('Error creating/linking member profile:', error);
      return res.status(500).json({ success: false, message: 'Failed to create member profile' });
    }
  },

  // Check if current user has a member profile
  async checkMemberProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;
      const userEmail = req.user?.email;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      // Check for linked member profile
      const linkedMember = await prisma.member.findFirst({
        where: { userId, associationId },
        select: {
          id: true,
          memberId: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          category: true,
        },
      });

      if (linkedMember) {
        return res.json({
          success: true,
          data: {
            hasMemberProfile: true,
            isLinked: true,
            member: linkedMember,
          },
        });
      }

      // Check for unlinked member with same email
      if (userEmail) {
        const unlinkedMember = await prisma.member.findFirst({
          where: { email: userEmail, associationId, userId: null },
          select: {
            id: true,
            memberId: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            category: true,
          },
        });

        if (unlinkedMember) {
          return res.json({
            success: true,
            data: {
              hasMemberProfile: true,
              isLinked: false,
              canLink: true,
              member: unlinkedMember,
              message: 'A member profile with your email exists. You can link it to your account.',
            },
          });
        }
      }

      return res.json({
        success: true,
        data: {
          hasMemberProfile: false,
          isLinked: false,
          canCreate: true,
          message: 'No member profile found. You can create one.',
        },
      });
    } catch (error) {
      console.error('Error checking member profile:', error);
      return res.status(500).json({ success: false, message: 'Failed to check member profile' });
    }
  },

  // F2.8/F2.9: single call that gives the pay screen everything it needs before
  // the member chooses a method — Paystack availability + the association's
  // bank accounts to display for bank transfer.
  async getPaymentInfo(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      if (!associationId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      const [paystackEnabled, bankAccounts] = await Promise.all([
        SettingsService.getSetting(associationId, 'integrations', 'paystackEnabled'),
        prisma.associationBankAccount.findMany({
          where: { associationId, isActive: true },
          select: { id: true, bankName: true, accountName: true, accountNumber: true, isDefault: true },
          orderBy: { isDefault: 'desc' },
        }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          paystackEnabled: paystackEnabled !== false,
          bankAccounts,
        },
      });
    } catch (error) {
      console.error('Error fetching payment info:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch payment info' });
    }
  },
};
