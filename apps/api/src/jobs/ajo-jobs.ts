import cron from 'node-cron';
import { runAjoDailyJobs, runAjoRiskCycle } from '../modules/ajo/ajo-risk-cycle';

/**
 * Ajo's scheduled work (T6). Every step is safe to run twice, so a restart or a second server does no harm. Switch the whole thing off
 * with AJO_JOBS_DISABLED=true (for example on a machine that should never message real contributors).
 */
const disabled = () => process.env.AJO_JOBS_DISABLED === 'true';

// Hourly: overdue, late fees, reminders (sent from 08:00 in each group's own morning), default cases and repayment plans.
export const ajoRiskCycleJob = cron.schedule('5 * * * *', async () => {
  if (disabled()) return;
  try {
    const s = await runAjoRiskCycle();
    console.log(`[CRON] Ajo cycle: ${s.groups} groups, ${s.feesAssessed} fees assessed, ${s.reminded} reminded, ${s.casesOpened} cases opened${s.errors.length ? `, ${s.errors.length} step error(s)` : ''}`);
  } catch (error) {
    console.error('[CRON] Error running the Ajo cycle:', error);
  }
});

// Daily at 02:30: record trust scores.
export const ajoDailyJob = cron.schedule('30 2 * * *', async () => {
  if (disabled()) return;
  try {
    const s = await runAjoDailyJobs();
    console.log(`[CRON] Ajo daily: ${s.snapshots} trust snapshots${s.errors.length ? `, ${s.errors.length} error(s)` : ''}`);
  } catch (error) {
    console.error('[CRON] Error running the Ajo daily job:', error);
  }
});

export function startAjoJobs() {
  console.log('Starting Ajo cron jobs...');
  ajoRiskCycleJob.start();
  ajoDailyJob.start();
  console.log(`✓ Ajo jobs started (hourly cycle, daily trust snapshots)${disabled() ? ' - currently DISABLED by AJO_JOBS_DISABLED' : ''}`);
}

export function stopAjoJobs() {
  console.log('Stopping Ajo cron jobs...');
  ajoRiskCycleJob.stop();
  ajoDailyJob.stop();
  console.log('✓ Ajo cron jobs stopped');
}
