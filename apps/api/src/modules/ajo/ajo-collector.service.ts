/**
 * Collector assignments (T3.5): which collector looks after which contributor.
 *
 * A collector is a User who holds `ajo.collect`; a contributor is a membership. A contributor has at most one current collector. Changing
 * collector never edits the old assignment: it ends it the day before and starts a new one, so the history of who looked after whom stays
 * intact. A collector can see only the contributors currently assigned to them.
 */
import prisma from '../../lib/prisma';
import { PERMISSIONS } from '../../lib/permissions';
import { RBACService } from '../../services/rbac.service';
import { RuleError } from '../finance/rule-error';
import { toCalendarDate } from './ajo-schedule';
import { auditAjo, notifyUser } from './ajo-support';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AssignInput {
  associationId: number;
  membershipId: number;
  collectorUserId: number;
  actorUserId: number;
  /** Kobo the collector is expected to collect from this contributor each day. */
  dailyTargetKobo?: number | bigint | null;
  /** Defaults to today. */
  startsOn?: Date;
  now?: Date;
}

export async function assignCollector(input: AssignInput) {
  const now = input.now ?? new Date();
  const startsOn = toCalendarDate(input.startsOn ?? now);
  const target = input.dailyTargetKobo === undefined || input.dailyTargetKobo === null ? null : BigInt(input.dailyTargetKobo);
  if (target !== null && target < 0n) throw new RuleError('The daily target cannot be negative.', 400, 'INVALID_TARGET');

  // The collector must be a real login in this association who holds the collect permission. Checked outside the transaction: it only reads.
  const collector = await prisma.user.findFirst({ where: { id: input.collectorUserId, associationId: input.associationId, isActive: true }, select: { id: true, platformRole: true } });
  if (!collector) throw new RuleError('That collector was not found in this association.', 404, 'COLLECTOR_NOT_FOUND');
  const allowed = await RBACService.hasPermission({ userId: collector.id, associationId: input.associationId, platformRole: collector.platformRole ?? null }, PERMISSIONS.AJO_COLLECT);
  if (!allowed) throw new RuleError('That person is not set up as a collector. Give them the Collector role first.', 409, 'NOT_A_COLLECTOR');

  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, include: { group: { select: { name: true, status: true } }, member: { select: { firstName: true, lastName: true } } } });
    if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
    if (membership.status !== 'ACTIVE' && membership.status !== 'PENDING') throw new RuleError('Only a current participant can be assigned a collector.', 409, 'INVALID_MEMBERSHIP_STATE');
    if (membership.group.status === 'COMPLETED' || membership.group.status === 'CANCELLED') throw new RuleError('This group is closed.', 409, 'GROUP_CLOSED');

    // Take turns with anyone else reassigning the same contributor.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ajo-collector:' + membership.id}))`;
    const current = await tx.ajoCollectorAssignment.findFirst({ where: { membershipId: membership.id, endsOn: null }, orderBy: { id: 'desc' } });
    if (current && current.collectorUserId === input.collectorUserId && (current.dailyTargetKobo ?? null) === target) return { replayed: true, assignment: current, name: '', groupName: membership.group.name, previous: null as number | null };

    let previous: number | null = null;
    if (current) {
      // The old assignment ends the day before the new one starts (never before it began), and is otherwise left as it was.
      const end = new Date(Math.max(startsOn.getTime() - DAY_MS, current.startsOn.getTime()));
      await tx.ajoCollectorAssignment.update({ where: { id: current.id }, data: { endsOn: end } });
      previous = current.collectorUserId;
    }
    const assignment = await tx.ajoCollectorAssignment.create({ data: { associationId: input.associationId, collectorUserId: input.collectorUserId, membershipId: membership.id, dailyTargetKobo: target, startsOn, createdBy: input.actorUserId } });
    await auditAjo(tx, {
      associationId: input.associationId,
      userId: input.actorUserId,
      action: current ? 'AJO_COLLECTOR_REASSIGNED' : 'AJO_COLLECTOR_ASSIGNED',
      tableName: 'ajo_collector_assignments',
      recordId: assignment.id,
      oldValues: current ? { collectorUserId: current.collectorUserId } : null,
      newValues: { membershipId: membership.id, collectorUserId: input.collectorUserId, dailyTargetKobo: target?.toString() ?? null },
    });
    return { replayed: false, assignment, name: `${membership.member.firstName} ${membership.member.lastName}`.trim(), groupName: membership.group.name, previous };
  });

  if (!result.replayed) {
    await notifyUser(input.associationId, input.collectorUserId, { pushType: 'ajo.collector_assigned', entityId: result.assignment.id, title: 'New contributor assigned', message: `${result.name} in ${result.groupName} is now yours to collect from.` });
    if (result.previous && result.previous !== input.collectorUserId) await notifyUser(input.associationId, result.previous, { pushType: 'ajo.collector_unassigned', entityId: result.assignment.id, title: 'Contributor reassigned', message: `${result.name} in ${result.groupName} is no longer assigned to you.` });
  }
  return { assignmentId: result.assignment.id, collectorUserId: result.assignment.collectorUserId, startsOn: result.assignment.startsOn, dailyTargetKobo: result.assignment.dailyTargetKobo?.toString() ?? null, replayed: result.replayed };
}

/** End a contributor's current assignment without giving them a new collector. Idempotent. */
export async function unassignCollector(input: { associationId: number; membershipId: number; actorUserId: number; now?: Date }) {
  const today = toCalendarDate(input.now ?? new Date());
  return prisma.$transaction(async (tx) => {
    const membership = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, select: { id: true } });
    if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
    const current = await tx.ajoCollectorAssignment.findFirst({ where: { membershipId: membership.id, endsOn: null }, orderBy: { id: 'desc' } });
    if (!current) return { ended: false };
    const end = new Date(Math.max(today.getTime(), current.startsOn.getTime()));
    await tx.ajoCollectorAssignment.update({ where: { id: current.id }, data: { endsOn: end } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_COLLECTOR_UNASSIGNED', tableName: 'ajo_collector_assignments', recordId: current.id, oldValues: { collectorUserId: current.collectorUserId }, newValues: { endsOn: end.toISOString().slice(0, 10) } });
    return { ended: true };
  });
}

/** Contributors currently assigned to one collector, and nobody else's. A collector sees only these. */
export async function listAssignedContributors(input: { associationId: number; collectorUserId: number; now?: Date }) {
  const today = toCalendarDate(input.now ?? new Date());
  const rows = await prisma.ajoCollectorAssignment.findMany({
    where: { associationId: input.associationId, collectorUserId: input.collectorUserId, startsOn: { lte: today }, OR: [{ endsOn: null }, { endsOn: { gte: today } }], membership: { status: { in: ['PENDING', 'ACTIVE'] } } },
    orderBy: { id: 'asc' },
    include: { membership: { select: { id: true, status: true, groupId: true, group: { select: { name: true } }, member: { select: { firstName: true, lastName: true, phone: true } } } } },
  });
  return rows.map((r) => ({ assignmentId: r.id, membershipId: r.membershipId, status: r.membership.status, groupId: r.membership.groupId, groupName: r.membership.group.name, name: `${r.membership.member.firstName} ${r.membership.member.lastName}`.trim(), phone: r.membership.member.phone, dailyTargetKobo: r.dailyTargetKobo?.toString() ?? null, since: r.startsOn }));
}

/** Everyone assigned in a group, with their collector, for the officer's view. Includes ended assignments, so the history is visible. */
export async function listGroupAssignments(input: { associationId: number; groupId: number }) {
  const rows = await prisma.ajoCollectorAssignment.findMany({ where: { associationId: input.associationId, membership: { groupId: input.groupId } }, orderBy: { id: 'desc' } });
  return rows.map((r) => ({ assignmentId: r.id, membershipId: r.membershipId, collectorUserId: r.collectorUserId, dailyTargetKobo: r.dailyTargetKobo?.toString() ?? null, startsOn: r.startsOn, endsOn: r.endsOn }));
}
