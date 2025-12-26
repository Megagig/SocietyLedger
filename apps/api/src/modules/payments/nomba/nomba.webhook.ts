/**
 * Nomba Webhook Handler
 * 
 * Processes webhook events from Nomba payment gateway
 * Documentation: https://developer.nomba.com/docs/api-basics/webhook
 */

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../../lib/prisma';
import { nombaService } from './nomba.service';
import { NombaWebhookPayload } from './nomba.types';

export class NombaWebhookHandler {
  /**
   * Handle Nomba webhook events
   * POST /api/payments/webhook/nomba
   * 
   * CRITICAL: This endpoint is publicly accessible (no auth middleware)
   * Security: Webhook signature verification is MANDATORY
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Get signature from header (Nomba uses 'nomba-signature' header)
      const signature = req.headers['nomba-signature'] as string;
      
      if (!signature) {
        console.error('Nomba webhook: Missing signature');
        res.status(400).json({ message: 'Missing signature' });
        return;
      }

      // Parse webhook payload
      const payload: NombaWebhookPayload = req.body;

      // Verify webhook signature using Nomba's specific format
      const isValid = nombaService.verifyWebhookSignature(payload, signature);
      
      if (!isValid) {
        console.error('Nomba webhook: Invalid signature');
        res.status(401).json({ message: 'Invalid signature' });
        return;
      }

      console.log('Nomba webhook received:', {
        event: payload.event_type,
        reference: payload.data.order.orderReference,
        amount: payload.data.order.amount,
      });

      // Handle different event types
      switch (payload.event_type) {
        case 'payment_success':
          await this.handlePaymentSuccess(payload);
          break;
        
        case 'payment_failed':
          await this.handlePaymentFailed(payload);
          break;
        
        case 'payment_pending':
          await this.handlePaymentPending(payload);
          break;
        
        default:
          console.log('Nomba webhook: Unhandled event type:', payload.event_type);
      }

      // Always return 200 OK to acknowledge receipt
      res.status(200).json({ message: 'Webhook received' });
    } catch (error: any) {
      console.error('Nomba webhook processing error:', error);
      // Still return 200 to prevent Nomba from retrying
      res.status(200).json({ message: 'Webhook received with errors' });
    }
  }

  /**
   * Handle successful payment event
   */
  private async handlePaymentSuccess(payload: NombaWebhookPayload): Promise<void> {
    const { order, transaction } = payload.data;
    const reference = order.orderReference;

    try {
      // Find payment gateway transaction
      const gatewayTxn = await prisma.paymentGatewayTransaction.findFirst({
        where: {
          reference,
          provider: 'nomba',
        },
      });

      if (!gatewayTxn) {
        console.error('Nomba webhook: Payment record not found:', reference);
        return;
      }

      // Check if already processed (idempotency)
      if (gatewayTxn.webhookReceived && gatewayTxn.status === 'success') {
        console.log('Nomba webhook: Payment already processed:', reference);
        return;
      }

      // Convert amount from kobo to naira
      const amountInNaira = nombaService.convertToNaira(transaction.transactionAmount);

      // Process payment in atomic transaction
      await prisma.$transaction(async (tx) => {
        // Update gateway transaction
        await tx.paymentGatewayTransaction.update({
          where: { id: gatewayTxn.id },
          data: {
            status: 'success',
            webhookReceived: true,
            nombaResponse: payload as any,
          },
        });

        // Generate receipt number
        const receiptCount = await tx.payment.count({
          where: { associationId: gatewayTxn.associationId },
        });
        const receiptNumber = `RCP${String(receiptCount + 1).padStart(6, '0')}`;

        // Fetch transaction to get createdBy
        const txn = await tx.transaction.findUnique({
          where: { id: gatewayTxn.transactionId! },
          include: { payments: true },
        });

        if (!txn) {
          throw new Error('Transaction not found');
        }

        // Create payment record
        await tx.payment.create({
          data: {
            associationId: gatewayTxn.associationId,
            transactionId: gatewayTxn.transactionId!,
            amountPaid: new Prisma.Decimal(amountInNaira),
            paymentDate: new Date(transaction.time),
            paymentMethod: 'nomba',
            receiptNumber,
            confirmedBy: txn.createdBy || 1, // System user
            confirmedAt: new Date(),
          },
        });

        // Calculate new total paid from all payments
        const newTotalPaid = txn.payments.reduce(
          (sum, p) => sum.plus(p.amountPaid),
          new Decimal(0)
        ).plus(amountInNaira);
        
        const newBalance = new Decimal(txn.amount).minus(newTotalPaid);
        const newStatus = newBalance.lessThanOrEqualTo(0) ? 'paid' : 'partial';

        // Update transaction status
        await tx.transaction.update({
          where: { id: txn.id },
          data: {
            status: newStatus,
            paymentDate: newStatus === 'paid' ? new Date() : txn.paymentDate,
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            associationId: gatewayTxn.associationId,
            userId: txn.createdBy || 1,
            action: 'PAYMENT_WEBHOOK_PROCESSED',
            tableName: 'Payment',
            recordId: gatewayTxn.transactionId!,
            newValues: {
              provider: 'nomba',
              reference,
              amount: amountInNaira,
              receiptNumber,
              transactionId: transaction.transactionId,
            },
          },
        });
      });

      console.log('Nomba webhook: Payment processed successfully:', {
        reference,
        amount: amountInNaira,
        transactionId: transaction.transactionId,
      });
    } catch (error: any) {
      console.error('Nomba webhook: Error processing payment success:', error);
      throw error;
    }
  }

  /**
   * Handle failed payment event
   */
  private async handlePaymentFailed(payload: NombaWebhookPayload): Promise<void> {
    const { order } = payload.data;
    const reference = order.orderReference;

    try {
      const gatewayTxn = await prisma.paymentGatewayTransaction.findFirst({
        where: {
          reference,
          provider: 'nomba',
        },
      });

      if (!gatewayTxn) {
        console.error('Nomba webhook: Payment record not found:', reference);
        return;
      }

      // Update gateway transaction status
      await prisma.paymentGatewayTransaction.update({
        where: { id: gatewayTxn.id },
        data: {
          status: 'failed',
          webhookReceived: true,
          nombaResponse: payload as any,
        },
      });

      // Get transaction for audit log
      const txn = await prisma.transaction.findUnique({
        where: { id: gatewayTxn.transactionId! },
        select: { createdBy: true },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          associationId: gatewayTxn.associationId,
          userId: txn?.createdBy || 1,
          action: 'PAYMENT_WEBHOOK_FAILED',
          tableName: 'PaymentGatewayTransaction',
          recordId: gatewayTxn.id,
          newValues: {
            provider: 'nomba',
            reference,
            status: 'failed',
          },
        },
      });

      console.log('Nomba webhook: Payment failed:', reference);
    } catch (error: any) {
      console.error('Nomba webhook: Error processing payment failure:', error);
      throw error;
    }
  }

  /**
   * Handle pending payment event
   */
  private async handlePaymentPending(payload: NombaWebhookPayload): Promise<void> {
    const { order } = payload.data;
    const reference = order.orderReference;

    try {
      const gatewayTxn = await prisma.paymentGatewayTransaction.findFirst({
        where: {
          reference,
          provider: 'nomba',
        },
      });

      if (!gatewayTxn) {
        console.error('Nomba webhook: Payment record not found:', reference);
        return;
      }

      // Update gateway transaction with webhook data
      await prisma.paymentGatewayTransaction.update({
        where: { id: gatewayTxn.id },
        data: {
          webhookReceived: true,
          nombaResponse: payload as any,
        },
      });

      console.log('Nomba webhook: Payment pending:', reference);
    } catch (error: any) {
      console.error('Nomba webhook: Error processing payment pending:', error);
      throw error;
    }
  }
}

export const nombaWebhookHandler = new NombaWebhookHandler();
