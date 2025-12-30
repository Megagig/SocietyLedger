import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { BillingOverrideService } from '../services/billing-override.service';

/**
 * Middleware to check if association has an active subscription
 * Should be applied to routes that require a paid subscription
 * 
 * Phase 19 Enhancement: Now checks billing overrides before subscription status
 * Resolution order: BillingOverride → Subscription → Default behavior
 */
export async function subscriptionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const associationId = req.user?.associationId;

    if (!associationId) {
      return res.status(403).json({
        success: false,
        message: 'Association context required',
      });
    }

    // Phase 19: Check billing overrides first
    const billingStatus = await BillingOverrideService.getBillingStatus(associationId);
    
    // If billing is bypassed, paid externally, or has grace period, allow access
    if (billingStatus.isBillingBypassed || billingStatus.isPaidExternally || billingStatus.hasGracePeriod) {
      // Get association and plan info for request context
      const association = await prisma.association.findUnique({
        where: { id: associationId },
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (association?.subscriptions[0]) {
        req.subscription = association.subscriptions[0];
        req.plan = association.subscriptions[0].plan;
      }

      // Add billing override info to request
      (req as any).billingOverride = {
        bypassed: billingStatus.isBillingBypassed,
        paidExternally: billingStatus.isPaidExternally,
        hasGracePeriod: billingStatus.hasGracePeriod,
        creditBalance: billingStatus.creditBalance,
      };

      return next();
    }

    // If billing is paused, still allow access but log it
    if (billingStatus.isBillingPaused) {
      console.log(`[Subscription] Billing paused for association ${associationId}, allowing access`);
    }

    // Get association with subscription details
    const association = await prisma.association.findUnique({
      where: { id: associationId },
      include: {
        subscriptions: {
          where: {
            status: { in: ['ACTIVE', 'TRIALING'] },
          },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!association) {
      return res.status(404).json({
        success: false,
        message: 'Association not found',
      });
    }

    // Check if subscription exists and is active
    const subscription = association.subscriptions[0];

    if (!subscription) {
      return res.status(403).json({
        success: false,
        message: 'No active subscription. Please subscribe to a plan.',
        requiresSubscription: true,
      });
    }

    // Check if subscription has expired
    const now = new Date();
    
    // Phase 19: Check if trial was extended
    if (billingStatus.isTrialExtended && subscription.status === 'TRIALING') {
      // Trial extended, allow access
      req.subscription = subscription;
      req.plan = subscription.plan;
      (req as any).billingOverride = { trialExtended: true };
      return next();
    }

    if (subscription.currentPeriodEnd < now && subscription.status !== 'TRIALING') {
      // Update subscription status to expired
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' },
      });

      return res.status(403).json({
        success: false,
        message: 'Subscription has expired. Please renew your subscription.',
        requiresRenewal: true,
      });
    }

    // Check if trial has ended
    if (subscription.status === 'TRIALING' && subscription.trialEndsAt) {
      if (subscription.trialEndsAt < now) {
        return res.status(403).json({
          success: false,
          message: 'Trial period has ended. Please subscribe to continue.',
          trialEnded: true,
        });
      }
    }

    // Attach subscription info to request
    req.subscription = subscription;
    req.plan = subscription.plan;

    next();
  } catch (error) {
    console.error('Subscription middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
    });
  }
}

/**
 * Middleware to check if association has access to a specific feature
 * based on their subscription plan
 */
export function featureAccessMiddleware(requiredFeature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = req.plan;

      if (!plan) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription plan found',
        });
      }

      // Check if plan has the required feature
      const features = plan.features as any;

      if (!features || !features[requiredFeature]) {
        return res.status(403).json({
          success: false,
          message: `Your current plan does not include access to ${requiredFeature}. Please upgrade.`,
          requiresUpgrade: true,
          currentPlan: plan.name,
        });
      }

      next();
    } catch (error) {
      console.error('Feature access middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking feature access',
      });
    }
  };
}

/**
 * Middleware to check if association has reached member limit
 */
export async function memberLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const associationId = req.user?.associationId;
    const plan = req.plan;

    if (!plan || !plan.memberLimit) {
      // No limit, proceed
      return next();
    }

    if (!associationId) {
      return res.status(400).json({
        success: false,
        message: 'Association ID is required',
      });
    }

    // Count current members
    const memberCount = await prisma.member.count({
      where: {
        associationId: associationId,
        status: 'active',
      },
    });

    if (memberCount >= plan.memberLimit) {
      return res.status(403).json({
        success: false,
        message: `Member limit reached (${plan.memberLimit}). Please upgrade your plan.`,
        requiresUpgrade: true,
        currentCount: memberCount,
        limit: plan.memberLimit,
      });
    }

    next();
  } catch (error) {
    console.error('Member limit middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking member limit',
    });
  }
}
