import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { verifyPaystackSignature } from '../../lib/paystack';

const router = Router();

// Paystack webhook endpoint
router.post('/paystack', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing signature',
      });
    }

    // Verify webhook signature
    const payload = JSON.stringify(req.body);
    const isValid = verifyPaystackSignature(payload, signature);

    if (!isValid) {
      console.error('Invalid Paystack webhook signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid signature',
      });
    }

    const event = req.body;

    console.log('Paystack webhook event:', event.event);

    // Handle different webhook events
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event.data);
        break;

      case 'subscription.create':
        await handleSubscriptionCreate(event.data);
        break;

      case 'subscription.not_renew':
        await handleSubscriptionNotRenew(event.data);
        break;

      case 'subscription.disable':
        await handleSubscriptionDisable(event.data);
        break;

      case 'subscription.expiring_cards':
        await handleExpiringCards(event.data);
        break;

      default:
        console.log('Unhandled webhook event:', event.event);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent Paystack from retrying
    return res.status(200).json({ received: true });
  }
});

// Handle successful charge
async function handleChargeSuccess(data: any) {
  try {
    const reference = data.reference;

    // Find payment history record
    const paymentHistory = await prisma.paymentHistory.findUnique({
      where: { reference },
      include: { subscription: true },
    });

    if (!paymentHistory) {
      console.error('Payment history not found for reference:', reference);
      return;
    }

    // Skip if already processed
    if (paymentHistory.status === 'SUCCESS') {
      console.log('Payment already processed:', reference);
      return;
    }

    // Update payment history
    await prisma.paymentHistory.update({
      where: { id: paymentHistory.id },
      data: {
        status: 'SUCCESS',
        paidAt: new Date(data.paid_at),
        metadata: data,
      },
    });

    // Update subscription
    const subscription = paymentHistory.subscription;
    const periodMonths = subscription.billingCycle === 'MONTHLY' ? 1 : 12;
    const currentDate = new Date();
    const periodEnd = new Date(currentDate);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: currentDate,
        currentPeriodEnd: periodEnd,
        renewalDate: periodEnd,
      },
    });

    // Update association
    await prisma.association.update({
      where: { id: subscription.associationId },
      data: {
        subscriptionExpiresAt: periodEnd,
        status: 'ACTIVE',
      },
    });

    console.log('Subscription activated for association:', subscription.associationId);
  } catch (error) {
    console.error('Error handling charge success:', error);
  }
}

// Handle subscription creation
async function handleSubscriptionCreate(data: any) {
  console.log('Subscription created:', data);
  // Additional logic if needed
}

// Handle subscription not renewing
async function handleSubscriptionNotRenew(data: any) {
  try {
    const subscriptionCode = data.subscription_code;

    // Find subscription by metadata or reference
    const paymentHistory = await prisma.paymentHistory.findFirst({
      where: {
        metadata: {
          path: ['subscription_code'],
          equals: subscriptionCode,
        },
      },
      include: { subscription: true },
    });

    if (!paymentHistory) {
      console.error('Subscription not found for code:', subscriptionCode);
      return;
    }

    // Update subscription status
    await prisma.subscription.update({
      where: { id: paymentHistory.subscription.id },
      data: {
        status: 'CANCELLED',
        cancelAtPeriodEnd: true,
      },
    });

    console.log('Subscription marked as not renewing:', paymentHistory.subscription.id);
  } catch (error) {
    console.error('Error handling subscription not renew:', error);
  }
}

// Handle subscription disable
async function handleSubscriptionDisable(data: any) {
  try {
    const subscriptionCode = data.subscription_code;

    const paymentHistory = await prisma.paymentHistory.findFirst({
      where: {
        metadata: {
          path: ['subscription_code'],
          equals: subscriptionCode,
        },
      },
      include: { subscription: true },
    });

    if (!paymentHistory) {
      console.error('Subscription not found for code:', subscriptionCode);
      return;
    }

    // Update subscription and association status
    await prisma.subscription.update({
      where: { id: paymentHistory.subscription.id },
      data: {
        status: 'CANCELLED',
      },
    });

    await prisma.association.update({
      where: { id: paymentHistory.subscription.associationId },
      data: {
        status: 'SUSPENDED',
      },
    });

    console.log('Subscription disabled:', paymentHistory.subscription.id);
  } catch (error) {
    console.error('Error handling subscription disable:', error);
  }
}

// Handle expiring cards notification
async function handleExpiringCards(data: any) {
  console.log('Card expiring soon:', data);
  // Send notification to association admin
  // You can implement email notification here
}

export default router;
