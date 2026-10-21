import { Request, Response } from 'express';
import { prisma } from '../../../lib/prisma';
import { PaystackService } from './paystack.service';
import { PaystackWebhookEvent } from './paystack.types';
import { Decimal } from '@prisma/client/runtime/library';
import { accountingIntegrationService } from '../../../services/accounting-integration.service';
import { resolvePaidPlan } from '../../../services/subscription-plan.service';

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

  // Check if this is a subscription payment (reference starts with SUB- or CHANGE-)
  if (reference.startsWith('SUB-') || reference.startsWith('CHANGE-')) {
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

    // G45: a real Paystack-confirmed payment never synced to accounting at
    // all — the only onPaymentRecorded callers were finance.controller.ts's
    // manual-record paths. Wire it here too.
    try {
      const fullPayment = await prisma.payment.findUnique({
        where: { receiptNumber },
        include: {
          transaction: {
            include: {
              member: { select: { id: true, firstName: true, lastName: true } },
              category: { select: { id: true, name: true, type: true } },
            },
          },
        },
      });
      if (fullPayment) {
        await accountingIntegrationService.onPaymentRecorded(fullPayment, 1);
      }
    } catch (syncError) {
      console.error('Accounting sync failed for Paystack webhook payment (non-critical):', syncError);
    }

    // TODO: Send payment confirmation email to member
    // TODO: Send notification to association admins

  } catch (error: any) {
    console.error(`❌ [WEBHOOK] Error recording payment:`, error);
    throw error;
  }
}

/**
 * Handle subscription payment from webhook
 */
async function handleSubscriptionPayment(event: PaystackWebhookEvent) {
  const { reference, amount, paid_at, metadata } = event.data;

  console.log(`✅ [WEBHOOK] Processing subscription payment for reference: ${reference}`);

  // Find payment history record
  const paymentHistory = await prisma.paymentHistory.findUnique({
    where: { reference },
    include: { subscription: true },
  });

  if (!paymentHistory) {
    console.error(`❌ [WEBHOOK] Payment history not found for reference: ${reference}`);
    return;
  }

  // Check if already processed (idempotency)
  if (paymentHistory.status === 'SUCCESS') {
    console.log(`⚠️  [WEBHOOK] Subscription payment already processed for reference: ${reference}`);
    return;
  }

  const subscription = paymentHistory.subscription;
  const amountPaid = PaystackService.koboToNaira(amount);

  try {
    // Which plan was actually paid for (checkout metadata), not just the one currently on the row.
    const paidPlan = await resolvePaidPlan(metadata, subscription);

    // Calculate new period dates
    const periodMonths = paidPlan.billingCycle === 'MONTHLY' ? 1 : 12;
    const currentDate = new Date();
    const periodEnd = new Date(currentDate);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    // Atomic transaction: update payment history, subscription, and association
    await prisma.$transaction([
      // Update payment history
      prisma.paymentHistory.update({
        where: { id: paymentHistory.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(paid_at),
          metadata: event.data as any,
        },
      }),

      // Update subscription status
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          planId: paidPlan.planId,
          billingCycle: paidPlan.billingCycle,
          currentPeriodStart: currentDate,
          currentPeriodEnd: periodEnd,
          renewalDate: periodEnd,
          ...(paidPlan.isPlanChange ? { pendingPlanId: null, pendingBillingCycle: null } : {}),
        },
      }),

      // Update association subscription expiry
      prisma.association.update({
        where: { id: subscription.associationId },
        data: {
          subscriptionExpiresAt: periodEnd,
          status: 'ACTIVE',
          ...(paidPlan.tier ? { tier: paidPlan.tier } : {}),
        },
      }),

      // Audit log
      prisma.auditLog.create({
        data: {
          associationId: subscription.associationId,
          userId: 1, // System user
          action: 'SUBSCRIPTION_PAYMENT_SUCCESS',
          tableName: 'subscriptions',
          recordId: subscription.id,
          newValues: {
            reference,
            amount: amountPaid,
            provider: 'paystack',
            subscriptionId: subscription.id,
            planId: paidPlan.planId,
            billingCycle: paidPlan.billingCycle,
            periodEnd: periodEnd.toISOString(),
          },
        },
      }),
    ]);

    console.log(`✅ [WEBHOOK] Subscription payment recorded successfully`);
    console.log(`   Reference: ${reference}`);
    console.log(`   Amount: ₦${amountPaid.toLocaleString()}`);
    console.log(`   Subscription ID: ${subscription.id}`);
    console.log(`   Period End: ${periodEnd.toLocaleDateString()}`);

    // TODO: Send subscription confirmation email
    // TODO: Send notification to association admins

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
