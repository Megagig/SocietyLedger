import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { PlatformSettingsService } from '../modules/admin/platform-settings.service';
import { clampGraceDays, invalidateAccessCache } from '../services/subscription-access.service';
import { applyDueDeferredChanges } from '../services/billing/lifecycle.service';
import { applyDueMigrations } from '../services/billing/migration.service';
import { notifyBillingEvent } from '../services/billing/billing-notifications.service';
import { addDaysUtc } from '../services/billing/money';

/**
 * Subscription housekeeping.
 *
 * Whether an association may use the app is decided on every request from the stored period end and the server clock (see
 * subscription-access.service), so nothing here grants or removes access. These jobs keep the status column honest for reports and
 * admin screens, send the emails, and apply scheduled plan changes and migrations.
 */

const DAY = 24 * 60 * 60 * 1000;

export interface MaintenanceResult {
  movedToGrace: number;
  expired: number;
  cancelled: number;
  addonsEnded: number;
  downgradesApplied: number;
  migrationsApplied: number;
}

/** Bring statuses in line with the clock. Safe to run as often as you like. */
export async function syncSubscriptionStatuses(now = new Date()): Promise<MaintenanceResult> {
  const settings = await PlatformSettingsService.getSettings();
  const graceDays = clampGraceDays((settings as unknown as { gracePeriodDays?: unknown }).gracePeriodDays);
  const result: MaintenanceResult = { movedToGrace: 0, expired: 0, cancelled: 0, addonsEnded: 0, downgradesApplied: 0, migrationsApplied: 0 };
  const touched = new Set<number>();

  // Paid or complimentary periods that have ended
  const ended = await prisma.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'PAST_DUE'] }, currentPeriodEnd: { lt: now } },
    select: { id: true, associationId: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  });
  for (const sub of ended) {
    const graceEnd = addDaysUtc(sub.currentPeriodEnd, graceDays);
    const next = sub.cancelAtPeriodEnd ? 'CANCELLED' : graceEnd.getTime() > now.getTime() ? 'PAST_DUE' : 'EXPIRED';
    if (next === sub.status) continue;
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: next } });
    touched.add(sub.associationId);
    if (next === 'PAST_DUE') {
      result.movedToGrace += 1;
      void notifyBillingEvent({ type: 'SUBSCRIPTION_EXPIRED', associationId: sub.associationId, graceEndsAt: graceEnd });
    } else {
      if (next === 'CANCELLED') result.cancelled += 1;
      else result.expired += 1;
      void notifyBillingEvent({ type: 'SUBSCRIPTION_EXPIRED', associationId: sub.associationId });
    }
  }

  // Trials that have run out
  const trials = await prisma.subscription.findMany({
    where: { status: 'TRIALING', trialEndsAt: { lt: now } },
    select: { id: true, associationId: true },
  });
  for (const t of trials) {
    await prisma.subscription.update({ where: { id: t.id }, data: { status: 'EXPIRED' } });
    touched.add(t.associationId);
    result.expired += 1;
    void notifyBillingEvent({ type: 'SUBSCRIPTION_EXPIRED', associationId: t.associationId });
  }

  // Add-ons end with the subscription they were bought into (a grace period later, matching the entitlement rule).
  const addons = await prisma.tenantAddon.updateMany({
    where: { status: 'ACTIVE', endsAt: { lt: addDaysUtc(now, -graceDays) } },
    data: { status: 'ENDED' },
  });
  result.addonsEnded = addons.count;

  result.downgradesApplied = await applyDueDeferredChanges(now);
  result.migrationsApplied = await applyDueMigrations(now);

  for (const id of touched) invalidateAccessCache(id);
  return result;
}

/** Normalise the configured reminder days: whole days between 1 and 60, most distant first. */
export function reminderDays(value: unknown): number[] {
  const list = Array.isArray(value) ? value : [];
  const days = list.map((v) => Math.floor(Number(v))).filter((n) => Number.isFinite(n) && n >= 1 && n <= 60);
  return [...new Set(days)].sort((a, b) => b - a);
}

/** Remind associations whose subscription (or trial) ends in exactly one of the configured number of days. Each reminder goes out once. */
export async function sendExpiryReminders(now = new Date()): Promise<number> {
  const settings = await PlatformSettingsService.getSettings();
  const days = reminderDays((settings as unknown as { expiryReminderDays?: unknown }).expiryReminderDays);
  if (days.length === 0) return 0;
  const horizon = new Date(now.getTime() + Math.max(...days) * DAY);

  const subs = await prisma.subscription.findMany({
    where: {
      OR: [
        { status: 'ACTIVE', currentPeriodEnd: { gt: now, lte: horizon } },
        { status: 'TRIALING', trialEndsAt: { gt: now, lte: horizon } },
      ],
    },
    select: { id: true, associationId: true, status: true, currentPeriodEnd: true, trialEndsAt: true },
  });

  let sent = 0;
  for (const sub of subs) {
    const endsAt = sub.status === 'TRIALING' && sub.trialEndsAt ? sub.trialEndsAt : sub.currentPeriodEnd;
    const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / DAY);
    if (!days.includes(daysLeft)) continue;

    const already = await prisma.platformActionLog.findFirst({
      where: {
        actionType: 'SUBSCRIPTION_REMINDER_SENT',
        associationId: sub.associationId,
        targetId: sub.id,
        AND: [{ afterState: { path: ['daysLeft'], equals: daysLeft } }, { afterState: { path: ['endsAt'], equals: endsAt.toISOString() } }],
      },
      select: { id: true },
    });
    if (already) continue;

    await prisma.platformActionLog.create({
      data: {
        actorId: 0,
        actorRole: 'SYSTEM',
        actionType: 'SUBSCRIPTION_REMINDER_SENT',
        targetType: 'subscription',
        targetId: sub.id,
        associationId: sub.associationId,
        afterState: { daysLeft, endsAt: endsAt.toISOString() },
      },
    });
    await notifyBillingEvent({ type: 'EXPIRY_REMINDER', associationId: sub.associationId, daysLeft, endsAt });
    sent += 1;
  }
  return sent;
}

// Keep statuses current - hourly
export const syncStatusesJob = cron.schedule('10 * * * *', async () => {
  try {
    const r = await syncSubscriptionStatuses();
    const changed = Object.values(r).reduce((a, b) => a + b, 0);
    if (changed > 0) console.log('[CRON] Subscription maintenance:', r);
  } catch (error) {
    console.error('[CRON] Error syncing subscription statuses:', error);
  }
});

// Reminders before a subscription ends - daily at 07:00 UTC (08:00 in Nigeria)
export const expiryRemindersJob = cron.schedule('0 7 * * *', async () => {
  try {
    const sent = await sendExpiryReminders();
    console.log(`[CRON] Expiry reminders sent: ${sent}`);
  } catch (error) {
    console.error('[CRON] Error sending expiry reminders:', error);
  }
});

// Start all cron jobs
export function startSubscriptionJobs() {
  console.log('Starting subscription cron jobs...');
  syncStatusesJob.start();
  expiryRemindersJob.start();
  console.log('✓ All subscription cron jobs started');
}

// Stop all cron jobs (for graceful shutdown)
export function stopSubscriptionJobs() {
  console.log('Stopping subscription cron jobs...');
  syncStatusesJob.stop();
  expiryRemindersJob.stop();
  console.log('✓ All subscription cron jobs stopped');
}
