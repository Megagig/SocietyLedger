import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { paystack, toKobo, fromKobo, calculateSubscriptionAmount } from '../../lib/paystack';
import { BillingCycle } from '@prisma/client';

export const subscriptionController = {
  // Get all available plans
  async getPlans(req: Request, res: Response) {
    try {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { priceMonthly: 'asc' },
      });

      return res.status(200).json({
        success: true,
        data: plans,
      });
    } catch (error) {
      console.error('Error fetching plans:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch plans',
      });
    }
  },

  // Get current association's subscription
  async getCurrentSubscription(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const subscription = await prisma.subscription.findFirst({
        where: { 
          associationId,
          status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
        },
        include: {
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found',
        });
      }

      return res.status(200).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription',
      });
    }
  },

  // Initialize subscription payment
  async initializePayment(req: Request, res: Response) {
    try {
      const { planId, billingCycle } = req.body;
      const associationId = req.user?.associationId;
      const userEmail = req.user?.email;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      if (!planId || !billingCycle) {
        return res.status(400).json({
          success: false,
          message: 'Plan ID and billing cycle are required',
        });
      }

      // Get the plan
      const plan = await prisma.plan.findUnique({
        where: { id: parseInt(planId) },
      });

      if (!plan || !plan.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Plan not found or inactive',
        });
      }

      // Calculate amount based on billing cycle
      const amount = calculateSubscriptionAmount(
        parseFloat(plan.priceMonthly.toString()),
        parseFloat(plan.priceAnnual.toString()),
        billingCycle as BillingCycle
      );

      // Get association details
      const association = await prisma.association.findUnique({
        where: { id: associationId },
      });

      if (!association) {
        return res.status(404).json({
          success: false,
          message: 'Association not found',
        });
      }

      // Check if subscription already exists
      let subscription = await prisma.subscription.findFirst({
        where: { 
          associationId,
          status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] }
        },
      });

      // Create or update subscription
      if (!subscription) {
        const trialDays = 14;
        const currentDate = new Date();
        const trialEnd = new Date(currentDate);
        trialEnd.setDate(trialEnd.getDate() + trialDays);

        subscription = await prisma.subscription.create({
          data: {
            associationId,
            planId: plan.id,
            status: 'TRIALING',
            billingCycle: billingCycle as BillingCycle,
            trialEndsAt: trialEnd,
            currentPeriodStart: currentDate,
            currentPeriodEnd: trialEnd,
          },
        });
      }

      // Initialize Paystack transaction
      const paystackResponse = await paystack.transaction.initialize({
        email: userEmail || association.name,
        amount: toKobo(amount),
        currency: 'NGN',
        reference: `SUB-${subscription.id}-${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/dashboard/subscription/verify`,
        metadata: {
          subscriptionId: subscription.id,
          associationId,
          planId: plan.id,
          billingCycle,
          custom_fields: [
            {
              display_name: 'Association',
              variable_name: 'association',
              value: association.name,
            },
          ],
        },
      });

      if (!paystackResponse.status) {
        return res.status(400).json({
          success: false,
          message: 'Failed to initialize payment',
        });
      }

      // Create payment history record
      await prisma.paymentHistory.create({
        data: {
          subscriptionId: subscription.id,
          amount,
          currency: 'NGN',
          status: 'PENDING',
          provider: 'paystack',
          reference: paystackResponse.data.reference,
          accessCode: paystackResponse.data.access_code,
          authorizationUrl: paystackResponse.data.authorization_url,
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          authorizationUrl: paystackResponse.data.authorization_url,
          accessCode: paystackResponse.data.access_code,
          reference: paystackResponse.data.reference,
        },
      });
    } catch (error) {
      console.error('Error initializing payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize payment',
      });
    }
  },

  // Verify payment
  async verifyPayment(req: Request, res: Response) {
    try {
      const { reference } = req.params;

      if (!reference) {
        return res.status(400).json({
          success: false,
          message: 'Payment reference is required',
        });
      }

      // Verify with Paystack
      const verification = await paystack.transaction.verify(reference);

      if (!verification.status || verification.data.status !== 'success') {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed',
        });
      }

      // Get payment history record
      const paymentHistory = await prisma.paymentHistory.findUnique({
        where: { reference },
        include: { subscription: true },
      });

      if (!paymentHistory) {
        return res.status(404).json({
          success: false,
          message: 'Payment record not found',
        });
      }

      // Update payment history
      await prisma.paymentHistory.update({
        where: { id: paymentHistory.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(verification.data.paid_at),
          metadata: verification.data,
        },
      });

      // Update subscription status
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

      // Update association subscription expiry
      await prisma.association.update({
        where: { id: subscription.associationId },
        data: {
          subscriptionExpiresAt: periodEnd,
          status: 'ACTIVE',
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          subscription,
          payment: verification.data,
        },
      });
    } catch (error) {
      console.error('Error verifying payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify payment',
      });
    }
  },

  // Cancel subscription
  async cancelSubscription(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const subscription = await prisma.subscription.findFirst({
        where: { 
          associationId,
          status: { in: ['ACTIVE', 'PAST_DUE'] }
        },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found',
        });
      }

      // Mark for cancellation at period end
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Subscription will be cancelled at the end of the billing period',
        data: subscription,
      });
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel subscription',
      });
    }
  },

  // Reactivate subscription
  async reactivateSubscription(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      const subscription = await prisma.subscription.findFirst({
        where: { 
          associationId,
          status: { in: ['ACTIVE', 'PAST_DUE'] },
          cancelAtPeriodEnd: true,
        },
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'No subscription marked for cancellation found',
        });
      }

      // Remove cancellation flag
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: false,
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Subscription reactivated successfully',
        data: subscription,
      });
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reactivate subscription',
      });
    }
  },
};
