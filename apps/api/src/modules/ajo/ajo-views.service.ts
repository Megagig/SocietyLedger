/**
 * Read-only views over a group's people and schedules (T3). Nothing here writes, so it stays available in read-only mode.
 * Kobo is returned as strings.
 */
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { REQUIREMENT_TEXT, loadRequirementFacts, unmetRequirements } from './ajo-membership.service';
import { toGroupView } from './ajo-group.service';
import { permissionHolderIds } from './ajo-support';
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
export async function listMembershipInstallments(input: { associationId: number; membershipId: number }) {
  const membership = await prisma.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, select: { id: true, shares: true, status: true } });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  const rows = await prisma.ajoInstallment.findMany({ where: { membershipId: membership.id }, orderBy: { dueDate: 'asc' } });
  const total = rows.reduce((sum, r) => sum + r.amountKobo, 0n);
  const paid = rows.reduce((sum, r) => sum + r.paidKobo, 0n);
  return {
    membershipId: membership.id,
    shares: membership.shares,
    totals: { expectedKobo: total.toString(), paidKobo: paid.toString(), remainingKobo: (total - paid).toString() },
    installments: rows.map((r) => ({ id: r.id, dueDate: r.dueDate, amountKobo: r.amountKobo.toString(), paidKobo: r.paidKobo.toString(), status: r.status })),
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
    const [installments, slots] = await Promise.all([
      prisma.ajoInstallment.findMany({ where: { membershipId: m.id, status: { not: 'WAIVED' } }, orderBy: { dueDate: 'asc' }, select: { dueDate: true, amountKobo: true, paidKobo: true } }),
      prisma.ajoPayoutSlot.findMany({ where: { membershipId: m.id }, orderBy: { position: 'asc' }, select: { position: true } }),
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
