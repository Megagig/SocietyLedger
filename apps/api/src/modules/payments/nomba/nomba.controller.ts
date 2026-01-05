/**
 * Nomba Payment Controller
 * 
 * Handles HTTP requests for Nomba payment operations
 */

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../../lib/prisma';
import { nombaService } from './nomba.service';
import {
  NombaInitializePaymentRequest,
  NombaInitializePaymentResponse,
  NombaVerifyPaymentResponse,
} from './nomba.types';

export class NombaController {
  /**
   * Initialize a payment
   * POST /api/payments/nomba/initialize
   */
  async initializePayment(req: Request, res: Response): Promise<void> {
    try {
      const { transactionId, callbackUrl }: NombaInitializePaymentRequest = req.body;
      const associationId = (req as any).associationId;
      const userId = (req as any).userId;

      if (!transactionId) {
        res.status(400).json({
          success: false,
          message: 'Transaction ID is required',
        });
        return;
      }

      // Fetch transaction details
      const transaction = await prisma.transaction.findFirst({
        where: {
          id: transactionId,
          associationId,
        },
        include: {
          payments: true,
          member: {
            select: {
              id: true,
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
      });

      if (!transaction) {
        res.status(404).json({
          success: false,
          message: 'Transaction not found',
        });
        return;
      }

      // Calculate total paid from payments
      const totalPaid = transaction.payments.reduce(
        (sum, p) => sum.plus(p.amountPaid),
        new Decimal(0)
      );
      const balance = new Decimal(transaction.amount).minus(totalPaid);
      
      if (balance.lessThanOrEqualTo(0)) {
        res.status(400).json({
          success: false,
          message: 'Transaction is already fully paid',
        });
        return;
      }

      // Generate unique payment reference
      const reference = `NMB-${Date.now()}-${transaction.id}`;

      // Initialize payment with Nomba
      const nombaResponse = await nombaService.initializePayment({
        amount: nombaService.convertToKobo(balance.toNumber()),
        email: transaction.member.email || 'noemail@societyledger.com',
        reference,
        callbackUrl: callbackUrl || `${process.env.FRONTEND_URL}/dashboard/finance/payments/verify`,
        metadata: {
          transactionId: transaction.id,
          associationId,
          memberId: transaction.member.id,
          memberName: `${transaction.member.firstName} ${transaction.member.lastName}`,
          categoryName: transaction.category.name,
          categoryType: transaction.category.type,
        },
      });

      // Create payment gateway transaction record
      await prisma.paymentGatewayTransaction.create({
        data: {
          associationId,
          transactionId: transaction.id,
          provider: 'nomba',
          reference,
          amount: new Prisma.Decimal(balance),
          status: 'pending',
          metadata: {
            orderReference: nombaResponse.data.orderReference,
            checkoutLink: nombaResponse.data.checkoutLink,
            customerEmail: transaction.member.email,
          },
          nombaResponse: nombaResponse as any,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'PAYMENT_INITIALIZED',
          tableName: 'PaymentGatewayTransaction',
          recordId: transaction.id,
          newValues: {
            provider: 'nomba',
            reference,
            amount: balance,
          },
        },
      });

      const response: NombaInitializePaymentResponse = {
        success: true,
        message: 'Payment initialized successfully',
        data: {
          reference,
          checkoutLink: nombaResponse.data.checkoutLink,
          orderReference: nombaResponse.data.orderReference,
          amount: balance.toNumber(),
        },
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Nomba payment initialization error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize payment',
      });
    }
  }

  /**
   * Verify a payment
   * GET /api/payments/nomba/verify/:reference
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const { reference } = req.params;
      const associationId = (req as any).associationId;
      const userId = (req as any).userId;

      if (!reference) {
        res.status(400).json({
          success: false,
          message: 'Payment reference is required',
        });
        return;
      }

      // Find payment gateway transaction
      const gatewayTxn = await prisma.paymentGatewayTransaction.findFirst({
        where: {
          reference,
          associationId,
          provider: 'nomba',
        },
        include: {
          transaction: {
            include: {
              member: true,
              category: true,
            },
          },
        },
      });

      if (!gatewayTxn) {
        res.status(404).json({
          success: false,
          message: 'Payment record not found',
        });
        return;
      }

      // If already processed, return existing status
      if (gatewayTxn.webhookReceived && gatewayTxn.status === 'success') {
        const response: NombaVerifyPaymentResponse = {
          success: true,
          message: 'Payment already verified',
          data: {
            status: 'success',
            reference: gatewayTxn.reference,
            amount: gatewayTxn.amount.toNumber(),
            transactionId: gatewayTxn.transactionId || undefined,
            transactionStatus: gatewayTxn.transaction?.status,
          },
        };

        res.status(200).json(response);
        return;
      }

      // Verify payment with Nomba
      const nombaResponse = await nombaService.verifyPayment(reference);

      if (nombaResponse.data.status === 'success') {
        // Process successful payment
        await this.processSuccessfulPayment(
          gatewayTxn,
          nombaResponse.data.amount,
          userId,
          associationId
        );

        const response: NombaVerifyPaymentResponse = {
          success: true,
          message: 'Payment verified and recorded successfully',
          data: {
            status: 'success',
            reference: gatewayTxn.reference,
            amount: nombaResponse.data.amount,
            transactionId: gatewayTxn.transactionId || undefined,
            transactionStatus: 'paid',
            paidAt: nombaResponse.data.transactionTime,
          },
        };

        res.status(200).json(response);
      } else if (nombaResponse.data.status === 'failed') {
        // Update gateway transaction status
        await prisma.paymentGatewayTransaction.update({
          where: { id: gatewayTxn.id },
          data: {
            status: 'failed',
            nombaResponse: nombaResponse as any,
          },
        });

        const response: NombaVerifyPaymentResponse = {
          success: false,
          message: 'Payment verification failed',
          data: {
            status: 'failed',
            reference: gatewayTxn.reference,
            amount: nombaResponse.data.amount,
            gatewayResponse: 'Payment failed',
          },
        };

        res.status(400).json(response);
      } else {
        // Payment still pending
        const response: NombaVerifyPaymentResponse = {
          success: false,
          message: 'Payment is still pending',
          data: {
            status: 'pending',
            reference: gatewayTxn.reference,
            amount: nombaResponse.data.amount,
          },
        };

        res.status(200).json(response);
      }
    } catch (error: any) {
      console.error('Nomba payment verification error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to verify payment',
      });
    }
  }

  /**
   * Get payment status
   * GET /api/payments/nomba/status/:reference
   */
  async getPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { reference } = req.params;
      const associationId = (req as any).associationId;

      const gatewayTxn = await prisma.paymentGatewayTransaction.findFirst({
        where: {
          reference,
          associationId,
          provider: 'nomba',
        },
        include: {
          transaction: {
            include: {
              member: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!gatewayTxn) {
        res.status(404).json({
          success: false,
          message: 'Payment record not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          reference: gatewayTxn.reference,
          status: gatewayTxn.status,
          amount: gatewayTxn.amount.toNumber(),
          provider: gatewayTxn.provider,
          webhookReceived: gatewayTxn.webhookReceived,
          transaction: gatewayTxn.transaction ? {
            id: gatewayTxn.transaction.id,
            referenceNumber: gatewayTxn.transaction.referenceNumber,
            amount: gatewayTxn.transaction.amount.toNumber(),
            status: gatewayTxn.transaction.status,
            member: gatewayTxn.transaction.member,
            category: gatewayTxn.transaction.category,
          } : null,
          createdAt: gatewayTxn.createdAt,
        },
      });
    } catch (error: any) {
      console.error('Get payment status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment status',
      });
    }
  }

  /**
   * Process successful payment (shared logic)
   */
  private async processSuccessfulPayment(
    gatewayTxn: any,
    amount: number,
    userId: number,
    associationId: number
  ): Promise<void> {
    const amountInNaira = nombaService.convertToNaira(amount);

    await prisma.$transaction(async (tx) => {
      // Update gateway transaction
      await tx.paymentGatewayTransaction.update({
        where: { id: gatewayTxn.id },
        data: {
          status: 'success',
          webhookReceived: true,
        },
      });

      // Generate receipt number
      const receiptCount = await tx.payment.count({
        where: { associationId },
      });
      const timestamp = Date.now().toString().slice(-6);
      const receiptNumber = `RCP${String(receiptCount + 1).padStart(6, '0')}-${timestamp}`;

      // Create payment record
      await tx.payment.create({
        data: {
          associationId,
          transactionId: gatewayTxn.transactionId!,
          amountPaid: new Prisma.Decimal(amountInNaira),
          paymentDate: new Date(),
          paymentMethod: 'nomba',
          receiptNumber,
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });

      // Update transaction status
      const transaction = await tx.transaction.findUnique({
        where: { id: gatewayTxn.transactionId! },
        include: { payments: true },
      });

      if (transaction) {
        // Calculate new total paid from all payments
        const newTotalPaid = transaction.payments.reduce(
          (sum, p) => sum.plus(p.amountPaid),
          new Decimal(0)
        ).plus(amountInNaira);
        
        const newBalance = new Decimal(transaction.amount).minus(newTotalPaid);
        const newStatus = newBalance.lessThanOrEqualTo(0) ? 'paid' : 'partial';

        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: newStatus,
            paymentDate: newStatus === 'paid' ? new Date() : transaction.paymentDate,
          },
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          associationId,
          userId,
          action: 'PAYMENT_RECORDED',
          tableName: 'Payment',
          recordId: gatewayTxn.transactionId!,
          newValues: {
            provider: 'nomba',
            reference: gatewayTxn.reference,
            amount: amountInNaira,
            receiptNumber,
          },
        },
      });
    });
  }
}

export const nombaController = new NombaController();
