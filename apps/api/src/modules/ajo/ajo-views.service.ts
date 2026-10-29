/**
 * Read-only views over a group's people and schedules (T3). Nothing here writes, so it stays available in read-only mode.
 * Kobo is returned as strings.
 */
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { REQUIREMENT_TEXT, loadRequirementFacts, unmetRequirements } from './ajo-membership.service';
import { toGroupView } from './ajo-group.service';
import { permissionHolderIds } from './ajo-support';
import { businessDay } from './ajo-schedule';
import { acceptanceStats } from './ajo-rules.service';

/** Everyone in a group, with what each person is still waiting for. For the officer's roster. */
export async function listGroupMembers(input: { associationId: number; groupId: number; now?: Date }) {
  const group = await prisma.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId }, select: { id: true } });
  if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  const rows = await prisma.ajoMembership.findMany({
    where: { groupId: group.id },
    orderBy: { id: 'asc' },
    include: { member: { select: { id: true, firstName: true, lastName: true, phone: true, userId: true } }, acceptances: { select: { evidence: true, ruleVersion: { select: { version: true } } } }, guarantorAgreement: { select: { evidence: true, acceptedAt: true } } },
  });
  const now = input.now ?? new Date();
  // SocietyLedger's check of each person, in one query for the whole roster (the newest review per person).
  const reviews = await prisma.ajoVerification.findMany({ where: { associationId: input.associationId, memberId: { in: rows.map((r) => r.memberId) } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { memberId: true, status: true } });
  const verification = new Map<number, string>();
  for (const r of reviews) if (!verification.has(r.memberId)) verification.set(r.memberId, r.status);
  const people = [];
  for (const m of rows) {
    const unmet = m.status === 'PENDING' ? unmetRequirements(await loadRequirementFacts(prisma, m.id, now)) : [];
    const newest = m.acceptances.reduce<(typeof m.acceptances)[number] | null>((best, a) => (!best || a.ruleVersion.version > best.ruleVersion.version ? a : best), null);
    people.push({
      membershipId: m.id,
      memberId: m.memberId,
      name: `${m.member.firstName} ${m.member.lastName}`.trim(),
      phone: m.member.phone,
      hasLogin: m.member.userId !== null,
      status: m.status,
      verification: (verification.get(m.memberId) ?? 'NOT_REQUESTED') as 'NOT_REQUESTED' | 'PENDING' | 'VERIFIED' | 'REJECTED',
      shares: m.shares,
      approvedAt: m.approvedAt,
      joinedAt: m.joinedAt,
      waitingFor: unmet.map((u) => ({ requirement: u, text: REQUIREMENT_TEXT[u] })),
      acceptedRuleVersion: newest?.ruleVersion.version ?? null,
      acceptedVia: (newest?.evidence as { channel?: string } | null)?.channel ?? null,
      guarantorRecorded: m.guarantorAgreement?.acceptedAt != null,
    });
  }
  return { people, rules: await acceptanceStats(prisma, group.id) };
}

/** One person's schedule: what is due, what has been paid against it. */
export async function listMembershipInstallments(input: { associationId: number; membershipId: number; now?: Date }) {
  const membership = await prisma.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, select: { id: true, shares: true, status: true, group: { select: { timezone: true, cutoffTime: true, model: true, cycleNo: true } } } });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  // A collector-thrift saver sees the cycle now running, so earlier cycles' rows do not muddy "to pay" and "paid so far".
  const cycleNo = membership.group.model === 'COLLECTOR_THRIFT' ? membership.group.cycleNo : 1;
  const rows = await prisma.ajoInstallment.findMany({ where: { membershipId: membership.id, cycleNo }, orderBy: { dueDate: 'asc' } });
  const today = businessDay(input.now ?? new Date(), membership.group.timezone, membership.group.cutoffTime);
  const total = rows.reduce((sum, r) => sum + r.amountKobo, 0n);
  const paid = rows.reduce((sum, r) => sum + r.paidKobo, 0n);
  return {
    membershipId: membership.id,
    shares: membership.shares,
    cycleNo,
    totals: { expectedKobo: total.toString(), paidKobo: paid.toString(), remainingKobo: (total - paid).toString() },
    installments: rows.map((r) => ({ id: r.id, dueDate: r.dueDate, amountKobo: r.amountKobo.toString(), paidKobo: r.paidKobo.toString(), status: r.status, /** Past its due day on the group's own calendar (its time zone and cut-off), not the reader's clock. */ pastDue: r.dueDate.getTime() < today.getTime() })),
  };
}

/**
 * The signed-in person’s own places in Ajo groups: one row per membership, with what is next for them. This is what the member screens
 * start from, because every other member call needs a membership id. It only ever reads rows that belong to the person’s own member
 * record, so an officer sees their own memberships here, not everyone’s.
 */
export async function listMyMemberships(input: { associationId: number; userId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const rows = await prisma.ajoMembership.findMany({
    where: { associationId: input.associationId, status: { not: 'LEFT' }, member: { userId: input.userId } },
    orderBy: { id: 'desc' },
    include: { group: true },
  });
  const out = [];
  for (const m of rows) {
    const [installments, slots, cycle] = await Promise.all([
      prisma.ajoInstallment.findMany({ where: { membershipId: m.id, status: { not: 'WAIVED' } }, orderBy: { dueDate: 'asc' }, select: { dueDate: true, amountKobo: true, paidKobo: true } }),
      prisma.ajoPayoutSlot.findMany({ where: { membershipId: m.id }, orderBy: { position: 'asc' }, select: { position: true } }),
      m.group.model === 'COLLECTOR_THRIFT' ? prisma.ajoMembershipCycle.findUnique({ where: { membershipId_cycleNo: { membershipId: m.id, cycleNo: m.group.cycleNo } } }) : Promise.resolve(null),
    ]);
    const owing = installments.filter((i) => i.amountKobo > i.paidKobo);
    const overdue = owing.filter((i) => i.dueDate.getTime() < now.getTime());
    const sum = (xs: typeof owing) => xs.reduce((s, i) => s + (i.amountKobo - i.paidKobo), 0n);
    const next = owing.find((i) => i.dueDate.getTime() >= now.getTime()) ?? null;
    const waitingFor = m.status === 'PENDING' ? unmetRequirements(await loadRequirementFacts(prisma, m.id, now)).map((u) => ({ requirement: u, text: REQUIREMENT_TEXT[u] })) : [];
    out.push({
      membershipId: m.id,
      status: m.status,
      shares: m.shares,
      group: toGroupView(m.group),
      /** Collector thrift: what this saver pays each time in the running cycle (their own choice), and which cycle that is. */
      amountKobo: m.group.model === 'COLLECTOR_THRIFT' ? (cycle?.amountKobo ?? m.group.contributionKobo).toString() : null,
      cycleNo: m.group.model === 'COLLECTOR_THRIFT' ? m.group.cycleNo : null,
      waitingFor,
      overdueKobo: sum(overdue).toString(),
      totalOwedKobo: sum(owing).toString(),
      nextDue: next ? { dueDate: next.dueDate, remainingKobo: (next.amountKobo - next.paidKobo).toString() } : null,
      payoutPositions: slots.map((s) => s.position),
      rounds: m.group.rounds,
    });
  }
  return out;
}

/**
 * Association members an officer can add to a group: active members matching a search by name, member number or phone. Phone numbers are
 * shown in full because the officer needs them to tell two people with the same name apart; nothing else private is returned.
 */
export async function searchPeople(input: { associationId: number; search?: string; take?: number }) {
  const term = (input.search ?? '').trim();
  const rows = await prisma.member.findMany({
    where: {
      associationId: input.associationId,
      status: 'active',
      ...(term ? { OR: [{ firstName: { contains: term, mode: 'insensitive' } }, { lastName: { contains: term, mode: 'insensitive' } }, { memberId: { contains: term, mode: 'insensitive' } }, { phone: { contains: term } }] } : {}),
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: Math.min(Math.max(input.take ?? 20, 1), 50),
    select: { id: true, memberId: true, firstName: true, lastName: true, phone: true, userId: true },
  });
  return rows.map((m) => ({ id: m.id, memberNumber: m.memberId, name: `${m.firstName} ${m.lastName}`.trim(), phone: m.phone, hasLogin: m.userId !== null }));
}

/** People in the association who hold the collector permission, so an officer can assign one. */
export async function listCollectorCandidates(associationId: number) {
  const ids = await permissionHolderIds(prisma, associationId, 'ajo.collect');
  if (!ids.length) return [];
  const users = await prisma.user.findMany({ where: { id: { in: ids }, associationId }, select: { id: true, email: true, member: { select: { firstName: true, lastName: true } } }, orderBy: { id: 'asc' } });
  return users.map((u) => ({ userId: u.id, name: u.member ? `${u.member.firstName} ${u.member.lastName}`.trim() : u.email, email: u.email }));
}

/**
 * Everyone in a group by name only, for the screens an officer without the right to manage members still needs (a reconciler confirming
 * a payment, an approver reading a payout): who a row belongs to. No phone numbers, no approval detail.
 */
export async function listGroupPeople(input: { associationId: number; groupId: number }) {
  const group = await prisma.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId }, select: { id: true } });
  if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  const rows = await prisma.ajoMembership.findMany({ where: { groupId: group.id }, orderBy: { id: 'asc' }, select: { id: true, status: true, shares: true, member: { select: { firstName: true, lastName: true } } } });
  return rows.map((m) => ({ membershipId: m.id, name: `${m.member.firstName} ${m.member.lastName}`.trim(), status: m.status, shares: m.shares }));
}
