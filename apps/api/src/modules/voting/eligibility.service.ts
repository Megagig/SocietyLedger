// ============================================
// WHO CAN VOTE AND WHO CAN STAND — the part that looks members up
// The rules themselves are in eligibility-rules.ts. This reads what they need from the database (status, category, join date, and what
// a member owes on overdue charges), applies the committee's exceptions, and saves rules and exceptions.
// ============================================

import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { overdueWhere } from '../finance/overdue-rules';
import {
  describeRule,
  evaluateEligibility,
  hasRules,
  needsFinancials,
  normalizeRules,
  type Eligibility,
  type EligibilityRules,
  type EligibilityScope,
  type ExceptionKind,
  type MemberFacts,
} from './eligibility-rules';

type Db = Prisma.TransactionClient;

export const ELIGIBILITY_TEMPLATE_KEY = 'election_eligibility_template';

/** The member categories the app has always known, so the list is never empty. Any other category in use is added to it. */
const KNOWN_CATEGORIES = ['regular', 'executive', 'honorary', 'student'];

const owed = (amount: Prisma.Decimal | number, payments: { amountPaid: Prisma.Decimal | number }[]) =>
  Math.max(0, Number(amount) - payments.reduce((sum, p) => sum + Number(p.amountPaid), 0));

/** The rules saved on an election, read safely: a rule that can't be read is treated as none rather than locking everyone out. */
export function rulesOf(election: { eligibilityRules: unknown }): EligibilityRules | null {
  try {
    return normalizeRules(election.eligibilityRules);
  } catch {
    return null;
  }
}

/** What each member still owes on charges past their due date. Members who owe nothing are absent from the result. */
async function overdueOwedByMember(db: Db, associationId: number, memberIds: number[] | null, now: Date): Promise<Map<number, number>> {
  const charges = await db.transaction.findMany({
    where: { associationId, ...(memberIds ? { memberId: { in: memberIds } } : {}), ...overdueWhere(now) },
    select: { memberId: true, amount: true, payments: { select: { amountPaid: true } } },
  });
  const totals = new Map<number, number>();
  for (const c of charges) totals.set(c.memberId, (totals.get(c.memberId) ?? 0) + owed(c.amount, c.payments));
  return totals;
}

const exceptionKey = (memberId: number, scope: EligibilityScope) => `${memberId}:${scope}`;

async function exceptionsFor(db: Db, electionId: number): Promise<Map<string, ExceptionKind>> {
  const rows = await db.electionEligibilityException.findMany({ where: { electionId }, select: { memberId: true, scope: true, kind: true } });
  return new Map(rows.map((r) => [exceptionKey(r.memberId, r.scope as EligibilityScope), r.kind as ExceptionKind]));
}

export const eligibilityService = {
  // ---------------------------------------------------------------- checking one member

  /** Whether one member may vote, or stand, in an election right now — with the reason when not. */
  async check(
    db: Db,
    associationId: number,
    election: { id: number; eligibilityRules: unknown },
    memberId: number,
    scope: EligibilityScope,
    /** The caller has already confirmed the member is active (voting and nominating do), so with no rule there is nothing left to look up. */
    assumeActive = false,
  ): Promise<Eligibility> {
    const rules = rulesOf(election);
    const now = new Date();
    if (assumeActive && !hasRules(rules) && !(await db.electionEligibilityException.count({ where: { electionId: election.id, memberId, scope } }))) {
      return { eligible: true, reason: null, code: 'OK' };
    }
    const member = await db.member.findFirst({ where: { id: memberId, associationId }, select: { status: true, category: true, joinDate: true } });
    if (!member) return { eligible: false, reason: 'Member not found.', code: 'NOT_ACTIVE' };

    // With no rule the only requirement is the one there has always been, so nothing else is looked up.
    if (!hasRules(rules)) {
      return evaluateEligibility(scope, { rules: null, facts: { ...member, overdueOwed: 0, now }, exception: null });
    }

    const overdue = needsFinancials(rules) ? (await overdueOwedByMember(db, associationId, [memberId], now)).get(memberId) ?? 0 : 0;
    const facts: MemberFacts = { ...member, overdueOwed: overdue, now };
    const exceptions = await exceptionsFor(db, election.id);

    let currentCandidacies = 0;
    if (scope === 'STAND' && rules?.candidates?.maxPositions) {
      currentCandidacies = await db.candidate.count({
        where: { electionId: election.id, memberId, status: { notIn: ['REJECTED', 'WITHDRAWN'] } },
      });
    }

    return evaluateEligibility(scope, {
      rules,
      facts,
      exception: exceptions.get(exceptionKey(memberId, scope)) ?? null,
      voteException: exceptions.get(exceptionKey(memberId, 'VOTE')) ?? null,
      currentCandidacies,
    });
  },

  /** Throws the reason as a plain-words refusal when the member may not vote, or stand. */
  async assertEligible(db: Db, associationId: number, election: { id: number; eligibilityRules: unknown }, memberId: number, scope: EligibilityScope): Promise<void> {
    const result = await this.check(db, associationId, election, memberId, scope, true);
    if (!result.eligible) throw new RuleError(result.reason ?? 'You are not eligible.', 403, 'NOT_ELIGIBLE');
  },

  // ---------------------------------------------------------------- counting who can vote

  /**
   * How many members can vote in this election, and the share who have. With no voter rule it is the number fixed when voting opened,
   * as before. With one it is counted now — a member who clears an overdue charge mid-election joins it — plus anyone who already voted,
   * since a vote once cast is never taken back.
   */
  async eligibleVoterCount(db: Db, associationId: number, election: { id: number; eligibilityRules: unknown; eligibleVoterCount: number }, voterIds: number[]): Promise<number> {
    const rules = rulesOf(election);
    if (!rules?.voters && !(await db.electionEligibilityException.count({ where: { electionId: election.id, scope: 'VOTE' } }))) return election.eligibleVoterCount;

    const now = new Date();
    const [members, exceptions, overdue] = await Promise.all([
      db.member.findMany({ where: { associationId, status: 'active' }, select: { id: true, status: true, category: true, joinDate: true } }),
      exceptionsFor(db, election.id),
      needsFinancials(rules) ? overdueOwedByMember(db, associationId, null, now) : Promise.resolve(new Map<number, number>()),
    ]);

    const eligible = new Set<number>(voterIds);
    for (const m of members) {
      const result = evaluateEligibility('VOTE', {
        rules,
        facts: { status: m.status, category: m.category, joinDate: m.joinDate, overdueOwed: overdue.get(m.id) ?? 0, now },
        exception: exceptions.get(exceptionKey(m.id, 'VOTE')) ?? null,
      });
      if (result.eligible) eligible.add(m.id);
    }
    return eligible.size;
  },

  // ---------------------------------------------------------------- what a member sees

  /** For the signed-in member: may I vote, may I stand, and what does this election ask of people. */
  async myEligibility(associationId: number, electionId: number, memberId: number) {
    const election = await prisma.election.findFirst({ where: { id: electionId, associationId }, select: { id: true, eligibilityRules: true } });
    if (!election) throw new Error('Election not found');

    const rules = rulesOf(election);
    const [vote, stand] = await Promise.all([
      this.check(prisma, associationId, election, memberId, 'VOTE'),
      this.check(prisma, associationId, election, memberId, 'STAND'),
    ]);

    return {
      hasRules: hasRules(rules),
      vote,
      stand,
      requirements: { voters: describeRule(rules?.voters), candidates: describeRule(rules?.candidates) },
    };
  },

  // ---------------------------------------------------------------- the committee's view

  async getForElection(associationId: number, electionId: number) {
    const election = await prisma.election.findFirst({ where: { id: electionId, associationId }, select: { id: true, eligibilityRules: true } });
    if (!election) throw new Error('Election not found');

    const rules = rulesOf(election);
    const exceptions = await prisma.electionEligibilityException.findMany({
      where: { electionId },
      orderBy: { createdAt: 'asc' },
      include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } } },
    });

    return {
      rules,
      requirements: { voters: describeRule(rules?.voters), candidates: describeRule(rules?.candidates) },
      exceptions,
    };
  },

  /** Saves the rules on an election, until voting opens. An empty rule puts the election back to "every active member". */
  async setForElection(associationId: number, electionId: number, raw: unknown) {
    const rules = normalizeRules(raw);

    const { count } = await prisma.election.updateMany({
      where: { id: electionId, associationId, status: { in: ['DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED'] } },
      data: { eligibilityRules: rules === null ? Prisma.DbNull : (rules as unknown as Prisma.InputJsonValue) },
    });
    if (count !== 1) {
      const election = await prisma.election.findFirst({ where: { id: electionId, associationId }, select: { id: true } });
      if (!election) throw new Error('Election not found');
      throw new RuleError('The rules can only be changed before voting opens. Add an exception for a single member instead.', 409, 'RULES_LOCKED');
    }
    return this.getForElection(associationId, electionId);
  },

  async addException(associationId: number, electionId: number, userId: number, input: { memberId: number; scope: EligibilityScope; kind: ExceptionKind; reason: string }) {
    const reason = input.reason?.trim();
    if (!reason) throw new RuleError('Say why — the reason stays on record.', 400, 'REASON_REQUIRED');

    const election = await prisma.election.findFirst({ where: { id: electionId, associationId }, select: { id: true, status: true } });
    if (!election) throw new Error('Election not found');
    if (election.status === 'VOTING_CLOSED' || election.status === 'RESULTS_PUBLISHED' || election.status === 'CANCELLED') {
      throw new RuleError("Exceptions can't be changed once voting has closed.", 409, 'EXCEPTIONS_LOCKED');
    }

    const member = await prisma.member.findFirst({ where: { id: input.memberId, associationId }, select: { id: true } });
    if (!member) throw new RuleError('That member was not found.', 404, 'MEMBER_NOT_FOUND');

    // Someone who has already voted can't then be barred from voting: the vote stays, so the record would only contradict itself.
    if (input.scope === 'VOTE' && input.kind === 'BAR') {
      const voted = await prisma.vote.findFirst({ where: { electionId, voterId: input.memberId }, select: { id: true } });
      if (voted) throw new RuleError('This member has already voted, and a vote that has been cast is never taken back.', 409, 'ALREADY_VOTED');
    }

    return prisma.electionEligibilityException.upsert({
      where: { electionId_memberId_scope: { electionId, memberId: input.memberId, scope: input.scope } },
      update: { kind: input.kind, reason, createdBy: userId },
      create: { electionId, memberId: input.memberId, scope: input.scope, kind: input.kind, reason, createdBy: userId },
      include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } } },
    });
  },

  async removeException(associationId: number, exceptionId: number) {
    const exception = await prisma.electionEligibilityException.findFirst({
      where: { id: exceptionId, election: { associationId } },
      select: { id: true, election: { select: { status: true } } },
    });
    if (!exception) throw new Error('Exception not found');
    if (['VOTING_CLOSED', 'RESULTS_PUBLISHED', 'CANCELLED'].includes(exception.election.status)) {
      throw new RuleError("Exceptions can't be changed once voting has closed.", 409, 'EXCEPTIONS_LOCKED');
    }
    await prisma.electionEligibilityException.delete({ where: { id: exceptionId } });
    return { success: true };
  },

  /**
   * Who a rule would let in and who it would turn away, before it is saved: how many of the association's active members could vote and
   * stand, and the first few who couldn't, with the reason. Lets the committee see what a rule does before an election depends on it.
   */
  async preview(associationId: number, raw: unknown) {
    const rules = normalizeRules(raw);
    const now = new Date();
    const [members, overdue] = await Promise.all([
      prisma.member.findMany({
        where: { associationId, status: 'active' },
        select: { id: true, memberId: true, firstName: true, lastName: true, status: true, category: true, joinDate: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      needsFinancials(rules) ? overdueOwedByMember(prisma, associationId, null, now) : Promise.resolve(new Map<number, number>()),
    ]);

    let canVote = 0;
    let canStand = 0;
    const turnedAway: { memberId: number; memberNumber: string; name: string; scope: EligibilityScope; reason: string }[] = [];
    for (const m of members) {
      const facts: MemberFacts = { status: m.status, category: m.category, joinDate: m.joinDate, overdueOwed: overdue.get(m.id) ?? 0, now };
      // The "stand for at most N positions" limit depends on the election, so the preview leaves it out.
      const vote = evaluateEligibility('VOTE', { rules, facts });
      const stand = evaluateEligibility('STAND', { rules, facts });
      if (vote.eligible) canVote++;
      if (stand.eligible) canStand++;
      for (const [scope, result] of [['VOTE', vote], ['STAND', stand]] as const) {
        if (!result.eligible && turnedAway.length < 100 && !(scope === 'STAND' && !vote.eligible && rules?.candidates?.mustBeVoter)) {
          turnedAway.push({ memberId: m.id, memberNumber: m.memberId, name: `${m.firstName} ${m.lastName}`.trim(), scope, reason: result.reason ?? '' });
        }
      }
    }

    return { activeMembers: members.length, canVote, canStand, turnedAway };
  },

  // ---------------------------------------------------------------- the association's template

  /** The saved template, or null when the association has none (the default). */
  async getTemplate(associationId: number): Promise<EligibilityRules | null> {
    const row = await prisma.settings.findUnique({ where: { associationId_key: { associationId, key: ELIGIBILITY_TEMPLATE_KEY } }, select: { value: true } });
    if (!row?.value) return null;
    try {
      return normalizeRules(JSON.parse(row.value));
    } catch {
      return null;
    }
  },

  /** Saves the template that new elections start from. An empty rule removes it. It never changes an election that already exists. */
  async setTemplate(associationId: number, userId: number, raw: unknown): Promise<EligibilityRules | null> {
    const rules = normalizeRules(raw);
    if (rules === null) {
      await prisma.settings.deleteMany({ where: { associationId, key: ELIGIBILITY_TEMPLATE_KEY } });
      return null;
    }
    await prisma.settings.upsert({
      where: { associationId_key: { associationId, key: ELIGIBILITY_TEMPLATE_KEY } },
      update: { value: JSON.stringify(rules), updatedBy: userId },
      create: { associationId, key: ELIGIBILITY_TEMPLATE_KEY, value: JSON.stringify(rules), description: 'Rules new elections start from: who can vote and who can stand', updatedBy: userId },
    });
    return rules;
  },

  /** What the rule forms offer to choose from: the member categories in use here, plus the ones the app has always had. */
  async options(associationId: number) {
    const used = await prisma.member.groupBy({ by: ['category'], where: { associationId } });
    const categories = Array.from(new Set([...KNOWN_CATEGORIES, ...used.map((u) => u.category.toLowerCase())])).sort();
    return { categories };
  },
};
