/**
 * Writes a group's schedule to the database (T3.4). The arithmetic is in ajo-schedule.ts; this applies it, safely and repeatably.
 *
 * Every function runs in the caller's transaction. Running one twice changes nothing the second time, and an installment with money or a
 * contribution against it is never deleted, moved or re-priced.
 */
import { Prisma } from '@prisma/client';
import { RuleError } from '../finance/rule-error';
import { ensureCycle } from './ajo-cycle-data';
import { cycleStartOf } from './ajo-cycle';
import { businessDay, diffSchedule, groupDates, installmentAmount, wantedInstallments, type ExistingInstallment, type GroupShape } from './ajo-schedule';

type Tx = Prisma.TransactionClient;

export interface ScheduleSummary {
  created: number;
  removed: number;
  repriced: number;
}

/** The group's dates. For collector thrift this is the cycle now running, which starts on the group's start date for cycle 1 and later where the next cycle was started. */
function shapeOf(group: { model: 'COLLECTOR_THRIFT' | 'ROTATING_POT'; frequency: GroupShape['frequency']; intervalCount: number | null; intervalUnit: GroupShape['intervalUnit']; startDate: Date; cycleStartsOn: Date | null; cycleLength: number | null; rounds: number | null }): GroupShape {
  return { model: group.model, frequency: group.frequency, intervalCount: group.intervalCount, intervalUnit: group.intervalUnit, startDate: group.model === 'COLLECTOR_THRIFT' ? cycleStartOf(group) : group.startDate, cycleLength: group.cycleLength, rounds: group.rounds };
}

/**
 * Bring one membership's installments in line with the group. A membership that is not ACTIVE owes nothing from today on. Someone who
 * became active after the group started owes only from the day they joined, so the cycle still ends where it ends for everyone, and a
 * later regeneration never back-fills the days before they were there.
 */
export async function syncMembershipSchedule(tx: Tx, input: { groupId: number; membershipId: number; now: Date }): Promise<ScheduleSummary> {
  const group = await tx.ajoGroup.findUnique({ where: { id: input.groupId } });
  if (!group) throw new RuleError('That circle was not found.', 404, 'GROUP_NOT_FOUND');
  if (group.status !== 'ACTIVE') throw new RuleError('A schedule exists only once a circle has started.', 409, 'GROUP_NOT_STARTED');
  const membership = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, groupId: group.id }, select: { id: true, associationId: true, status: true, shares: true, joinedAt: true } });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');

  const today = businessDay(input.now, group.timezone, group.cutoffTime);
  const { dates } = groupDates(shapeOf(group));
  const joinedLate = membership.joinedAt !== null && group.startedAt !== null && membership.joinedAt.getTime() > group.startedAt.getTime();
  const from = joinedLate ? businessDay(membership.joinedAt as Date, group.timezone, group.cutoffTime) : null;
  // Collector thrift: each saver pays their own amount for the cycle (spec §16.5). A rotating pot has one fixed amount, times shares.
  const perTime = group.model === 'COLLECTOR_THRIFT' ? (await ensureCycle(tx, { id: membership.id, associationId: membership.associationId, groupId: group.id }, group.cycleNo, group.contributionKobo)).amountKobo : installmentAmount(group.model, group.contributionKobo, membership.shares);
  const wanted = membership.status === 'ACTIVE' ? wantedInstallments({ dates, amountKobo: perTime, from }) : [];

  // Only this cycle's installments are compared, so an earlier cycle's rows are never touched.
  const rows = await tx.ajoInstallment.findMany({ where: { membershipId: membership.id, cycleNo: group.cycleNo }, include: { _count: { select: { contributions: true } } } });
  const existing: ExistingInstallment[] = rows.map((r) => ({ id: r.id, dueDate: r.dueDate, amountKobo: r.amountKobo, paidKobo: r.paidKobo, hasContributions: r._count.contributions > 0 }));
  const diff = diffSchedule(wanted, existing);

  // Past installments that are unpaid stay: they are arrears, not something to tidy away. Only the ones still ahead can be removed.
  const dateOf = new Map(rows.map((r) => [r.id, r.dueDate.getTime()]));
  const removable = diff.toDelete.filter((id) => (dateOf.get(id) ?? 0) >= today.getTime());

  if (diff.toCreate.length) {
    await tx.ajoInstallment.createMany({ data: diff.toCreate.map((w) => ({ associationId: membership.associationId, membershipId: membership.id, cycleNo: group.cycleNo, dueDate: w.dueDate, amountKobo: w.amountKobo })), skipDuplicates: true });
  }
  if (removable.length) await tx.ajoInstallment.deleteMany({ where: { id: { in: removable }, paidKobo: 0n, contributions: { none: {} } } });
  for (const u of diff.toUpdate) await tx.ajoInstallment.updateMany({ where: { id: u.id, paidKobo: 0n, contributions: { none: {} } }, data: { amountKobo: u.amountKobo } });

  return { created: diff.toCreate.length, removed: removable.length, repriced: diff.toUpdate.length };
}

/** Generate the schedule for everyone who is ACTIVE. Used when a group starts; safe to run again. */
export async function generateGroupSchedule(tx: Tx, input: { groupId: number; now: Date }): Promise<ScheduleSummary & { memberships: number }> {
  const active = await tx.ajoMembership.findMany({ where: { groupId: input.groupId, status: 'ACTIVE' }, select: { id: true } });
  const total: ScheduleSummary & { memberships: number } = { created: 0, removed: 0, repriced: 0, memberships: active.length };
  for (const { id } of active) {
    const s = await syncMembershipSchedule(tx, { groupId: input.groupId, membershipId: id, now: input.now });
    total.created += s.created;
    total.removed += s.removed;
    total.repriced += s.repriced;
  }
  return total;
}
