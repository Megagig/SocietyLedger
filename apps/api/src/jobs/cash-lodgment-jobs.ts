import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { cashLodgmentsService } from '../modules/cash/cash-lodgments.service';
import { shouldRemindOverdue } from '../modules/cash/cash-rules';
import { notifyLodgmentOverdue } from '../modules/cash/cash-notifications';

/**
 * Cron job for cash collections: each morning, remind the officers who hold collected cash past the association's lodgment
 * deadline — and the officers who watch cash — that it has not been lodged. The first reminder is the day after the deadline,
 * then every third day, until the cash is lodged.
 */
export async function remindOverdueLodgments(): Promise<number> {
  let reminders = 0;
  const associations = await prisma.cashCollection.findMany({ where: { status: 'CLOSED' }, distinct: ['associationId'], select: { associationId: true } });

  for (const { associationId } of associations) {
    try {
      const overview = await cashLodgmentsService.getOverview(associationId, { userId: 0, viewAll: true });
      for (const officer of overview.officers) {
        if (!officer.overdue || officer.readyToLodge <= 0) continue;
        if (!shouldRemindOverdue(officer.daysUnlodged, overview.dueDays)) continue;
        await notifyLodgmentOverdue(associationId, {
          collectorUserId: officer.officer.id,
          collectorName: officer.officer.name,
          amount: officer.readyToLodge,
          days: officer.daysUnlodged,
        });
        reminders++;
      }
    } catch (error) {
      console.error(`Cash lodgment reminder failed for association ${associationId}:`, error);
    }
  }
  return reminders;
}

// 08:00 every day (server time)
const checkOverdueLodgments = cron.schedule(
  '0 8 * * *',
  async () => {
    console.log('Checking for overdue cash lodgments...');
    const sent = await remindOverdueLodgments();
    console.log(`✓ Overdue cash lodgment check done (${sent} reminder${sent === 1 ? '' : 's'})`);
  },
);

export function startCashLodgmentJobs() {
  // node-cron starts a task as soon as it is scheduled (same as the meeting and subscription jobs); start() is a no-op then.
  checkOverdueLodgments.start();
  console.log('✓ Cash lodgment reminder job started (runs daily at 08:00)');
}

export function stopCashLodgmentJobs() {
  checkOverdueLodgments.stop();
}
