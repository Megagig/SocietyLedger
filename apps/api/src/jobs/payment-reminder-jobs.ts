import cron from 'node-cron';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';

/**
 * Cron Jobs for Payment Reminders (R3.4/G43)
 *
 * G43 found two problems: the manual "Send Payment Reminders" button
 * reported fake success (console.log only, no real email), and no
 * scheduled job existed to send reminders automatically at all. The manual
 * fix lives in finance.controller.ts's sendPaymentReminders(); this job is
 * the automatic half.
 *
 * Uses the Notification Settings category's own documented defaults
 * (paymentReminderDays: [7, 3, 1], overdueReminderFrequency: 'weekly') as
 * hardcoded values for now — R4.6 will read these from the association's
 * real settings once that phase wires them up for real; this job's shape
 * doesn't need to change, just its data source.
 */

const REMINDER_DAYS_BEFORE_DUE = [7, 3, 1];
const OVERDUE_REMINDER_FREQUENCY_DAYS = 7; // 'weekly'

async function sendRemindersForDueTransactions() {
  let sent = 0;

  // Upcoming dues: exactly N days before dueDate, not already reminded today.
  for (const daysBefore of REMINDER_DAYS_BEFORE_DUE) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBefore);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const transactions = await prisma.transaction.findMany({
      where: {
        status: { in: ['pending', 'partial'] },
        isVoided: false,
        dueDate: { gte: startOfDay, lte: endOfDay },
        OR: [
          { lastReminderSentAt: null },
          { lastReminderSentAt: { lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
        ],
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
        category: { select: { name: true } },
        association: { select: { name: true } },
        payments: { select: { amountPaid: true } },
      },
    });

    for (const txn of transactions) {
      if (!txn.member.email) continue;
      const paid = txn.payments.reduce((p, pay) => p.plus(pay.amountPaid), new Decimal(0));
      const outstanding = new Decimal(txn.amount).minus(paid);
      if (outstanding.lessThanOrEqualTo(0)) continue;

      try {
        await sendEmail({
          to: txn.member.email,
          subject: `Payment Reminder: ${txn.category.name} for ${txn.association.name}`,
          template: 'payment-reminder',
          data: {
            memberName: `${txn.member.firstName} ${txn.member.lastName}`,
            associationName: txn.association.name,
            categoryName: txn.category.name,
            amount: outstanding.toNumber(),
            dueDate: txn.dueDate!.toLocaleDateString('en-NG'),
            daysUntilDue: daysBefore,
          },
        });
        await prisma.transaction.update({
          where: { id: txn.id },
          data: { lastReminderSentAt: new Date() },
        });
        sent++;
      } catch (error) {
        console.error(`[PAYMENT-REMINDER-JOBS] Failed to send reminder for transaction ${txn.id}:`, error);
      }
    }
  }

  // Overdue: past due date, reminded at most once per OVERDUE_REMINDER_FREQUENCY_DAYS.
  const overdueThreshold = new Date();
  overdueThreshold.setHours(0, 0, 0, 0);

  const sinceThreshold = new Date();
  sinceThreshold.setDate(sinceThreshold.getDate() - OVERDUE_REMINDER_FREQUENCY_DAYS);

  const overdueTransactions = await prisma.transaction.findMany({
    where: {
      status: { in: ['pending', 'partial', 'overdue'] },
      isVoided: false,
      dueDate: { lt: overdueThreshold },
      OR: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { lt: sinceThreshold } },
      ],
    },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, email: true } },
      category: { select: { name: true } },
      association: { select: { name: true } },
      payments: { select: { amountPaid: true } },
    },
  });

  for (const txn of overdueTransactions) {
    if (!txn.member.email) continue;
    const paid = txn.payments.reduce((p, pay) => p.plus(pay.amountPaid), new Decimal(0));
    const outstanding = new Decimal(txn.amount).minus(paid);
    if (outstanding.lessThanOrEqualTo(0)) continue;

    const daysOverdue = Math.ceil((Date.now() - txn.dueDate!.getTime()) / (1000 * 60 * 60 * 24));

    try {
      await sendEmail({
        to: txn.member.email,
        subject: `Overdue: ${txn.category.name} payment for ${txn.association.name}`,
        template: 'payment-overdue',
        data: {
          memberName: `${txn.member.firstName} ${txn.member.lastName}`,
          associationName: txn.association.name,
          categoryName: txn.category.name,
          amount: outstanding.toNumber(),
          dueDate: txn.dueDate!.toLocaleDateString('en-NG'),
          daysOverdue,
        },
      });
      await prisma.transaction.update({
        where: { id: txn.id },
        data: { lastReminderSentAt: new Date() },
      });
      sent++;
    } catch (error) {
      console.error(`[PAYMENT-REMINDER-JOBS] Failed to send overdue reminder for transaction ${txn.id}:`, error);
    }
  }

  return sent;
}

// Runs once a day at 08:00
export const checkPaymentReminders = cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] Running payment reminder check...');
  try {
    const sent = await sendRemindersForDueTransactions();
    console.log(`[CRON] Payment reminders sent: ${sent}`);
  } catch (error) {
    console.error('[CRON] Error running payment reminder job:', error);
  }
});

export function startPaymentReminderJobs() {
  console.log('Starting payment reminder cron jobs...');
  checkPaymentReminders.start();
  console.log('✓ Payment reminder job started (runs daily at 08:00)');
}

export function stopPaymentReminderJobs() {
  console.log('Stopping payment reminder cron jobs...');
  checkPaymentReminders.stop();
  console.log('✓ Payment reminder cron jobs stopped');
}
