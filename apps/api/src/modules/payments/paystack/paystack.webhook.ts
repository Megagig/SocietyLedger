import { Request, Response } from 'express';
import { prisma } from '../../../lib/prisma';
import { syncPaymentEffects } from '../../../services/payment-sync.service';
import { PaystackService } from './paystack.service';
import { PaystackWebhookEvent } from './paystack.types';
import { Decimal } from '@prisma/client/runtime/library';
import { accountingIntegrationService } from '../../../services/accounting-integration.service';
import { activateFromPayment } from '../../../services/billing/lifecycle.service';
import { notifyBillingEvent } from '../../../services/billing/billing-notifications.service';
import { aiCredits } from '../../ai/ai-credits.service';
import { creditVerifiedPurchase } from '../../sms/sms-engine';

/**
 * Handle Paystack webhook events
 * POST /api/payments/webhook/paystack
 * 
 * CRITICAL: This endpoint must be publicly accessible (no auth middleware)
 * Security is handled via webhook signature verification
 */
export async function handlePaystackWebhook(req: Request, res: Response) {
  try {
    // Get signature from headers
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      console.error('❌ [WEBHOOK] Missing Paystack signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // Verify webhook signature
    const paystackService = new PaystackService();
    const payload = JSON.stringify(req.body);
    const isValid = paystackService.verifyWebhookSignature(payload, signature);

    if (!isValid) {
      console.error('❌ [WEBHOOK] Invalid Paystack signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event: PaystackWebhookEvent = req.body;

    console.log(`📥 [WEBHOOK] Received event: ${event.event} | Reference: ${event.data.reference}`);

    // Handle different event types
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event);
        break;

      case 'charge.failed':
        await handleChargeFailed(event);
        break;

      case 'transfer.success':
        console.log('ℹ️  [WEBHOOK] Transfer success event (not implemented)');
        break;

      case 'transfer.failed':
        console.log('ℹ️  [WEBHOOK] Transfer failed event (not implemented)');
        break;

      default:
        console.log(`ℹ️  [WEBHOOK] Unhandled event type: ${event.event}`);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('❌ [WEBHOOK] Error processing webhook:', error);
    // Still return 200 to prevent Paystack from retrying
    return res.status(200).json({ received: true, error: error.message });
  }
}

/**
 * Handle successful charge event
 */
async function handleChargeSuccess(event: PaystackWebhookEvent) {
  const { reference, amount, metadata, paid_at, channel, authorization } = event.data;

  console.log(`✅ [WEBHOOK] Processing charge.success for reference: ${reference}`);

  // Credits bought for the AI assistant or for SMS are added the moment Paystack says the money arrived, whether or not the buyer's app is
  // still open. Each is credited once, and only when the payment covers the price.
  if (reference.startsWith('AIC-')) {
    const result = await aiCredits.creditPurchase(reference, { amountKobo: amount, currency: event.data.currency, paidAt: paid_at, raw: event.data });
    console.log(`💡 [WEBHOOK] AI credits ${reference}: ${result.credited ? 'added' : result.reason}`);
    return;
  }
  if (reference.startsWith('SMS-')) {
    const purchase = await prisma.sMSCreditsPurchase.findUnique({ where: { reference } });
    if (!purchase) {
      console.error(`❌ [WEBHOOK] SMS credits purchase not found for reference: ${reference}`);
      return;
    }
    if (new Decimal(amount).lt(new Decimal(purchase.amount).times(100)) || (event.data.currency && event.data.currency.toUpperCase() !== 'NGN')) {
      console.error(`❌ [WEBHOOK] Payment for ${reference} does not cover the SMS credits price; nothing added`);
      return;
    }
    const added = await creditVerifiedPurchase(purchase, paid_at, event.data);
    console.log(`💬 [WEBHOOK] SMS credits ${reference}: ${added ? 'added' : 'already added'}`);
    return;
  }

  // Check if this is a subscription payment (reference starts with SUB-, CHANGE- or ADDON-)
  if (reference.startsWith('SUB-') || reference.startsWith('CHANGE-') || reference.startsWith('ADDON-')) {
    await handleSubscriptionPayment(event);
    return;
  }

  // Find gateway transaction
  const gatewayTransaction = await prisma.paymentGatewayTransaction.findUnique({
    where: { reference },
    include: {
      transaction: {
        include: {
          payments: { select: { amountPaid: true } },
          member: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  if (!gatewayTransaction) {
    console.error(`❌ [WEBHOOK] Gateway transaction not found for reference: ${reference}`);
    return;
  }

  // Check if already processed (idempotency)
  if (gatewayTransaction.webhookReceived && gatewayTransaction.status === 'success') {
    console.log(`⚠️  [WEBHOOK] Payment already processed for reference: ${reference}`);
    return;
  }

  const transaction = gatewayTransaction.transaction;
  if (!transaction) {
    console.error(`❌ [WEBHOOK] Transaction not found for gateway transaction: ${gatewayTransaction.id}`);
    return;
  }

  // Convert amount from kobo to naira
  const amountPaid = PaystackService.koboToNaira(amount);

  // Calculate new transaction status
  const currentPaid = transaction.payments.reduce(
    (sum, p) => sum.plus(p.amountPaid),
    new Decimal(0)
  );
  const newPaidTotal = currentPaid.plus(amountPaid);
  const newStatus = newPaidTotal.greaterThanOrEqualTo(transaction.amount) ? 'paid' : 'partial';

  // Generate receipt number
  const paymentCount = await prisma.payment.count({
    where: { associationId: gatewayTransaction.associationId },
  });
  const timestamp = Date.now().toString().slice(-6);
  const receiptNumber = `RCP${String(paymentCount + 1).padStart(6, '0')}-${timestamp}`;

  try {
    // Atomic transaction: update gateway, create payment, update transaction
    await prisma.$transaction([
      // Update gateway transaction
      prisma.paymentGatewayTransaction.update({
        where: { id: gatewayTransaction.id },
        data: {
          status: 'success',
          webhookReceived: true,
          paystackResponse: event.data as any,
        },
      }),

      // Create payment record
      prisma.payment.create({
        data: {
          associationId: gatewayTransaction.associationId,
          transactionId: transaction.id,
          amountPaid,
          paymentDate: new Date(paid_at),
          paymentMethod: 'paystack',
          receiptNumber,
          confirmedBy: 1, // System user
          confirmedAt: new Date(),
        },
      }),

      // Update transaction status
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: newStatus,
          paymentDate: newStatus === 'paid' ? new Date() : undefined,
          paymentMethod: 'paystack',
        },
      }),

      // Audit log
      prisma.auditLog.create({
        data: {
          associationId: gatewayTransaction.associationId,
          userId: 1, // System user
          action: 'PAYMENT_WEBHOOK_SUCCESS',
          tableName: 'payments',
          newValues: {
            reference,
            amount: amountPaid,
            provider: 'paystack',
            channel,
            transactionId: transaction.id,
            receiptNumber,
            cardLast4: authorization?.last4,
            cardBrand: authorization?.brand,
          },
        },
      }),
    ]);

    console.log(`✅ [WEBHOOK] Payment recorded successfully`);
    console.log(`   Reference: ${reference}`);
    console.log(`   Amount: ₦${amountPaid.toLocaleString()}`);
    console.log(`   Receipt: ${receiptNumber}`);
    console.log(`   Transaction Status: ${newStatus}`);
    console.log(`   Member: ${transaction.member.firstName} ${transaction.member.lastName}`);

    // The member's ledger and the books, through the one shared function every payment route uses.
    await syncPaymentEffects({ receiptNumber, associationId: gatewayTransaction.associationId }, transaction.createdBy ?? 1);

    // TODO: Send payment confirmation email to member
    // TODO: Send notification to association admins

  } catch (error: any) {
    console.error(`❌ [WEBHOOK] Error recording payment:`, error);
    throw error;
  }
}

/**
 * Handle subscription payment from webhook.
 *
 * The webhook, the verify endpoint and the return page can all report the same payment. They all go through activateFromPayment, which
 * applies it exactly once, only if the amount Paystack confirms matches the quote stored at checkout, and records anything else for review.
 */
async function handleSubscriptionPayment(event: PaystackWebhookEvent) {
  const { reference, amount, paid_at } = event.data;

  console.log(`✅ [WEBHOOK] Processing subscription payment for reference: ${reference}`);

  try {
    const result = await activateFromPayment({
      reference,
      verifiedAmountKobo: Math.round(amount),
      paidAt: paid_at ? new Date(paid_at) : undefined,
      gatewayPayload: event.data,
    });
    console.log(`   Outcome: ${result.outcome}${result.subscriptionId ? ` (subscription ${result.subscriptionId})` : ''}`);
    if (result.outcome === 'NOT_FOUND') console.error(`❌ [WEBHOOK] Payment history not found for reference: ${reference}`);
  } catch (error: any) {
    console.error(`❌ [WEBHOOK] Error recording subscription payment:`, error);
    throw error;
  }
}

/**
 * Handle failed charge event
 */
async function handleChargeFailed(event: PaystackWebhookEvent) {
  const { reference, gateway_response } = event.data;

  console.log(`❌ [WEBHOOK] Processing charge.failed for reference: ${reference}`);
  console.log(`   Reason: ${gateway_response}`);

  // A failed subscription or add-on payment: record it as failed (never touching one that was already applied) and tell the association.
  if (reference.startsWith('SUB-') || reference.startsWith('CHANGE-') || reference.startsWith('ADDON-')) {
    const payment = await prisma.paymentHistory.findUnique({ where: { reference }, include: { subscription: { select: { associationId: true } } } });
    if (payment && !payment.appliedAt && payment.status === 'PENDING') {
      await prisma.paymentHistory.update({ where: { id: payment.id }, data: { status: 'FAILED', metadata: event.data as any } });
      void notifyBillingEvent({ type: 'PAYMENT_FAILED', associationId: payment.subscription.associationId });
    }
    return;
  }

  // Find gateway transaction
  const gatewayTransaction = await prisma.paymentGatewayTransaction.findUnique({
    where: { reference },
  });

  if (!gatewayTransaction) {
    console.error(`❌ [WEBHOOK] Gateway transaction not found for reference: ${reference}`);
    return;
  }

  // Update status to failed
  await prisma.paymentGatewayTransaction.update({
    where: { id: gatewayTransaction.id },
    data: {
      status: 'failed',
      webhookReceived: true,
      paystackResponse: event.data,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      associationId: gatewayTransaction.associationId,
      userId: 1, // System user
      action: 'PAYMENT_WEBHOOK_FAILED',
      tableName: 'payment_gateway_transactions',
      recordId: gatewayTransaction.id,
      newValues: {
        reference,
        reason: gateway_response,
        provider: 'paystack',
      },
    },
  });

  console.log(`✅ [WEBHOOK] Failed payment recorded`);

  // TODO: Send payment failure notification to member
}

/**
 * Verify webhook IP (optional additional security)
 * Paystack webhook IPs: https://paystack.com/docs/payments/webhooks/#ip-whitelisting
 */
export function isPaystackIP(ip: string): boolean {
  const paystackIPs = [
    '52.31.139.75',
    '52.49.173.169',
    '52.214.14.220',
  ];

  return paystackIPs.includes(ip);
}
