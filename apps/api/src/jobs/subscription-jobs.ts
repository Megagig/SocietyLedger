import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';

/**
 * Cron Jobs for Subscription Management
 * 
 * Handles:
 * - Trial expiry checks and notifications
 * - Subscription renewal reminders
 * - Expired subscription suspension
 */

// Check and expire trials - Runs daily at 1:00 AM
export const checkTrialExpiry = cron.schedule('0 1 * * *', async () => {
  console.log('[CRON] Running trial expiry check...');
  
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    // Find trials expiring in 3 days (for warning email)
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

    // Send warning emails for trials expiring soon
    for (const subscription of expiringTrials) {
      const daysLeft = Math.ceil(
        (subscription.trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const adminUser = subscription.association.users[0];
      if (adminUser && adminUser.email) {
        try {
          await sendEmail({
            to: adminUser.email,
            subject: `Your trial expires in ${daysLeft} days`,
            template: 'trial-expiry-warning',
            data: {
              associationName: subscription.association.name,
              daysLeft,
              planName: subscription.plan.name,
              planPrice: subscription.billingCycle === 'ANNUAL' 
                ? subscription.plan.priceAnnual.toNumber()
                : subscription.plan.priceMonthly.toNumber(),
              billingCycle: subscription.billingCycle,
              subscribeUrl: `${process.env.APP_URL}/dashboard/subscription/plans`,
            },
          });
          
          console.log(`Sent trial warning to ${adminUser.email} (${daysLeft} days left)`);
        } catch (emailError) {
          console.error(`Failed to send trial warning email to ${adminUser.email}:`, emailError);
        }
      }
    }

    // Find expired trials
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: {
          lt: now,
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
      },
    });

    // Update expired trials to EXPIRED status
    if (expiredTrials.length > 0) {
      const expiredIds = expiredTrials.map(s => s.id);
      
      await prisma.subscription.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'EXPIRED' },
      });

      console.log(`Expired ${expiredTrials.length} trial subscriptions`);

      // Send trial expired emails
      for (const subscription of expiredTrials) {
        const adminUser = subscription.association.users[0];
        if (adminUser && adminUser.email) {
          try {
            await sendEmail({
              to: adminUser.email,
              subject: 'Your trial has expired',
              template: 'trial-expired',
              data: {
                associationName: subscription.association.name,
                subscribeUrl: `${process.env.APP_URL}/dashboard/subscription/plans`,
              },
            });
            
            console.log(`Sent trial expired email to ${adminUser.email}`);
          } catch (emailError) {
            console.error(`Failed to send trial expired email to ${adminUser.email}:`, emailError);
          }
        }
      }
    }

    console.log(`[CRON] Trial expiry check complete. Warned: ${expiringTrials.length}, Expired: ${expiredTrials.length}`);
  } catch (error) {
    console.error('[CRON] Error checking trial expiry:', error);
  }
}, {
  scheduled: false, // Don't start automatically, will be started manually
});

// Check subscription renewals - Runs daily at 2:00 AM
export const checkSubscriptionRenewal = cron.schedule('0 2 * * *', async () => {
  console.log('[CRON] Running subscription renewal check...');
  
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Find subscriptions expiring in 7 days (for reminder email)
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

    // Send renewal reminder emails
    for (const subscription of expiringSubscriptions) {
      const daysLeft = Math.ceil(
        (subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const adminUser = subscription.association.users[0];
      if (adminUser && adminUser.email) {
        try {
          await sendEmail({
            to: adminUser.email,
            subject: `Subscription renewal in ${daysLeft} days`,
            template: 'renewal-reminder',
            data: {
              associationName: subscription.association.name,
              daysLeft,
              planName: subscription.plan.name,
              amount: subscription.billingCycle === 'ANNUAL' 
                ? subscription.plan.priceAnnual.toNumber()
                : subscription.plan.priceMonthly.toNumber(),
              billingCycle: subscription.billingCycle,
              renewalDate: subscription.currentPeriodEnd.toLocaleDateString(),
              manageUrl: `${process.env.APP_URL}/dashboard/subscription`,
            },
          });
          
          console.log(`Sent renewal reminder to ${adminUser.email} (${daysLeft} days left)`);
        } catch (emailError) {
          console.error(`Failed to send renewal reminder to ${adminUser.email}:`, emailError);
        }
      }
    }

    // Find expired subscriptions
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          lt: now,
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
      },
    });

    // Update expired subscriptions to EXPIRED status
    if (expiredSubscriptions.length > 0) {
      const expiredIds = expiredSubscriptions.map(s => s.id);
      
      await prisma.subscription.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'EXPIRED' },
      });

      console.log(`Expired ${expiredSubscriptions.length} subscriptions`);

      // Send subscription expired emails
      for (const subscription of expiredSubscriptions) {
        const adminUser = subscription.association.users[0];
        if (adminUser && adminUser.email) {
          try {
            await sendEmail({
              to: adminUser.email,
              subject: 'Your subscription has expired',
              template: 'subscription-expired',
              data: {
                associationName: subscription.association.name,
                renewUrl: `${process.env.APP_URL}/dashboard/subscription/plans`,
              },
            });
            
            console.log(`Sent subscription expired email to ${adminUser.email}`);
          } catch (emailError) {
            console.error(`Failed to send subscription expired email to ${adminUser.email}:`, emailError);
          }
        }
      }
    }

    console.log(`[CRON] Renewal check complete. Reminded: ${expiringSubscriptions.length}, Expired: ${expiredSubscriptions.length}`);
  } catch (error) {
    console.error('[CRON] Error checking subscription renewal:', error);
  }
}, {
  scheduled: false,
});

// Check for past due subscriptions - Runs every 6 hours
export const checkPastDueSubscriptions = cron.schedule('0 */6 * * *', async () => {
  console.log('[CRON] Checking for past due subscriptions...');
  
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    // Find past due subscriptions older than 3 days
    const pastDueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        currentPeriodEnd: {
          lt: threeDaysAgo,
        },
      },
    });

    if (pastDueSubscriptions.length > 0) {
      // Suspend past due subscriptions
      const pastDueIds = pastDueSubscriptions.map(s => s.id);
      
      await prisma.subscription.updateMany({
        where: { id: { in: pastDueIds } },
        data: { status: 'EXPIRED' },
      });

      console.log(`Suspended ${pastDueSubscriptions.length} past due subscriptions`);
    }
  } catch (error) {
    console.error('[CRON] Error checking past due subscriptions:', error);
  }
}, {
  scheduled: false,
});

// Start all cron jobs
export function startSubscriptionJobs() {
  console.log('Starting subscription cron jobs...');
  checkTrialExpiry.start();
  checkSubscriptionRenewal.start();
  checkPastDueSubscriptions.start();
  console.log('✓ All subscription cron jobs started');
}

// Stop all cron jobs (for graceful shutdown)
export function stopSubscriptionJobs() {
  console.log('Stopping subscription cron jobs...');
  checkTrialExpiry.stop();
  checkSubscriptionRenewal.stop();
  checkPastDueSubscriptions.stop();
  console.log('✓ All subscription cron jobs stopped');
}
