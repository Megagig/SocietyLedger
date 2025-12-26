import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { calculateSubscriptionAmount } from '../../lib/paystack';
import { BillingCycle } from '@prisma/client';
import { PaystackService } from '../payments/paystack/paystack.service';
import { nombaService } from '../payments/nomba/nomba.service';

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
      const { planId, billingCycle, provider = 'paystack' } = req.body;
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

      // Validate provider
      if (!['paystack', 'nomba'].includes(provider)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment provider. Use "paystack" or "nomba"',
        });
      }

      // Check if Nomba is configured when selected
      if (provider === 'nomba' && !nombaService.isConfigured()) {
        return res.status(400).json({
          success: false,
          message: 'Nomba payment provider is not configured. Please use Paystack or contact support.',
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

      // Initialize payment based on provider
      if (provider === 'paystack') {
        return await subscriptionController.initializePaystackPayment(
          req, res, subscription, association, userEmail, amount, plan.id, billingCycle
        );
      } else {
        return await subscriptionController.initializeNombaPayment(
          req, res, subscription, association, userEmail, amount, plan.id, billingCycle
        );
      }
    } catch (error) {
      console.error('Error initializing payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize payment',
      });
    }
  },

  // Initialize Paystack payment
  async initializePaystackPayment(
    req: Request,
    res: Response,
    subscription: any,
    association: any,
    userEmail: string | undefined,
    amount: number,
    planId: number,
    billingCycle: string
  ) {
    const reference = PaystackService.generateReference('SUB');
    const paystackService = new PaystackService();
    
    const paystackResponse = await paystackService.initializePayment({
      email: userEmail || association.name,
      amount: PaystackService.nairaToKobo(amount),
      reference,
      callback_url: `${process.env.FRONTEND_URL}/subscription/verify`,
      metadata: {
        subscriptionId: subscription.id,
        associationId: association.id,
        planId,
        billingCycle,
        associationName: association.name,
        subdomain: association.subdomain,
        provider: 'paystack',
      },
    });

    if (!paystackResponse.status) {
      return res.status(400).json({
        success: false,
        message: 'Failed to initialize Paystack payment',
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
      message: 'Payment initialized successfully',
      data: {
        provider: 'paystack',
        authorizationUrl: paystackResponse.data.authorization_url,
        accessCode: paystackResponse.data.access_code,
        reference: paystackResponse.data.reference,
      },
    });
  },

  // Initialize Nomba payment
  async initializeNombaPayment(
    req: Request,
    res: Response,
    subscription: any,
    association: any,
    userEmail: string | undefined,
    amount: number,
    planId: number,
    billingCycle: string
  ) {
    const reference = `NMB-SUB-${Date.now()}-${subscription.id}`;
    
    const nombaResponse = await nombaService.initializePayment({
      amount: nombaService.convertToKobo(amount),
      email: userEmail || 'noemail@societyledger.com',
      reference,
      callbackUrl: `${process.env.FRONTEND_URL}/subscription/verify`,
      metadata: {
        subscriptionId: subscription.id,
        associationId: association.id,
        planId,
        billingCycle,
        associationName: association.name,
        subdomain: association.subdomain,
        provider: 'nomba',
      },
    });

    // Create payment history record
    await prisma.paymentHistory.create({
      data: {
        subscriptionId: subscription.id,
        amount,
        currency: 'NGN',
        status: 'PENDING',
        provider: 'nomba',
        reference,
        accessCode: nombaResponse.data.orderReference,
        authorizationUrl: nombaResponse.data.checkoutLink,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        provider: 'nomba',
        checkoutLink: nombaResponse.data.checkoutLink,
        orderReference: nombaResponse.data.orderReference,
        reference,
      },
    });
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

      // Determine provider from reference prefix
      const isNomba = reference.startsWith('NMB-');
      
      if (isNomba) {
        return await subscriptionController.verifyNombaPayment(req, res, reference);
      } else {
        return await subscriptionController.verifyPaystackPayment(req, res, reference);
      }
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify payment',
        error: error.message,
      });
    }
  },

  // Verify Paystack payment
  async verifyPaystackPayment(req: Request, res: Response, reference: string) {
    const paystackService = new PaystackService();
    const verification = await paystackService.verifyPayment(reference);

    if (!verification.status || verification.data.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: {
          status: verification.data?.status,
          gateway_response: verification.data?.gateway_response,
        },
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

    // Check if already processed (idempotency)
    if (paymentHistory.status === 'SUCCESS') {
      const association = await prisma.association.findUnique({
        where: { id: paymentHistory.subscription.associationId },
        select: { subdomain: true, name: true },
      });

      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: {
          subscription: paymentHistory.subscription,
          payment: verification.data,
          subdomain: association?.subdomain,
          associationName: association?.name,
        },
      });
    }

    // Calculate new period dates
    const subscription = paymentHistory.subscription;
    const periodMonths = subscription.billingCycle === 'MONTHLY' ? 1 : 12;
    const currentDate = new Date();
    const periodEnd = new Date(currentDate);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    // Atomic transaction: update payment history, subscription, and association
    await prisma.$transaction([
      prisma.paymentHistory.update({
        where: { id: paymentHistory.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(verification.data.paid_at),
          metadata: verification.data as any,
        },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: currentDate,
          currentPeriodEnd: periodEnd,
          renewalDate: periodEnd,
        },
      }),
      prisma.association.update({
        where: { id: subscription.associationId },
        data: {
          subscriptionExpiresAt: periodEnd,
          status: 'ACTIVE',
        },
      }),
      prisma.auditLog.create({
        data: {
          associationId: subscription.associationId,
          userId: 1,
          action: 'SUBSCRIPTION_PAYMENT_VERIFIED',
          tableName: 'subscriptions',
          recordId: subscription.id,
          newValues: {
            reference,
            amount: PaystackService.koboToNaira(verification.data.amount),
            provider: 'paystack',
            subscriptionId: subscription.id,
            planId: subscription.planId,
            billingCycle: subscription.billingCycle,
            periodEnd: periodEnd.toISOString(),
          },
        },
      }),
    ]);

    console.log(`✅ [VERIFY] Paystack subscription payment verified successfully`);

    const association = await prisma.association.findUnique({
      where: { id: subscription.associationId },
      select: { subdomain: true, name: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        subscription,
        payment: verification.data,
        subdomain: association?.subdomain,
        associationName: association?.name,
      },
    });
  },

  // Verify Nomba payment
  async verifyNombaPayment(req: Request, res: Response, reference: string) {
    const nombaVerification = await nombaService.verifyPayment(reference);

    if (nombaVerification.data.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: {
          status: nombaVerification.data.status,
        },
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

    // Check if already processed (idempotency)
    if (paymentHistory.status === 'SUCCESS') {
      const association = await prisma.association.findUnique({
        where: { id: paymentHistory.subscription.associationId },
        select: { subdomain: true, name: true },
      });

      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: {
          subscription: paymentHistory.subscription,
          subdomain: association?.subdomain,
          associationName: association?.name,
        },
      });
    }

    // Calculate new period dates
    const subscription = paymentHistory.subscription;
    const periodMonths = subscription.billingCycle === 'MONTHLY' ? 1 : 12;
    const currentDate = new Date();
    const periodEnd = new Date(currentDate);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    const amountInNaira = nombaService.convertToNaira(nombaVerification.data.amount);

    // Atomic transaction
    await prisma.$transaction([
      prisma.paymentHistory.update({
        where: { id: paymentHistory.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          metadata: nombaVerification.data as any,
        },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: currentDate,
          currentPeriodEnd: periodEnd,
          renewalDate: periodEnd,
        },
      }),
      prisma.association.update({
        where: { id: subscription.associationId },
        data: {
          subscriptionExpiresAt: periodEnd,
          status: 'ACTIVE',
        },
      }),
      prisma.auditLog.create({
        data: {
          associationId: subscription.associationId,
          userId: 1,
          action: 'SUBSCRIPTION_PAYMENT_VERIFIED',
          tableName: 'subscriptions',
          recordId: subscription.id,
          newValues: {
            reference,
            amount: amountInNaira,
            provider: 'nomba',
            subscriptionId: subscription.id,
            planId: subscription.planId,
            billingCycle: subscription.billingCycle,
            periodEnd: periodEnd.toISOString(),
          },
        },
      }),
    ]);

    console.log(`✅ [VERIFY] Nomba subscription payment verified successfully`);

    const association = await prisma.association.findUnique({
      where: { id: subscription.associationId },
      select: { subdomain: true, name: true },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        subscription,
        subdomain: association?.subdomain,
        associationName: association?.name,
      },
    });
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

  // Change plan (upgrade/downgrade) with proration
  async changePlan(req: Request, res: Response) {
    try {
      const associationId = req.user?.associationId;
      const { newPlanId, billingCycle } = req.body;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required',
        });
      }

      if (!newPlanId) {
        return res.status(400).json({
          success: false,
          message: 'New plan ID is required',
        });
      }

      // Get current subscription
      const currentSubscription = await prisma.subscription.findFirst({
        where: { 
          associationId,
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        include: { plan: true },
      });

      if (!currentSubscription) {
        return res.status(404).json({
          success: false,
          message: 'No active subscription found',
        });
      }

      // Get new plan
      const newPlan = await prisma.plan.findUnique({
        where: { id: newPlanId },
      });

      if (!newPlan || !newPlan.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Plan not found or inactive',
        });
      }

      // Check if it's the same plan
      if (currentSubscription.planId === newPlanId && currentSubscription.billingCycle === (billingCycle || currentSubscription.billingCycle)) {
        return res.status(400).json({
          success: false,
          message: 'You are already on this plan',
        });
      }

      // Calculate proration
      const now = new Date();
      const currentPeriodEnd = currentSubscription.currentPeriodEnd;
      const daysRemaining = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const totalDays = currentSubscription.billingCycle === 'ANNUAL' ? 365 : 30;
      const usedDays = totalDays - daysRemaining;

      // Calculate current plan cost
      const currentPlanPrice = currentSubscription.billingCycle === 'ANNUAL'
        ? currentSubscription.plan.priceAnnual.toNumber()
        : currentSubscription.plan.priceMonthly.toNumber();

      // Calculate new plan cost
      const newBillingCycle = billingCycle || currentSubscription.billingCycle;
      const newPlanPrice = newBillingCycle === 'ANNUAL'
        ? newPlan.priceAnnual.toNumber()
        : newPlan.priceMonthly.toNumber();

      // Calculate prorated amounts
      const usedAmount = (currentPlanPrice / totalDays) * usedDays;
      const remainingCredit = currentPlanPrice - usedAmount;
      const proratedAmount = Math.max(0, newPlanPrice - remainingCredit);

      // Determine if upgrade or downgrade
      const isUpgrade = newPlanPrice > currentPlanPrice;
      const changeType = isUpgrade ? 'upgrade' : 'downgrade';

      // For upgrades, charge immediately; for downgrades, apply at period end
      if (isUpgrade && proratedAmount > 0) {
        // Initialize payment for prorated amount
        const reference = PaystackService.generateReference('CHANGE');
        
        try {
          const paystackService = new PaystackService();
          const response = await paystackService.initializePayment({
            email: req.user?.email || '',
            amount: PaystackService.nairaToKobo(proratedAmount),
            reference,
            metadata: {
              type: 'plan_change',
              subscriptionId: currentSubscription.id,
              newPlanId,
              billingCycle: newBillingCycle,
              proratedAmount,
              remainingCredit,
              changeType,
            },
          });

          // Create payment history record
          await prisma.paymentHistory.create({
            data: {
              subscriptionId: currentSubscription.id,
              amount: proratedAmount,
              reference,
              status: 'PENDING',
              provider: 'paystack',
              accessCode: response.data.access_code,
              authorizationUrl: response.data.authorization_url,
            },
          });

          return res.status(200).json({
            success: true,
            message: 'Payment required for plan upgrade',
            data: {
              changeType: 'upgrade',
              requiresPayment: true,
              proratedAmount,
              remainingCredit,
              daysRemaining,
              authorizationUrl: response.data.authorization_url,
              reference,
            },
          });
        } catch (paystackError: any) {
          console.error('Paystack error:', paystackError);
          return res.status(500).json({
            success: false,
            message: paystackError.message || 'Failed to initialize payment',
          });
        }
      } else {
        // Downgrade - apply at period end (no immediate payment)
        await prisma.subscription.update({
          where: { id: currentSubscription.id },
          data: {
            planId: newPlanId,
            billingCycle: newBillingCycle,
            // Will take effect at current period end
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: req.user?.id!,
            associationId,
            action: 'CHANGE_PLAN',
            tableName: 'subscriptions',
            recordId: currentSubscription.id,
            newValues: {
              oldPlanId: currentSubscription.planId,
              newPlanId,
              oldBillingCycle: currentSubscription.billingCycle,
              newBillingCycle,
              changeType,
              effectiveDate: currentPeriodEnd,
            },
          },
        });

        return res.status(200).json({
          success: true,
          message: `Plan ${changeType} scheduled for ${currentPeriodEnd.toLocaleDateString()}`,
          data: {
            changeType,
            requiresPayment: false,
            effectiveDate: currentPeriodEnd,
            daysRemaining,
            newPlan,
          },
        });
      }
    } catch (error) {
      console.error('Error changing plan:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to change plan',
      });
    }
  },
};
