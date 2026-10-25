import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import { tenantBaseUrl } from '../lib/tenant-url';
import { invalidateAccessCache } from '../services/subscription-access.service';

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

    // Send warning emails for trials expiring soon: once at 3 days left and once at 1 day left.
    for (const subscription of expiringTrials) {
      const daysLeft = Math.ceil(
        (subscription.trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft !== 3 && daysLeft !== 1) continue;

      const adminUser = subscription.association.users[0];
      if (adminUser && adminUser.email) {
        try {
          await sendEmail({
            to: adminUser.email,
            subject: `Your free trial ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
            template: 'trial-expiry-warning',
            data: {
              associationName: subscription.association.name,
              daysLeft,
              planName: subscription.plan.name,
              planPrice: subscription.billingCycle === 'ANNUAL' 
                ? subscription.plan.priceAnnual.toNumber()
                : subscription.plan.priceMonthly.toNumber(),
              billingCycle: subscription.billingCycle,
              subscribeUrl: `${tenantBaseUrl(subscription.association.subdomain)}/dashboard/subscription/plans`,
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
      for (const expired of expiredTrials) invalidateAccessCache(expired.associationId);

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
                subscribeUrl: `${tenantBaseUrl(subscription.association.subdomain)}/dashboard/subscription/plans`,
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

    // Find subscriptions whose period has ended — G55: these now move to
    // PAST_DUE for a real grace period instead of jumping straight to
    // EXPIRED. checkPastDueSubscriptions below expires them for real after
    // 3 more days with no payment.
    const pastDueSubscriptions = await prisma.subscription.findMany({
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

    // Move them into PAST_DUE status
    if (pastDueSubscriptions.length > 0) {
      const pastDueIds = pastDueSubscriptions.map(s => s.id);

      await prisma.subscription.updateMany({
        where: { id: { in: pastDueIds } },
        data: { status: 'PAST_DUE' },
      });

      console.log(`Marked ${pastDueSubscriptions.length} subscriptions past due`);

      // Send past-due emails (grace period warning, not a hard expiry)
      for (const subscription of pastDueSubscriptions) {
        const adminUser = subscription.association.users[0];
        if (adminUser && adminUser.email) {
          try {
            await sendEmail({
              to: adminUser.email,
              subject: 'Payment overdue — your subscription is past due',
              template: 'subscription-past-due',
              data: {
                associationName: subscription.association.name,
                renewUrl: `${process.env.APP_URL}/dashboard/subscription/plans`,
              },
            });

            console.log(`Sent past-due email to ${adminUser.email}`);
          } catch (emailError) {
            console.error(`Failed to send past-due email to ${adminUser.email}:`, emailError);
          }
        }
      }
    }

    console.log(`[CRON] Renewal check complete. Reminded: ${expiringSubscriptions.length}, Past due: ${pastDueSubscriptions.length}`);
  } catch (error) {
    console.error('[CRON] Error checking subscription renewal:', error);
  }
});

// Check for past due subscriptions - Runs every 6 hours
export const checkPastDueSubscriptions = cron.schedule('0 */6 * * *', async () => {
  console.log('[CRON] Checking for past due subscriptions...');

  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Find past due subscriptions whose grace period (3 days, set by
    // checkSubscriptionRenewal) has run out
    const pastDueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'PAST_DUE',
        currentPeriodEnd: {
          lt: threeDaysAgo,
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

    if (pastDueSubscriptions.length > 0) {
      // Suspend past due subscriptions for real now that the grace period is over
      const pastDueIds = pastDueSubscriptions.map(s => s.id);

      await prisma.subscription.updateMany({
        where: { id: { in: pastDueIds } },
        data: { status: 'EXPIRED' },
      });

      console.log(`Expired ${pastDueSubscriptions.length} past-due subscriptions (grace period over)`);

      for (const subscription of pastDueSubscriptions) {
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
  } catch (error) {
    console.error('[CRON] Error checking past due subscriptions:', error);
  }
});

// Apply plan changes deferred by a downgrade (G54) once the current paid
// period actually ends — Runs daily at 1:45 AM, just before the renewal check
export const applyPendingPlanChanges = cron.schedule('45 1 * * *', async () => {
  console.log('[CRON] Applying pending plan changes...');

  try {
    const now = new Date();

    const dueChanges = await prisma.subscription.findMany({
      where: {
        pendingPlanId: { not: null },
        currentPeriodEnd: { lte: now },
      },
    });

    for (const subscription of dueChanges) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: subscription.pendingPlanId!,
          billingCycle: subscription.pendingBillingCycle ?? subscription.billingCycle,
          pendingPlanId: null,
          pendingBillingCycle: null,
        },
      });
      console.log(`Applied pending plan change for subscription ${subscription.id}`);
    }

    if (dueChanges.length > 0) {
      console.log(`[CRON] Applied ${dueChanges.length} pending plan change(s)`);
    }
  } catch (error) {
    console.error('[CRON] Error applying pending plan changes:', error);
  }
});

// Start all cron jobs
export function startSubscriptionJobs() {
  console.log('Starting subscription cron jobs...');
  checkTrialExpiry.start();
  applyPendingPlanChanges.start();
  checkSubscriptionRenewal.start();
  checkPastDueSubscriptions.start();
  console.log('✓ All subscription cron jobs started');
}

// Stop all cron jobs (for graceful shutdown)
export function stopSubscriptionJobs() {
  console.log('Stopping subscription cron jobs...');
  checkTrialExpiry.stop();
  applyPendingPlanChanges.stop();
  checkSubscriptionRenewal.stop();
  checkPastDueSubscriptions.stop();
  console.log('✓ All subscription cron jobs stopped');
}
