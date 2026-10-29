/**
 * The scheduled work of Ajo (T6): one cycle that marks overdue, assesses and discloses late fees, makes them payable, sends reminders,
 * opens default cases and watches repayment plans; and a daily one that records trust scores.
 *
 * Every step is safe to run again and again (see each service), so it does not matter if the server restarts mid-cycle or two servers run
 * it at once. A step that fails is logged and the rest still run. A tenant whose Ajo add-on is not fully active gets nothing new: an
 * expired add-on is read-only, which means no new fees, reminders or cases.
 */
import prisma from '../../lib/prisma';
import { ModuleFeatureService } from '../../services/module-feature.service';
import { detectDefaults, trackPlans } from './ajo-default.service';
import { assessLateFees, markOverdue, noticeLateFees, promotePayableFees, type RunGroup } from './ajo-latefee.service';
import { runCycleEndPrompts } from './ajo-cycle.service';
import { runReminders } from './ajo-reminder.service';
import type { DispatchInput } from '../sms/sms-engine';
import { snapshotTrust } from './ajo-trust.service';

export interface CycleGroup extends RunGroup {
  model: 'COLLECTOR_THRIFT' | 'ROTATING_POT';
}

/** Running groups whose tenant still has Ajo fully switched on. Passing group ids limits a run to those groups (for operations, and for tests). */
export async function eligibleGroups(groupIds?: number[]): Promise<CycleGroup[]> {
  const groups = await prisma.ajoGroup.findMany({ where: { status: 'ACTIVE', ...(groupIds ? { id: { in: groupIds } } : {}) }, select: { id: true, associationId: true, timezone: true, cutoffTime: true, name: true, model: true } });
  const enabled = new Map<number, boolean>();
  const out: CycleGroup[] = [];
  for (const g of groups) {
    if (!enabled.has(g.associationId)) enabled.set(g.associationId, (await ModuleFeatureService.getModuleStatus(g.associationId, 'ajo')).isEnabled);
    if (enabled.get(g.associationId)) out.push(g);
  }
  return out;
}

export interface CycleSummary {
  groups: number;
  overdueMarked: number;
  feesAssessed: number;
  feesTold: number;
  feesUnreachable: number;
  feesPayable: number;
  reminded: number;
  remindersSkipped: number;
  digests: number;
  casesOpened: number;
  planDatesMissed: number;
  plansCompleted: number;
  errors: string[];
}

async function step<T>(name: string, errors: string[], fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    errors.push(`${name}: ${error instanceof Error ? error.message : 'unknown error'}`);
    console.error(`[ajo-jobs] ${name} failed (the rest of the cycle carries on):`, error instanceof Error ? error.message : 'unknown error');
    return fallback;
  }
}

export async function runAjoRiskCycle(now: Date = new Date(), deps: { send?: DispatchInput['send']; groupIds?: number[] } = {}): Promise<CycleSummary> {
  const errors: string[] = [];
  const groups = await step('find groups', errors, () => eligibleGroups(deps.groupIds), [] as CycleGroup[]);
  const associationIds = [...new Set(groups.map((g) => g.associationId))];
  const groupIds = groups.map((g) => g.id);

  const overdueMarked = await step('mark overdue', errors, () => markOverdue(now, groups), 0);
  const assessed = await step('assess late fees', errors, () => assessLateFees(now, groups), { assessed: 0 });
  const told = await step('tell members about fees', errors, () => noticeLateFees(now, groups), { told: 0, unreachable: 0 });
  const feesPayable = await step('make fees payable', errors, () => promotePayableFees(now, associationIds), 0);
  const reminders = await step('reminders', errors, () => runReminders(now, groups, deps), { reminded: 0, skippedNoCredits: 0, digests: 0 });
  const casesOpened = await step('default cases', errors, () => detectDefaults(now, groups.filter((g) => g.model === 'ROTATING_POT')), 0);
  const plans = await step('repayment plans', errors, () => trackPlans(now, groupIds), { missed: 0, completed: 0 });

  return { groups: groups.length, overdueMarked, feesAssessed: assessed.assessed, feesTold: told.told, feesUnreachable: told.unreachable, feesPayable, reminded: reminders.reminded, remindersSkipped: reminders.skippedNoCredits, digests: reminders.digests, casesOpened, planDatesMissed: plans.missed, plansCompleted: plans.completed, errors };
}

/** The daily job: record each participant's trust score when it has changed. */
export async function runAjoDailyJobs(now: Date = new Date(), deps: { groupIds?: number[] } = {}): Promise<{ snapshots: number; cyclePrompts: number; errors: string[] }> {
  const errors: string[] = [];
  const groups = await step('find groups', errors, () => eligibleGroups(deps.groupIds), [] as CycleGroup[]);
  const snapshots = await step('trust snapshots', errors, () => snapshotTrust(now, groups), 0);
  // Collector thrift: ask savers, once, what they want to do as their cycle ends.
  const cyclePrompts = await step('cycle-end questions', errors, async () => (await runCycleEndPrompts(now)).asked, 0);
  return { snapshots, cyclePrompts, errors };
}
