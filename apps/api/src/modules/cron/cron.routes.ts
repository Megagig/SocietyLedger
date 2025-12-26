import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac';
import { PERMISSIONS } from '../../lib/permissions';
import { prisma } from '../../lib/prisma';
import { sendEmail } from '../../lib/email';

const router = Router();

// Apply auth middleware
router.use(authMiddleware);

/**
 * Manual trigger for trial expiry check
 * For testing and admin purposes
 */
router.post('/trial-expiry', requirePermission(PERMISSIONS.SYSTEM_SETTINGS_MANAGE), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    // Find trials expiring soon
    const expiringTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
      include: {
        association: {
          include: {
            users: {
              where: { role: 'admin' },
              take: 1,
            },
          },
        },
        plan: true,
      },
    });

    // Find expired trials
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          lt: now,
        },
      },
    });

    // Update expired trials
    if (expiredTrials.length > 0) {
      await prisma.subscription.updateMany({
        where: { id: { in: expiredTrials.map(s => s.id) } },
        data: { status: 'EXPIRED' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Trial expiry check completed',
      data: {
        expiringSoon: expiringTrials.length,
        expired: expiredTrials.length,
      },
    });
  } catch (error) {
    console.error('Error in trial expiry check:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check trial expiry',
    });
  }
});

/**
 * Manual trigger for renewal reminders
 */
router.post('/renewal-reminders', requirePermission(PERMISSIONS.SYSTEM_SETTINGS_MANAGE), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Find subscriptions expiring soon
    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        association: {
          include: {
            users: {
              where: { role: 'admin' },
              take: 1,
            },
          },
        },
        plan: true,
      },
    });

    // Find expired subscriptions
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          lt: now,
        },
      },
    });

    // Update expired subscriptions
    if (expiredSubscriptions.length > 0) {
      await prisma.subscription.updateMany({
        where: { id: { in: expiredSubscriptions.map(s => s.id) } },
        data: { status: 'EXPIRED' },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Renewal check completed',
      data: {
        expiringSoon: expiringSubscriptions.length,
        expired: expiredSubscriptions.length,
      },
    });
  } catch (error) {
    console.error('Error in renewal check:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check renewals',
    });
  }
});

/**
 * Get cron job status
 */
router.get('/status', requirePermission(PERMISSIONS.SYSTEM_SETTINGS_MANAGE), async (req: Request, res: Response) => {
  try {
    // Get subscription statistics
    const stats = await prisma.subscription.groupBy({
      by: ['status'],
      _count: true,
    });

    const statusCounts = stats.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return res.status(200).json({
      success: true,
      data: {
        jobsRunning: true,
        subscriptionStats: statusCounts,
        lastChecked: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching cron status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch status',
    });
  }
});

export default router;
