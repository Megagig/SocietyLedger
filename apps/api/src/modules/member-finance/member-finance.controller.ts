import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

// Validation schemas
const paymentSchema = z.object({
  transactionIds: z.array(z.number().int().positive()).min(1, 'At least one transaction is required'),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CARD', 'POS', 'MOBILE_MONEY']).default('BANK_TRANSFER'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const donationSchema = z.object({
  categoryId: z.number().int().positive('Category ID is required'),
  amount: z.number().positive('Amount must be positive'),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CARD', 'POS', 'MOBILE_MONEY']).default('BANK_TRANSFER'),
  reference: z.string().optional(),
  notes: z.string().optional(),
  isAnonymous: z.boolean().default(false),
});

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
      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
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
      let overdueAmount = new Decimal(0);
      let overdueCount = 0;

      const duesSummary = { total: new Decimal(0), paid: new Decimal(0), outstanding: new Decimal(0), count: 0 };
      const leviesSummary = { total: new Decimal(0), paid: new Decimal(0), outstanding: new Decimal(0), count: 0 };
      const penaltiesSummary = { total: new Decimal(0), paid: new Decimal(0), outstanding: new Decimal(0), count: 0 };
      const donationsSummary = { total: new Decimal(0), count: 0 };

      const now = new Date();

      transactions.forEach(txn => {
        const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
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

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

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

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

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
              category: { select: { id: true, name: true } },
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

      const levies = assignments.map(assignment => {
        const paid = assignment.transaction?.payments.reduce(
          (sum, p) => sum.plus(p.amountPaid),
          new Decimal(0)
        ) || new Decimal(0);
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
      });

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

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

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

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

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
          amount: Number(paid),
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

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

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

  // Get all outstanding items for payment
  async getOutstanding(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const associationId = req.user?.associationId;

      if (!associationId || !userId) {
        return res.status(400).json({ success: false, message: 'Authentication required' });
      }

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

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

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

      if (!member) {
        return res.status(404).json({ success: false, message: 'Member profile not found' });
      }

      const validatedData = paymentSchema.parse(req.body);

      // Verify all transactions belong to this member
      const transactions = await prisma.transaction.findMany({
        where: {
          id: { in: validatedData.transactionIds },
          memberId: member.id,
          associationId,
          status: { in: ['pending', 'overdue', 'partial'] },
        },
        include: {
          payments: { select: { amountPaid: true } },
          category: { select: { name: true, type: true } },
        },
      });

      if (transactions.length !== validatedData.transactionIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some transactions not found or already paid',
        });
      }

      // Process payments in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const payments = [];

        for (const txn of transactions) {
          const paid = txn.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
          const balance = new Decimal(txn.amount).minus(paid);

          if (balance.lessThanOrEqualTo(0)) continue;

          // Generate receipt number
          const paymentCount = await tx.payment.count({ where: { associationId } });
          const receiptNumber = `PAY${String(paymentCount + 1).padStart(6, '0')}`;

          // Create payment record
          const payment = await tx.payment.create({
            data: {
              associationId,
              transactionId: txn.id,
              amountPaid: balance,
              paymentDate: new Date(),
              paymentMethod: validatedData.paymentMethod.toLowerCase(),
              receiptNumber,
              confirmedBy: userId,
              confirmedAt: new Date(),
            },
          });

          // Update transaction status
          await tx.transaction.update({
            where: { id: txn.id },
            data: { status: 'paid' },
          });

          // Update levy assignment status if applicable
          await tx.levyCampaignAssignment.updateMany({
            where: { transactionId: txn.id },
            data: { status: 'paid' },
          });

          payments.push(payment);
        }

        return payments;
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'MEMBER_PAYMENT',
          tableName: 'payments',
          newValues: {
            transactionIds: validatedData.transactionIds,
            paymentCount: result.length,
            paymentMethod: validatedData.paymentMethod,
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: `Successfully recorded ${result.length} payment(s)`,
        data: { payments: result },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation error', errors: error.errors });
      }
      console.error('Error processing payment:', error);
      return res.status(500).json({ success: false, message: 'Failed to process payment' });
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

      const member = await prisma.member.findFirst({
        where: { userId, associationId },
      });

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
};
