import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export class PaymentSettlementsController {
  /**
   * Get daily payment settlements summary
   * GET /api/admin/payment-settlements/daily
   */
  async getDailySettlements(req: Request, res: Response) {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      
      // Set to start of day
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      // Set to end of day
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get payments grouped by association
      const payments = await prisma.paymentGatewayTransaction.findMany({
        where: {
          status: 'success',
          webhookReceived: true,
          updatedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          association: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
          transaction: {
            select: {
              referenceNumber: true,
              member: {
                select: {
                  memberId: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              category: {
                select: {
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      console.log('[Settlements API] Found payments:', payments.length);

      // Group by association
      const settlementsByAssociation = payments.reduce((acc, payment) => {
        const assocId = payment.associationId;
        
        if (!acc[assocId]) {
          acc[assocId] = {
            associationId: assocId,
            associationName: payment.association.name,
            subdomain: payment.association.subdomain,
            totalTransactions: 0,
            totalAmount: new Decimal(0),
            amountToTransfer: new Decimal(0),
            platformFee: new Decimal(0),
            payments: [],
          };
        }

        acc[assocId].totalTransactions += 1;
        acc[assocId].totalAmount = acc[assocId].totalAmount.plus(payment.amount);
        acc[assocId].amountToTransfer = acc[assocId].amountToTransfer.plus(
          new Decimal(payment.amount).times(0.98)
        );
        acc[assocId].platformFee = acc[assocId].platformFee.plus(
          new Decimal(payment.amount).times(0.02)
        );
        acc[assocId].payments.push({
          id: payment.id,
          reference: payment.reference,
          amount: payment.amount.toNumber(),
          provider: payment.provider,
          completedAt: payment.updatedAt,
          memberName: payment.transaction?.member
            ? `${payment.transaction.member.firstName} ${payment.transaction.member.lastName}`
            : 'N/A',
          memberEmail: payment.transaction?.member?.email || null,
          transactionRef: payment.transaction?.referenceNumber || null,
          category: payment.transaction?.category?.name || null,
        });

        return acc;
      }, {} as Record<number, any>);

      // Convert to array and format decimals
      const settlements = Object.values(settlementsByAssociation).map((settlement: any) => ({
        ...settlement,
        totalAmount: settlement.totalAmount.toNumber(),
        amountToTransfer: settlement.amountToTransfer.toNumber(),
        platformFee: settlement.platformFee.toNumber(),
      }));

      // Calculate totals
      const totals = settlements.reduce(
        (acc, settlement) => ({
          totalTransactions: acc.totalTransactions + settlement.totalTransactions,
          totalAmount: acc.totalAmount + settlement.totalAmount,
          amountToTransfer: acc.amountToTransfer + settlement.amountToTransfer,
          platformFee: acc.platformFee + settlement.platformFee,
        }),
        { totalTransactions: 0, totalAmount: 0, amountToTransfer: 0, platformFee: 0 }
      );

      return res.status(200).json({
        success: true,
        data: {
          date: targetDate.toISOString().split('T')[0],
          settlements,
          totals,
        },
      });
    } catch (error) {
      console.error('Error fetching daily settlements:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch daily settlements',
      });
    }
  }

  /**
   * Get pending settlements (unsettled payments)
   * GET /api/admin/payment-settlements/pending
   */
  async getPendingSettlements(req: Request, res: Response) {
    try {
      const { days = 7 } = req.query;
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - Number(days));

      const payments = await prisma.paymentGatewayTransaction.findMany({
        where: {
          status: 'success',
          webhookReceived: true,
          updatedAt: {
            gte: daysAgo,
          },
        },
        include: {
          association: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'asc',
        },
      });

      // Group by association
      const pendingByAssociation = payments.reduce((acc, payment) => {
        const assocId = payment.associationId;
        
        if (!acc[assocId]) {
          acc[assocId] = {
            associationId: assocId,
            associationName: payment.association.name,
            subdomain: payment.association.subdomain,
            pendingCount: 0,
            totalPending: new Decimal(0),
            amountToTransfer: new Decimal(0),
            oldestPayment: payment.updatedAt,
            newestPayment: payment.updatedAt,
          };
        }

        acc[assocId].pendingCount += 1;
        acc[assocId].totalPending = acc[assocId].totalPending.plus(payment.amount);
        acc[assocId].amountToTransfer = acc[assocId].amountToTransfer.plus(
          new Decimal(payment.amount).times(0.98)
        );
        
        if (payment.updatedAt < acc[assocId].oldestPayment) {
          acc[assocId].oldestPayment = payment.updatedAt;
        }
        if (payment.updatedAt > acc[assocId].newestPayment) {
          acc[assocId].newestPayment = payment.updatedAt;
        }

        return acc;
      }, {} as Record<number, any>);

      const pending = Object.values(pendingByAssociation).map((item: any) => ({
        ...item,
        totalPending: item.totalPending.toNumber(),
        amountToTransfer: item.amountToTransfer.toNumber(),
      }));

      return res.status(200).json({
        success: true,
        data: {
          pending,
          totalAssociations: pending.length,
        },
      });
    } catch (error) {
      console.error('Error fetching pending settlements:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch pending settlements',
      });
    }
  }

  /**
   * Get monthly summary
   * GET /api/admin/payment-settlements/monthly
   */
  async getMonthlySettlements(req: Request, res: Response) {
    try {
      const { month, year } = req.query;
      const targetDate = month && year 
        ? new Date(Number(year), Number(month) - 1, 1)
        : new Date();
      
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const payments = await prisma.paymentGatewayTransaction.findMany({
        where: {
          status: 'success',
          webhookReceived: true,
          updatedAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        include: {
          association: {
            select: {
              id: true,
              name: true,
              subdomain: true,
            },
          },
        },
      });

      // Group by association
      const monthlyByAssociation = payments.reduce((acc, payment) => {
        const assocId = payment.associationId;
        
        if (!acc[assocId]) {
          acc[assocId] = {
            associationId: assocId,
            associationName: payment.association.name,
            subdomain: payment.association.subdomain,
            totalTransactions: 0,
            totalAmount: new Decimal(0),
            totalTransferred: new Decimal(0),
            totalPlatformFees: new Decimal(0),
          };
        }

        acc[assocId].totalTransactions += 1;
        acc[assocId].totalAmount = acc[assocId].totalAmount.plus(payment.amount);
        acc[assocId].totalTransferred = acc[assocId].totalTransferred.plus(
          new Decimal(payment.amount).times(0.98)
        );
        acc[assocId].totalPlatformFees = acc[assocId].totalPlatformFees.plus(
          new Decimal(payment.amount).times(0.02)
        );

        return acc;
      }, {} as Record<number, any>);

      const monthly = Object.values(monthlyByAssociation).map((item: any) => ({
        ...item,
        totalAmount: item.totalAmount.toNumber(),
        totalTransferred: item.totalTransferred.toNumber(),
        totalPlatformFees: item.totalPlatformFees.toNumber(),
      }));

      return res.status(200).json({
        success: true,
        data: {
          month: startOfMonth.toISOString().split('T')[0],
          settlements: monthly,
        },
      });
    } catch (error) {
      console.error('Error fetching monthly settlements:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch monthly settlements',
      });
    }
  }
}
