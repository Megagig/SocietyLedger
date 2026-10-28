/**
 * Group rules (T3.2): versioned, never edited, and binding on a member only once they have accepted the version.
 *
 * A change is a new version that takes effect at least RULE_NOTICE_DAYS days after it is published, and every active member is told. A
 * member is bound by the latest version THEY accepted (`ruleVersionInForce`), so nobody is charged a fee they never agreed to. Not
 * accepting never stops anyone contributing: it only means the old terms keep applying to them. A newcomer joins on the version that is
 * current when they join (`currentRuleVersion`).
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { auditAjo, notifyUser } from './ajo-support';

type Db = Prisma.TransactionClient | typeof prisma;
type Tx = Prisma.TransactionClient;

export const RULE_NOTICE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const GUARANTOR_POLICIES = ['NOT_REQUIRED', 'OPTIONAL', 'REQUIRED'] as const;
export const DEFAULT_PROCEDURES = ['NOTIFY_ADMIN', 'REPAYMENT_PLAN', 'CASE_AND_PLAN'] as const;
export type GuarantorPolicy = (typeof GUARANTOR_POLICIES)[number];
export type DefaultProcedure = (typeof DEFAULT_PROCEDURES)[number];

/** The rules as a person types them. Money is kobo; a percentage is in basis points (100 = 1%). */
export interface RuleInput {
  lateFeeType?: 'NONE' | 'FIXED' | 'PERCENT';
  lateFeeValue?: number | bigint;
  lateFeeCapKobo?: number | bigint | null;
  graceDays?: number;
  guarantorPolicy?: GuarantorPolicy;
  defaultProcedure?: DefaultProcedure;
  remindersEnabled?: boolean;
  blockAtRiskEarly?: boolean;
}

export interface Rules {
  lateFeeType: 'NONE' | 'FIXED' | 'PERCENT';
  lateFeeValue: bigint;
  lateFeeCapKobo: bigint | null;
  graceDays: number;
  guarantorPolicy: GuarantorPolicy;
  defaultProcedure: DefaultProcedure;
  remindersEnabled: boolean;
  blockAtRiskEarly: boolean;
}

/** The safe defaults from the spec: late fees off, three grace days, reminders on, guarantor optional, case and plan on default. */
export const DEFAULT_RULES: Rules = {
  lateFeeType: 'NONE',
  lateFeeValue: 0n,
  lateFeeCapKobo: null,
  graceDays: 3,
  guarantorPolicy: 'OPTIONAL',
  defaultProcedure: 'CASE_AND_PLAN',
  remindersEnabled: true,
  blockAtRiskEarly: false,
};

const bad = (message: string, code = 'INVALID_RULES') => new RuleError(message, 400, code);

function wholeNonNegative(value: number | bigint, label: string): bigint {
  const n = typeof value === 'bigint' ? value : Number.isInteger(value) ? BigInt(value) : null;
  if (n === null || n < 0n) throw bad(`${label} must be a whole number that is not negative.`);
  return n;
}

/** Fill in defaults and check every rule. Throws a RuleError a person can read; returns the normalised rules. */
export function normaliseRules(input: RuleInput = {}, base: Rules = DEFAULT_RULES): Rules {
  const lateFeeType = input.lateFeeType ?? base.lateFeeType;
  if (!['NONE', 'FIXED', 'PERCENT'].includes(lateFeeType)) throw bad('A late fee is none, a fixed amount or a percentage.');

  let lateFeeValue = input.lateFeeValue === undefined ? base.lateFeeValue : wholeNonNegative(input.lateFeeValue, 'The late fee');
  let lateFeeCapKobo = input.lateFeeCapKobo === undefined ? base.lateFeeCapKobo : input.lateFeeCapKobo === null ? null : wholeNonNegative(input.lateFeeCapKobo, 'The late fee cap');

  if (lateFeeType === 'NONE') {
    lateFeeValue = 0n;
    lateFeeCapKobo = null;
  } else {
    if (lateFeeValue <= 0n) throw bad('Give the late fee an amount, or choose no late fee.');
    if (lateFeeType === 'PERCENT' && lateFeeValue > 10_000n) throw bad('A percentage late fee cannot be more than 100%.');
    if (lateFeeCapKobo !== null && lateFeeCapKobo <= 0n) throw bad('The late fee cap must be more than zero, or left empty for no cap.');
  }

  const graceDays = input.graceDays ?? base.graceDays;
  if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 30) throw bad('The grace period is between 0 and 30 days.');

  const guarantorPolicy = input.guarantorPolicy ?? base.guarantorPolicy;
  if (!GUARANTOR_POLICIES.includes(guarantorPolicy)) throw bad('A guarantor is not required, optional or required.');
  const defaultProcedure = input.defaultProcedure ?? base.defaultProcedure;
  if (!DEFAULT_PROCEDURES.includes(defaultProcedure)) throw bad('Choose how a default is handled.');

  return { lateFeeType, lateFeeValue, lateFeeCapKobo, graceDays, guarantorPolicy, defaultProcedure, remindersEnabled: input.remindersEnabled ?? base.remindersEnabled, blockAtRiskEarly: input.blockAtRiskEarly ?? base.blockAtRiskEarly };
}

export function sameRules(a: Rules, b: Rules): boolean {
  return a.lateFeeType === b.lateFeeType && a.lateFeeValue === b.lateFeeValue && a.lateFeeCapKobo === b.lateFeeCapKobo && a.graceDays === b.graceDays && a.guarantorPolicy === b.guarantorPolicy && a.defaultProcedure === b.defaultProcedure && a.remindersEnabled === b.remindersEnabled && a.blockAtRiskEarly === b.blockAtRiskEarly;
}

function rulesOf(row: { lateFeeType: string; lateFeeValue: bigint; lateFeeCapKobo: bigint | null; graceDays: number; guarantorPolicy: string; defaultProcedure: string; remindersEnabled: boolean; blockAtRiskEarly: boolean }): Rules {
  return { lateFeeType: row.lateFeeType as Rules['lateFeeType'], lateFeeValue: row.lateFeeValue, lateFeeCapKobo: row.lateFeeCapKobo, graceDays: row.graceDays, guarantorPolicy: row.guarantorPolicy as GuarantorPolicy, defaultProcedure: row.defaultProcedure as DefaultProcedure, remindersEnabled: row.remindersEnabled, blockAtRiskEarly: row.blockAtRiskEarly };
}

/** Plain-language lines for the screens and for the acceptance text. Money in full. */
export function describeRules(rules: Rules): string[] {
  const naira = (kobo: bigint) => `₦${(Number(kobo) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lines: string[] = [];
  if (rules.lateFeeType === 'NONE') lines.push('There is no late fee.');
  else {
    const fee = rules.lateFeeType === 'FIXED' ? naira(rules.lateFeeValue) : `${Number(rules.lateFeeValue) / 100}% of the contribution`;
    lines.push(`A late fee of ${fee} applies after the grace period${rules.lateFeeCapKobo ? `, up to ${naira(rules.lateFeeCapKobo)} for each missed contribution` : ''}.`);
  }
  lines.push(`The grace period is ${rules.graceDays} day${rules.graceDays === 1 ? '' : 's'} after the due date.`);
  lines.push({ NOT_REQUIRED: 'No guarantor is needed.', OPTIONAL: 'A guarantor is optional.', REQUIRED: 'A guarantor is required before you can join.' }[rules.guarantorPolicy]);
  lines.push({ NOTIFY_ADMIN: 'If someone stops paying after being paid, the admin is told.', REPAYMENT_PLAN: 'If someone stops paying after being paid, a repayment plan is offered.', CASE_AND_PLAN: 'If someone stops paying after being paid, the admin opens a case and a repayment plan is offered.' }[rules.defaultProcedure]);
  lines.push(rules.remindersEnabled ? 'Reminders are sent before and after each due date.' : 'No reminders are sent.');
  return lines;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------------------------------------------------------------

/** Version 1 of a new group. Takes effect at once: there is nobody to give notice to. Runs in the caller's transaction. */
export async function createInitialRuleVersion(tx: Tx, input: { associationId: number; groupId: number; rules: Rules; actorUserId: number; now: Date }) {
  return tx.ajoGroupRuleVersion.create({ data: { associationId: input.associationId, groupId: input.groupId, version: 1, ...input.rules, effectiveFrom: input.now, createdBy: input.actorUserId } });
}

/** The version a newcomer accepts: the newest one that has already taken effect. Null for a group that has no versions (older test data). */
export async function currentRuleVersion(db: Db, groupId: number, now: Date = new Date()) {
  return db.ajoGroupRuleVersion.findFirst({ where: { groupId, effectiveFrom: { lte: now } }, orderBy: { version: 'desc' } });
}

/** The version that binds a member: the newest one they have accepted. Fees, grace and defaults are worked out from this one. */
export async function ruleVersionInForce(db: Db, membershipId: number) {
  const accepted = await db.ajoRuleAcceptance.findFirst({ where: { membershipId }, orderBy: { ruleVersion: { version: 'desc' } }, include: { ruleVersion: true } });
  return accepted ? { acceptance: accepted, version: accepted.ruleVersion, rules: rulesOf(accepted.ruleVersion) } : null;
}

export async function listRuleVersions(db: Db, groupId: number) {
  const versions = await db.ajoGroupRuleVersion.findMany({ where: { groupId }, orderBy: { version: 'asc' } });
  return versions.map((v) => ({ id: v.id, version: v.version, effectiveFrom: v.effectiveFrom, createdAt: v.createdAt, rules: rulesOf(v), summary: describeRules(rulesOf(v)) }));
}

/**
 * How many of the group's live members have accepted the newest version. The admin screen shows "14 of 20 have accepted v3" so they can
 * chase the rest.
 */
export async function acceptanceStats(db: Db, groupId: number) {
  const latest = await db.ajoGroupRuleVersion.findFirst({ where: { groupId }, orderBy: { version: 'desc' } });
  if (!latest) return { latestVersion: null, accepted: 0, total: 0, pendingMembershipIds: [] as number[] };
  const live = await db.ajoMembership.findMany({ where: { groupId, status: { in: ['PENDING', 'ACTIVE'] } }, select: { id: true, acceptances: { where: { ruleVersion: { version: { gte: latest.version } } }, select: { id: true } } } });
  const pendingMembershipIds = live.filter((m) => m.acceptances.length === 0).map((m) => m.id);
  return { latestVersion: latest.version, accepted: live.length - pendingMembershipIds.length, total: live.length, pendingMembershipIds };
}

export interface PublishInput {
  associationId: number;
  groupId: number;
  actorUserId: number;
  rules: RuleInput;
  /** When it takes effect. Defaults to the earliest allowed; earlier than that is refused. */
  effectiveFrom?: Date;
  now?: Date;
}

/** Publish a new version. It starts from the latest version's rules, so a caller only sends what changes. */
export async function publishRuleVersion(input: PublishInput) {
  const now = input.now ?? new Date();
  const earliest = new Date(now.getTime() + RULE_NOTICE_DAYS * DAY_MS);
  const effectiveFrom = input.effectiveFrom ?? earliest;
  if (effectiveFrom.getTime() < earliest.getTime()) {
    throw new RuleError(`A rule change needs at least ${RULE_NOTICE_DAYS} days' notice, so members have time to read it. The earliest it can take effect is ${earliest.toISOString()}.`, 400, 'NOTICE_TOO_SHORT');
  }

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId }, select: { id: true, name: true, status: true } });
    if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
    if (group.status === 'COMPLETED' || group.status === 'CANCELLED') throw new RuleError('This group is closed, so its rules cannot change.', 409, 'GROUP_CLOSED');

    const latest = await tx.ajoGroupRuleVersion.findFirst({ where: { groupId: group.id }, orderBy: { version: 'desc' } });
    const rules = normaliseRules(input.rules, latest ? rulesOf(latest) : DEFAULT_RULES);
    if (latest && sameRules(rules, rulesOf(latest))) throw new RuleError('Nothing in these rules is different from the current version.', 409, 'RULES_UNCHANGED');
    if (latest && latest.effectiveFrom.getTime() > now.getTime()) {
      throw new RuleError('A rule change is already waiting to take effect. Wait for it, so members are never asked to follow two new versions at once.', 409, 'CHANGE_PENDING');
    }

    let created;
    try {
      created = await tx.ajoGroupRuleVersion.create({ data: { associationId: input.associationId, groupId: group.id, version: (latest?.version ?? 0) + 1, ...rules, effectiveFrom, createdBy: input.actorUserId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new RuleError('Someone just published a version. Reload and try again.', 409, 'VERSION_CONFLICT');
      throw error;
    }
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_RULES_PUBLISHED', tableName: 'ajo_group_rule_versions', recordId: created.id, oldValues: latest ? { version: latest.version } : null, newValues: { version: created.version, effectiveFrom: effectiveFrom.toISOString(), summary: describeRules(rules) } });

    const live = await tx.ajoMembership.findMany({ where: { groupId: group.id, status: { in: ['PENDING', 'ACTIVE'] } }, select: { member: { select: { userId: true } } } });
    return { created, groupName: group.name, userIds: live.map((m) => m.member.userId).filter((u): u is number => u !== null) };
  });

  // Best-effort, after the commit: the notice is a courtesy on top of the in-app list of versions to accept.
  for (const userId of result.userIds) {
    await notifyUser(input.associationId, userId, { pushType: 'ajo.rules_changed', entityId: result.created.id, title: 'New group rules', message: `${result.groupName} has new rules (version ${result.created.version}) from ${effectiveFrom.toISOString().slice(0, 10)}. Please read and accept them.` });
  }
  return { id: result.created.id, version: result.created.version, effectiveFrom };
}
