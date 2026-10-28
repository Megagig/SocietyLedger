/**
 * Read-only views over a group's people and schedules (T3). Nothing here writes, so it stays available in read-only mode.
 * Kobo is returned as strings.
 */
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { REQUIREMENT_TEXT, loadRequirementFacts, unmetRequirements } from './ajo-membership.service';
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
