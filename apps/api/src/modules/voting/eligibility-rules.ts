// ============================================
// WHO CAN VOTE AND WHO CAN STAND
// Pure rules, so they can be tested without a database. An association chooses which conditions to switch on; nothing here is
// specific to one association. With no rule set, the only requirement is the one there has always been: an active member.
// ============================================

import { RuleError } from '../finance/rule-error';

export type EligibilityScope = 'VOTE' | 'STAND';

/** What the checks need to know about one member right now. */
export interface MemberFacts {
  status: string;
  category: string;
  joinDate: Date | null;
  /** What the member still owes on charges that are past their due date, in naira. */
  overdueOwed: number;
  now: Date;
}

/** A condition both voters and candidates can be held to. Each key is optional: a rule only holds a member to what it names. */
export interface MemberRule {
  /** Members may owe at most this much on overdue charges. 0 means nothing overdue. */
  financialStanding?: { maxOverdue: number };
  /** Members for at least this many months. */
  minMembershipMonths?: number;
  /** Only members in these categories. */
  categories?: string[];
}

export interface CandidateRule extends MemberRule {
  /** A candidate must also be allowed to vote in this election. */
  mustBeVoter?: boolean;
  /** One person can stand for at most this many positions. */
  maxPositions?: number;
}

export interface EligibilityRules {
  voters?: MemberRule;
  candidates?: CandidateRule;
}

export type ExceptionKind = 'ALLOW' | 'BAR';

const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const verb = (scope: EligibilityScope) => (scope === 'VOTE' ? 'vote' : 'stand');
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Whole months from `from` to `to`. */
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(months, 0);
}

interface Condition<C> {
  /** The words the committee reads: "Owes nothing overdue". */
  describe: (config: C) => string;
  /** Why this setting can't be saved, or null. */
  validate: (config: unknown) => string | null;
  /** Why this member doesn't meet it, or null when they do. */
  check: (config: C, facts: MemberFacts, scope: EligibilityScope) => string | null;
}

/**
 * The menu of conditions a rule can use. Adding one is one entry here — the checks, the saved rule and the screens that list the
 * conditions all read from this table, so nothing else has to change.
 */
export const MEMBER_CONDITIONS: { [K in keyof MemberRule]-?: Condition<NonNullable<MemberRule[K]>> } = {
  financialStanding: {
    describe: (c) => (c.maxOverdue > 0 ? `Owes no more than ${naira(c.maxOverdue)} on overdue charges` : 'Has no overdue charges'),
    validate: (c) => {
      const max = (c as { maxOverdue?: unknown } | null)?.maxOverdue;
      return typeof max === 'number' && Number.isFinite(max) && max >= 0 ? null : 'Say how much a member may owe on overdue charges (0 for nothing).';
    },
    check: (c, f, scope) => {
      if (f.overdueOwed <= c.maxOverdue + 0.0001) return null;
      return c.maxOverdue > 0
        ? `You owe ${naira(f.overdueOwed)} on overdue charges, and this election allows at most ${naira(c.maxOverdue)}. Pay some of it to ${verb(scope)}.`
        : `You have ${naira(f.overdueOwed)} overdue. Clear it to ${verb(scope)}.`;
    },
  },
  minMembershipMonths: {
    describe: (n) => `Has been a member for at least ${n} ${n === 1 ? 'month' : 'months'}`,
    validate: (n) => (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 600 ? null : 'Membership length must be a whole number of months, 1 or more.'),
    check: (n, f, scope) => {
      if (!f.joinDate) return `Your join date isn't on record, so we can't confirm you have been a member for ${n} months. Ask an officer to add it to be able to ${verb(scope)}.`;
      const months = monthsBetween(f.joinDate, f.now);
      return months >= n ? null : `You need to have been a member for at least ${n} ${n === 1 ? 'month' : 'months'} to ${verb(scope)}; you have been one for ${months}.`;
    },
  },
  categories: {
    describe: (list) => `Is one of: ${list.map(titleCase).join(', ')}`,
    validate: (list) =>
      Array.isArray(list) && list.length > 0 && list.every((c) => typeof c === 'string' && c.trim().length > 0 && c.length <= 50)
        ? null
        : 'Choose at least one member category.',
    check: (list, f, scope) =>
      list.some((c) => c.toLowerCase() === f.category.toLowerCase())
        ? null
        : `Only ${list.map((c) => titleCase(c).toLowerCase()).join(' and ')} members can ${verb(scope)} in this election.`,
  },
};

const CANDIDATE_ONLY_KEYS = ['mustBeVoter', 'maxPositions'] as const;

export function conditionKeys(scope: 'voters' | 'candidates'): string[] {
  return [...Object.keys(MEMBER_CONDITIONS), ...(scope === 'candidates' ? CANDIDATE_ONLY_KEYS : [])];
}

const bad = (message: string) => new RuleError(message, 400, 'BAD_ELIGIBILITY_RULE');

function cleanRule(raw: unknown, scope: 'voters' | 'candidates'): MemberRule | CandidateRule | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw bad('A rule must be a set of conditions.');
  const out: Record<string, unknown> = {};
  const allowed = conditionKeys(scope);
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === undefined || value === null || value === false) continue; // switched off
    if (!allowed.includes(key)) throw bad(`"${key}" is not something ${scope === 'voters' ? 'voters' : 'candidates'} can be checked on.`);
    if (key === 'mustBeVoter') {
      if (value !== true) throw bad('"Must be allowed to vote" is on or off.');
      out[key] = true;
    } else if (key === 'maxPositions') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 50) throw bad('The most positions one person can stand for must be 1 or more.');
      out[key] = value;
    } else {
      const condition = MEMBER_CONDITIONS[key as keyof MemberRule] as Condition<unknown>;
      const problem = condition.validate(value);
      if (problem) throw bad(problem);
      out[key] = key === 'categories' ? (value as string[]).map((c) => c.trim().toLowerCase()) : value;
    }
  }
  return Object.keys(out).length > 0 ? (out as MemberRule) : undefined;
}

/**
 * Checks a rule and drops what is switched off. Returns null when nothing is left, which means "every active member" — today's behaviour
 * — so an association that never sets a rule, or clears it, is back to the default.
 */
export function normalizeRules(raw: unknown): EligibilityRules | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw bad('The rules must name who can vote and who can stand.');
  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) if (key !== 'voters' && key !== 'candidates') throw bad(`"${key}" isn't part of the rules.`);
  const voters = cleanRule(input.voters, 'voters');
  const candidates = cleanRule(input.candidates, 'candidates');
  if (!voters && !candidates) return null;
  return { ...(voters ? { voters } : {}), ...(candidates ? { candidates: candidates as CandidateRule } : {}) };
}

/** The rule in plain words, one line per condition, for screens that show what an election requires. */
export function describeRule(rule: MemberRule | CandidateRule | undefined): string[] {
  if (!rule) return [];
  const lines: string[] = [];
  for (const key of Object.keys(MEMBER_CONDITIONS) as (keyof MemberRule)[]) {
    const config = rule[key];
    if (config !== undefined) lines.push((MEMBER_CONDITIONS[key] as Condition<unknown>).describe(config));
  }
  const candidate = rule as CandidateRule;
  if (candidate.mustBeVoter) lines.push('Must also be allowed to vote');
  if (candidate.maxPositions) lines.push(`Can stand for at most ${candidate.maxPositions} ${candidate.maxPositions === 1 ? 'position' : 'positions'}`);
  return lines;
}

/** Why a member doesn't meet the member-level conditions of a rule, or null. The first condition they miss is the one reported. */
export function checkMemberRule(rule: MemberRule | undefined, facts: MemberFacts, scope: EligibilityScope): string | null {
  if (facts.status !== 'active') return `Only active members can ${verb(scope)}.`;
  if (!rule) return null;
  for (const key of Object.keys(MEMBER_CONDITIONS) as (keyof MemberRule)[]) {
    const config = rule[key];
    if (config === undefined) continue;
    const reason = (MEMBER_CONDITIONS[key] as Condition<unknown>).check(config, facts, scope);
    if (reason) return reason;
  }
  return null;
}

export interface EligibilityContext {
  rules: EligibilityRules | null;
  facts: MemberFacts;
  /** The committee's exception for this member and scope, if any. */
  exception?: ExceptionKind | null;
  /** For candidates: how many positions of this election they already stand for (not counting one being added now). */
  currentCandidacies?: number;
  /** For candidates: the committee's VOTE exception for this member, if any, since a candidate must be allowed to vote. */
  voteException?: ExceptionKind | null;
}

export interface Eligibility {
  eligible: boolean;
  /** In plain words, for the person turned away. Null when eligible. */
  reason: string | null;
  /** The code the apps can react to. */
  code: 'OK' | 'NOT_ACTIVE' | 'RULE_NOT_MET' | 'BARRED' | 'MAX_POSITIONS';
}

const OK: Eligibility = { eligible: true, reason: null, code: 'OK' };

/** Whether one member may vote, or stand, in an election. An active member is always required; exceptions come before the rules. */
export function evaluateEligibility(scope: EligibilityScope, ctx: EligibilityContext): Eligibility {
  const { rules, facts, exception } = ctx;

  if (facts.status !== 'active') return { eligible: false, reason: `Only active members can ${verb(scope)}.`, code: 'NOT_ACTIVE' };
  if (exception === 'BAR') return { eligible: false, reason: `The Election Committee has not allowed you to ${verb(scope)} in this election.`, code: 'BARRED' };
  if (exception === 'ALLOW') return OK;

  const rule = scope === 'VOTE' ? rules?.voters : rules?.candidates;
  const reason = checkMemberRule(rule, facts, scope);
  if (reason) return { eligible: false, reason, code: 'RULE_NOT_MET' };

  if (scope === 'STAND') {
    const candidateRule = rules?.candidates;
    if (candidateRule?.mustBeVoter) {
      const voting = evaluateEligibility('VOTE', { rules, facts, exception: ctx.voteException });
      if (!voting.eligible) return { eligible: false, reason: `To stand, you also need to be allowed to vote. ${voting.reason}`, code: voting.code };
    }
    if (candidateRule?.maxPositions && (ctx.currentCandidacies ?? 0) >= candidateRule.maxPositions) {
      return {
        eligible: false,
        reason: `You already stand for ${ctx.currentCandidacies} ${ctx.currentCandidacies === 1 ? 'position' : 'positions'}, which is the most one person can in this election.`,
        code: 'MAX_POSITIONS',
      };
    }
  }

  return OK;
}

/** Whether an election has any rule at all. With none, the old fast path applies and nothing extra is looked up. */
export function hasRules(rules: EligibilityRules | null | undefined): boolean {
  return !!rules && (!!rules.voters || !!rules.candidates);
}

/** Whether the rules need what a member owes (a ledger look-up), so it is only fetched when asked for. */
export function needsFinancials(rules: EligibilityRules | null | undefined): boolean {
  return !!rules?.voters?.financialStanding || !!rules?.candidates?.financialStanding;
}
