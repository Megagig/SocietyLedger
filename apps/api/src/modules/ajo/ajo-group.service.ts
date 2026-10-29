/**
 * Ajo group lifecycle (T3.1): create, edit, open, start and cancel, with the money fields locked once a group is running.
 *
 *   DRAFT      the admin is still setting it up; nobody can be added.
 *   OPEN       people are being added and approved. Money fields may still change (members are told).
 *   ACTIVE     started: the schedule exists and the money fields are locked. Only the safe fields can change.
 *   COMPLETED / CANCELLED   closed. History stays readable; nothing new can be recorded.
 *
 * Money amounts are kobo. In responses they are strings (a kobo amount can pass what a JSON number holds exactly), and the group's own bank
 * account is shown masked everywhere except `getGroupBankAccount`, which contributors need to pay into it.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { tryActivate } from './ajo-membership.service';
import { assertCurrentDraw, expectedSlots } from './ajo-order.service';
import { createInitialRuleVersion, currentRuleVersion, normaliseRules, type RuleInput } from './ajo-rules.service';
import { FREQUENCIES, MAX_INTERVAL_COUNT, dayInZone, describeCadence, groupDates, isValidCutoff, isValidTimeZone, type Frequency, type GroupModel, type IntervalUnit } from './ajo-schedule';
import { generateGroupSchedule } from './ajo-schedule.service';
import { decryptGroupAccountNumber, encryptGroupAccountNumber, lastFour, maskAccount, normaliseAccountNumber } from './ajo-secrets';
import { assertNoOverdueLevy, assessGroupLevy, voidUnbilledLevyForGroup } from './ajo-levy.service';
import { auditAjo, notifyUser } from './ajo-support';

type Tx = Prisma.TransactionClient;

export const MAX_CONTRIBUTION_KOBO = 1_000_000_000n; // ₦10,000,000.00 for one instalment
export const MIN_CANCEL_REASON = 10;

const bad = (message: string, code = 'INVALID_GROUP') => new RuleError(message, 400, code);

export interface GroupFields {
  name: string;
  model: GroupModel;
  frequency: Frequency;
  /** Only for CUSTOM (every N days, weeks or months); null for every other frequency. */
  intervalCount: number | null;
  intervalUnit: IntervalUnit | null;
  contributionKobo: bigint;
  startDate: Date;
  cycleLength: number | null;
  maxParticipants: number;
  collectorFeeType: 'NONE' | 'FIXED' | 'PERCENT' | 'DAYS';
  collectorFeeValue: bigint;
  timezone: string;
  cutoffTime: string;
  requirePhoneConfirm: boolean;
  maxSharesPerMember: number;
  allowLateJoin: boolean;
}

export interface BankInput {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

/** What a caller may send. Everything is optional on an update; a create needs the first few. */
export interface GroupPatch {
  name?: string;
  model?: GroupModel;
  frequency?: Frequency;
  intervalCount?: number | null;
  intervalUnit?: IntervalUnit | null;
  contributionKobo?: number | bigint | string;
  startDate?: string | Date;
  cycleLength?: number | null;
  maxParticipants?: number;
  collectorFeeType?: GroupFields['collectorFeeType'];
  collectorFeeValue?: number | bigint | string;
  timezone?: string;
  cutoffTime?: string;
  requirePhoneConfirm?: boolean;
  maxSharesPerMember?: number;
  allowLateJoin?: boolean;
}

/** Fields that change what people owe or when. Locked once the group has started. */
export const MONEY_FIELDS = ['model', 'frequency', 'intervalCount', 'intervalUnit', 'contributionKobo', 'startDate', 'cycleLength', 'collectorFeeType', 'collectorFeeValue', 'cutoffTime', 'timezone', 'requirePhoneConfirm', 'maxSharesPerMember'] as const;

function toKobo(value: number | bigint | string, label: string): bigint {
  try {
    const n = typeof value === 'bigint' ? value : typeof value === 'string' && /^[0-9]+$/.test(value.trim()) ? BigInt(value.trim()) : Number.isInteger(value) ? BigInt(value as number) : null;
    if (n === null) throw new Error();
    return n;
  } catch {
    throw bad(`${label} must be a whole number of kobo.`);
  }
}

function toDate(value: string | Date): Date {
  const d = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(d.getTime())) throw bad('Enter a valid start date.');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Merge a patch onto the current fields (or onto nothing, for a create) and check the whole result. Checking the merged result, not just
 * the patch, means a change to one field can never leave the group in a state the create would have refused.
 */
export function resolveGroupFields(base: GroupFields | null, patch: GroupPatch): GroupFields {
  const model = patch.model ?? base?.model;
  const frequency = patch.frequency ?? base?.frequency;
  if (!model || !['COLLECTOR_THRIFT', 'ROTATING_POT'].includes(model)) throw bad('Choose collector thrift or a rotating pot.');
  if (!frequency || !FREQUENCIES.includes(frequency)) throw bad('Choose how often people pay: daily, weekly, monthly, quarterly, annually, or your own.');
  // A custom schedule is "every N days, weeks or months"; every other frequency carries no step at all.
  let intervalCount: number | null = null;
  let intervalUnit: IntervalUnit | null = null;
  if (frequency === 'CUSTOM') {
    intervalCount = patch.intervalCount === undefined ? (base?.intervalCount ?? null) : patch.intervalCount;
    intervalUnit = patch.intervalUnit === undefined ? (base?.intervalUnit ?? null) : patch.intervalUnit;
    if (intervalCount === null || !Number.isInteger(intervalCount) || intervalCount < 1 || intervalCount > MAX_INTERVAL_COUNT) throw bad(`For your own schedule, say how many days, weeks or months between payments (1 to ${MAX_INTERVAL_COUNT}).`);
    if (!intervalUnit || !['DAYS', 'WEEKS', 'MONTHS'].includes(intervalUnit)) throw bad('For your own schedule, choose days, weeks or months.');
  }

  const name = (patch.name ?? base?.name ?? '').trim();
  if (name.length < 2 || name.length > 120) throw bad('Give the group a name of 2 to 120 characters.');

  const rawContribution = patch.contributionKobo ?? base?.contributionKobo;
  if (rawContribution === undefined) throw bad('Say how much each person contributes.');
  const contributionKobo = toKobo(rawContribution, 'The contribution');
  if (contributionKobo <= 0n) throw bad('The contribution must be more than zero.');
  if (contributionKobo > MAX_CONTRIBUTION_KOBO) throw bad('That contribution is more than the largest allowed (₦10,000,000.00).');

  const rawStart = patch.startDate ?? base?.startDate;
  if (rawStart === undefined) throw bad('Choose a start date.');
  const startDate = toDate(rawStart);

  const maxParticipants = patch.maxParticipants ?? base?.maxParticipants;
  if (maxParticipants === undefined || !Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 2000) throw bad('The number of participants must be between 1 and 2000.');

  let cycleLength: number | null;
  let maxSharesPerMember: number;
  if (model === 'COLLECTOR_THRIFT') {
    cycleLength = patch.cycleLength === undefined ? (base?.cycleLength ?? null) : patch.cycleLength;
    if (cycleLength === null || !Number.isInteger(cycleLength) || cycleLength < 1 || cycleLength > 400) throw bad('A collector-thrift cycle is between 1 and 400 periods.');
    maxSharesPerMember = 1;
  } else {
    cycleLength = null; // a rotating pot has as many rounds as shares, fixed when the group starts
    if (maxParticipants < 2) throw bad('A rotating pot needs room for at least 2 participants.');
    maxSharesPerMember = patch.maxSharesPerMember ?? base?.maxSharesPerMember ?? 2;
    if (!Number.isInteger(maxSharesPerMember) || maxSharesPerMember < 1 || maxSharesPerMember > 5) throw bad('One person can hold between 1 and 5 shares.');
  }

  const collectorFeeType = patch.collectorFeeType ?? base?.collectorFeeType ?? 'NONE';
  if (!['NONE', 'FIXED', 'PERCENT', 'DAYS'].includes(collectorFeeType)) throw bad('Choose how the collector is paid.');
  let collectorFeeValue = patch.collectorFeeValue === undefined ? (base?.collectorFeeValue ?? 0n) : toKobo(patch.collectorFeeValue, 'The collector fee');
  if (collectorFeeType === 'NONE') collectorFeeValue = 0n;
  else if (collectorFeeValue <= 0n) throw bad('Give the collector fee an amount, or choose no fee.');
  else if (collectorFeeType === 'PERCENT' && collectorFeeValue > 10_000n) throw bad('A percentage fee cannot be more than 100%.');
  else if (collectorFeeType === 'DAYS' && collectorFeeValue > 31n) throw bad('A fee of days of contribution is between 1 and 31 days.');

  const timezone = patch.timezone ?? base?.timezone ?? 'Africa/Lagos';
  if (!isValidTimeZone(timezone)) throw bad('That timezone is not recognised.');
  const cutoffTime = patch.cutoffTime ?? base?.cutoffTime ?? '18:00';
  if (!isValidCutoff(cutoffTime)) throw bad('The cutoff time must look like 18:00.');

  return { name, model, frequency, intervalCount, intervalUnit, contributionKobo, startDate, cycleLength, maxParticipants, collectorFeeType, collectorFeeValue, timezone, cutoffTime, requirePhoneConfirm: patch.requirePhoneConfirm ?? base?.requirePhoneConfirm ?? false, maxSharesPerMember, allowLateJoin: patch.allowLateJoin ?? base?.allowLateJoin ?? true };
}

/** Which of the locked fields would this change? Compares values, so sending the same value again is not a change. */
export function changedFields(before: GroupFields, after: GroupFields): Array<keyof GroupFields> {
  const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b);
  return (Object.keys(after) as Array<keyof GroupFields>).filter((k) => !same(before[k], after[k]));
}

export function validateBank(input: BankInput) {
  const bankName = input.bankName?.trim() ?? '';
  const accountName = input.accountName?.trim() ?? '';
  const accountNumber = normaliseAccountNumber(input.accountNumber);
  if (bankName.length < 2 || bankName.length > 80) throw bad("Enter the group's bank name.", 'INVALID_BANK_ACCOUNT');
  if (accountName.length < 2 || accountName.length > 120) throw bad('Enter the name on the account.', 'INVALID_BANK_ACCOUNT');
  if (!accountNumber) throw bad('A bank account number is exactly 10 digits.', 'INVALID_BANK_ACCOUNT');
  return { bankName, accountName, accountNumber };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------------------------------------------------------------

type GroupRow = Awaited<ReturnType<typeof prisma.ajoGroup.findFirstOrThrow>>;

/** A group as the API sends it: kobo as strings, and the bank account masked. */
export function toGroupView(g: GroupRow) {
  return {
    id: g.id,
    name: g.name,
    model: g.model,
    frequency: g.frequency,
    intervalCount: g.intervalCount,
    intervalUnit: g.intervalUnit,
    /** The cadence in plain words ("every 2 weeks"). */
    cadence: describeCadence(g.frequency, g),
    status: g.status,
    contributionKobo: g.contributionKobo.toString(),
    startDate: g.startDate,
    endsOn: g.endsOn,
    cycleLength: g.cycleLength,
    rounds: g.rounds,
    maxParticipants: g.maxParticipants,
    maxSharesPerMember: g.maxSharesPerMember,
    allowLateJoin: g.allowLateJoin,
    collectorFee: { type: g.collectorFeeType, value: g.collectorFeeValue.toString() },
    timezone: g.timezone,
    cutoffTime: g.cutoffTime,
    requirePhoneConfirm: g.requirePhoneConfirm,
    bankAccount: g.bankAccountLast4 ? { bankName: g.bankName, accountName: g.bankAccountName, masked: maskAccount(g.bankAccountLast4) } : null,
    startedAt: g.startedAt,
    cancelledAt: g.cancelledAt,
    cancelReason: g.cancelReason,
    createdAt: g.createdAt,
  };
}

const fieldsOf = (g: GroupRow): GroupFields => ({
  name: g.name,
  model: g.model,
  frequency: g.frequency,
  intervalCount: g.intervalCount,
  intervalUnit: g.intervalUnit,
  contributionKobo: g.contributionKobo,
  startDate: g.startDate,
  cycleLength: g.cycleLength,
  maxParticipants: g.maxParticipants,
  collectorFeeType: g.collectorFeeType,
  collectorFeeValue: g.collectorFeeValue,
  timezone: g.timezone,
  cutoffTime: g.cutoffTime,
  requirePhoneConfirm: g.requirePhoneConfirm,
  maxSharesPerMember: g.maxSharesPerMember,
  allowLateJoin: g.allowLateJoin,
});

async function lockGroup(tx: Tx, associationId: number, groupId: number): Promise<GroupRow> {
  // The lock makes two admins pressing "start" or editing at the same moment take turns.
  await tx.$queryRaw`SELECT id FROM ajo_groups WHERE id = ${groupId} AND association_id = ${associationId} FOR UPDATE`;
  const group = await tx.ajoGroup.findFirst({ where: { id: groupId, associationId } });
  // Another association's group is reported as missing, never as forbidden.
  if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  return group;
}

async function memberUserIds(db: Tx | typeof prisma, groupId: number): Promise<number[]> {
  const rows = await db.ajoMembership.findMany({ where: { groupId, status: { in: ['PENDING', 'ACTIVE'] } }, select: { member: { select: { userId: true } } } });
  return rows.map((r) => r.member.userId).filter((u): u is number => u !== null);
}

async function tellMembers(associationId: number, userIds: number[], notice: { pushType: string; entityId: number; title: string; message: string }) {
  for (const userId of userIds) await notifyUser(associationId, userId, notice);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Create, edit
// ---------------------------------------------------------------------------------------------------------------------------------

export interface CreateGroupInput {
  associationId: number;
  actorUserId: number;
  fields: GroupPatch;
  bank?: BankInput;
  rules?: RuleInput;
  now?: Date;
}

export async function createGroup(input: CreateGroupInput) {
  const now = input.now ?? new Date();
  const fields = resolveGroupFields(null, input.fields);
  if (fields.startDate.getTime() < dayInZone(now, fields.timezone).getTime()) throw bad('The start date cannot be in the past.', 'START_DATE_PASSED');
  const rules = normaliseRules(input.rules);
  const bank = input.bank ? validateBank(input.bank) : null;

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.ajoGroup.create({
      data: { associationId: input.associationId, ...fields, status: 'DRAFT', createdBy: input.actorUserId, ...(bank ? { bankName: bank.bankName, bankAccountName: bank.accountName } : {}) },
    });
    // The ciphertext is bound to the group's id, which only exists once the row does.
    const withBank = bank ? await tx.ajoGroup.update({ where: { id: created.id }, data: { bankAccountEnc: encryptGroupAccountNumber(created.id, bank.accountNumber), bankAccountLast4: lastFour(bank.accountNumber) } }) : created;
    await createInitialRuleVersion(tx, { associationId: input.associationId, groupId: created.id, rules, actorUserId: input.actorUserId, now });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_GROUP_CREATED', tableName: 'ajo_groups', recordId: created.id, newValues: { name: fields.name, model: fields.model, frequency: fields.frequency, contributionKobo: fields.contributionKobo.toString(), maxParticipants: fields.maxParticipants, bankAccount: bank ? maskAccount(lastFour(bank.accountNumber)) : null } });
    return withBank;
  });
  return toGroupView(group);
}

export interface UpdateGroupInput {
  associationId: number;
  groupId: number;
  actorUserId: number;
  fields?: GroupPatch;
  bank?: BankInput;
  now?: Date;
}

export async function updateGroup(input: UpdateGroupInput) {
  const now = input.now ?? new Date();
  const bank = input.bank ? validateBank(input.bank) : null;

  const outcome = await prisma.$transaction(async (tx) => {
    const group = await lockGroup(tx, input.associationId, input.groupId);
    if (group.status === 'COMPLETED' || group.status === 'CANCELLED') throw new RuleError('This group is closed, so it cannot be changed.', 409, 'GROUP_CLOSED');

    const before = fieldsOf(group);
    const after = resolveGroupFields(before, input.fields ?? {});
    const changed = changedFields(before, after);

    if (group.status === 'ACTIVE') {
      const locked = changed.filter((k) => (MONEY_FIELDS as readonly string[]).includes(k));
      if (locked.length) throw new RuleError(`This group has started, so these can no longer change: ${locked.join(', ')}.`, 409, 'GROUP_LOCKED');
      if (changed.includes('maxParticipants') && (group.model === 'ROTATING_POT' || after.maxParticipants < before.maxParticipants)) {
        throw new RuleError('Once a group has started, its number of places can only be raised, and not in a rotating pot.', 409, 'GROUP_LOCKED');
      }
    }
    if (changed.includes('maxParticipants')) {
      const taken = await tx.ajoMembership.count({ where: { groupId: group.id, status: { not: 'LEFT' } } });
      if (after.maxParticipants < taken) throw new RuleError(`This group already has ${taken} people, so it cannot have fewer than ${taken} places.`, 409, 'CAP_BELOW_MEMBERS');
    }
    if (changed.includes('startDate') && after.startDate.getTime() < dayInZone(now, after.timezone).getTime()) throw bad('The start date cannot be in the past.', 'START_DATE_PASSED');
    // A different model changes which instalments exist and who can hold shares, so people already added would be left in the wrong shape.
    if (changed.includes('model') && group.status !== 'DRAFT') throw new RuleError('The kind of group cannot change once people have been added. Create a new group instead.', 409, 'GROUP_LOCKED');
    if (changed.includes('maxSharesPerMember')) {
      const over = await tx.ajoMembership.count({ where: { groupId: group.id, status: { not: 'LEFT' }, shares: { gt: after.maxSharesPerMember } } });
      if (over) throw new RuleError('Some people already hold more shares than that.', 409, 'SHARES_ABOVE_LIMIT');
    }

    let bankChanged = false;
    const data: Prisma.AjoGroupUpdateInput = {};
    for (const k of changed) (data as Record<string, unknown>)[k] = after[k];
    if (bank) {
      const same = group.bankAccountEnc !== null && group.bankName === bank.bankName && group.bankAccountName === bank.accountName && lastFour(bank.accountNumber) === group.bankAccountLast4 && decryptGroupAccountNumber(group.id, group.bankAccountEnc) === bank.accountNumber;
      if (!same) {
        bankChanged = true;
        Object.assign(data, { bankName: bank.bankName, bankAccountName: bank.accountName, bankAccountEnc: encryptGroupAccountNumber(group.id, bank.accountNumber), bankAccountLast4: lastFour(bank.accountNumber) });
      }
    }
    if (!changed.length && !bankChanged) return { group, replayed: true, changed: [] as string[], moneyChanged: false, bankChanged: false };

    const updated = await tx.ajoGroup.update({ where: { id: group.id }, data });
    await auditAjo(tx, {
      associationId: input.associationId,
      userId: input.actorUserId,
      action: 'AJO_GROUP_UPDATED',
      tableName: 'ajo_groups',
      recordId: group.id,
      oldValues: { ...Object.fromEntries(changed.map((k) => [k, String(before[k])])), ...(bankChanged ? { bankAccount: group.bankAccountLast4 ? maskAccount(group.bankAccountLast4) : null } : {}) },
      newValues: { ...Object.fromEntries(changed.map((k) => [k, String(after[k])])), ...(bankChanged ? { bankAccount: maskAccount(lastFour(bank!.accountNumber)) } : {}) },
    });
    const userIds = group.status === 'DRAFT' ? [] : await memberUserIds(tx, group.id);
    const moneyChanged = changed.some((k) => (MONEY_FIELDS as readonly string[]).includes(k));
    return { group: updated, replayed: false, changed: changed as string[], moneyChanged, bankChanged, userIds };
  });

  // Members are told when the amount or schedule changes, and always when the account they pay into changes: that is how a payment gets redirected.
  if (!outcome.replayed && outcome.userIds?.length) {
    if (outcome.bankChanged) await tellMembers(input.associationId, outcome.userIds, { pushType: 'ajo.group_account_changed', entityId: outcome.group.id, title: 'Payment account changed', message: `${outcome.group.name} now collects into a different bank account. Check the details with your officer before you pay.` });
    if (outcome.moneyChanged) await tellMembers(input.associationId, outcome.userIds, { pushType: 'ajo.group_changed', entityId: outcome.group.id, title: 'Group terms changed', message: `The terms of ${outcome.group.name} were changed before it started. Please check them.` });
  }
  return { group: toGroupView(outcome.group), replayed: outcome.replayed, changed: outcome.changed };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Open, cancel, start
// ---------------------------------------------------------------------------------------------------------------------------------

/** DRAFT → OPEN. The group needs its bank account (where people pay) and a start date that has not passed. */
export async function openGroup(input: { associationId: number; groupId: number; actorUserId: number; now?: Date }) {
  const now = input.now ?? new Date();
  const group = await prisma.$transaction(async (tx) => {
    const g = await lockGroup(tx, input.associationId, input.groupId);
    if (g.status === 'OPEN') return g;
    if (g.status !== 'DRAFT') throw new RuleError(`A ${g.status.toLowerCase()} group cannot be opened.`, 409, 'INVALID_GROUP_STATE');
    if (!g.bankAccountEnc) throw new RuleError("Add the group's bank account first: it is where contributors pay.", 409, 'BANK_ACCOUNT_REQUIRED');
    if (g.startDate.getTime() < dayInZone(now, g.timezone).getTime()) throw new RuleError('The start date has passed. Choose a new one.', 409, 'START_DATE_PASSED');
    if (!(await currentRuleVersion(tx, g.id, now))) throw new RuleError('The group has no rules yet.', 409, 'RULES_NOT_FOUND');
    const opened = await tx.ajoGroup.update({ where: { id: g.id }, data: { status: 'OPEN' } });
    // People staged while the group was a draft, who already met every requirement, become active now.
    const waiting = await tx.ajoMembership.findMany({ where: { groupId: g.id, status: 'PENDING', approvedAt: { not: null } }, select: { id: true }, orderBy: { id: 'asc' } });
    for (const m of waiting) await tryActivate(tx, { associationId: input.associationId, membershipId: m.id, actorUserId: input.actorUserId, now });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_GROUP_OPENED', tableName: 'ajo_groups', recordId: g.id, oldValues: { status: 'DRAFT' }, newValues: { status: 'OPEN' } });
    return opened;
  });
  return toGroupView(group);
}

/** Stop a group that has not finished. Refused while confirmed money is on its books: that is reversed or paid out first, never hidden. */
export async function cancelGroup(input: { associationId: number; groupId: number; actorUserId: number; reason: string; now?: Date }) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_CANCEL_REASON) throw new RuleError(`Give a reason of at least ${MIN_CANCEL_REASON} characters, so the members and the audit trail know why.`, 400, 'REASON_REQUIRED');
  const now = input.now ?? new Date();

  const result = await prisma.$transaction(async (tx) => {
    const g = await lockGroup(tx, input.associationId, input.groupId);
    if (g.status === 'CANCELLED') return { group: g, replayed: true, userIds: [] as number[] };
    if (g.status === 'COMPLETED') throw new RuleError('A completed group cannot be cancelled.', 409, 'INVALID_GROUP_STATE');
    const money = await tx.ajoContribution.count({ where: { groupId: g.id, status: { in: ['CASH_RECEIVED', 'CONFIRMED'] }, reversedBy: null, reversalOfId: null } });
    if (money > 0) throw new RuleError('This group has contributions on its books. Reverse them, or complete the payouts, before cancelling.', 409, 'GROUP_HAS_MONEY');
    const userIds = await memberUserIds(tx, g.id);
    const cancelled = await tx.ajoGroup.update({ where: { id: g.id }, data: { status: 'CANCELLED', cancelledAt: now, cancelReason: reason } });
    // No money was confirmed, so SocietyLedger's levy on the group is not owed.
    await voidUnbilledLevyForGroup(tx, { groupId: g.id, reason: 'The group was cancelled before any money was confirmed.', actorUserId: input.actorUserId, now });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_GROUP_CANCELLED', tableName: 'ajo_groups', recordId: g.id, oldValues: { status: g.status }, newValues: { status: 'CANCELLED', reason } });
    return { group: cancelled, replayed: false, userIds };
  });
  if (!result.replayed) await tellMembers(input.associationId, result.userIds, { pushType: 'ajo.group_cancelled', entityId: result.group.id, title: 'Group cancelled', message: `${result.group.name} was cancelled: ${reason}` });
  return { group: toGroupView(result.group), replayed: result.replayed };
}

export interface StartGroupInput {
  associationId: number;
  groupId: number;
  actorUserId: number;
  /** A rotating pot with fewer people than places is shrunk to the people it has; the admin must say they know. */
  confirmSmallerGroup?: boolean;
  now?: Date;
}

/**
 * OPEN → ACTIVE: freeze the money fields, fix the rounds (rotating pot), and generate everyone's schedule, all in one transaction.
 * A rotating pot also needs a draw that matches the current roster.
 */
export async function startGroup(input: StartGroupInput) {
  const now = input.now ?? new Date();
  const result = await prisma.$transaction(async (tx) => {
    const g = await lockGroup(tx, input.associationId, input.groupId);
    if (g.status === 'ACTIVE') return { group: g, replayed: true, userIds: [] as number[], installments: 0 };
    if (g.status !== 'OPEN') throw new RuleError(`Only an open group can be started. This one is ${g.status.toLowerCase()}.`, 409, 'INVALID_GROUP_STATE');
    if (g.startDate.getTime() < dayInZone(now, g.timezone).getTime()) throw new RuleError('The start date has passed. Change it before starting.', 409, 'START_DATE_PASSED');
    // Unpaid platform levy more than 60 days old stops a NEW group starting, and nothing else.
    await assertNoOverdueLevy(tx, input.associationId, now);

    const live = await tx.ajoMembership.findMany({ where: { groupId: g.id, status: { in: ['PENDING', 'ACTIVE'] } }, select: { id: true, status: true, shares: true } });
    const active = live.filter((m) => m.status === 'ACTIVE');
    const pending = live.filter((m) => m.status === 'PENDING');

    let rounds: number | null = null;
    let maxParticipants = g.maxParticipants;
    if (g.model === 'ROTATING_POT') {
      if (pending.length) throw new RuleError(`${pending.length} ${pending.length === 1 ? 'person is' : 'people are'} still waiting to be approved. Approve or remove them first: a rotating pot cannot take anyone once it starts.`, 409, 'PENDING_MEMBERS');
      const slots = expectedSlots(active);
      if (slots.length < 2) throw new RuleError('A rotating pot needs at least 2 shares to start.', 409, 'NOT_ENOUGH_PARTICIPANTS');
      await assertCurrentDraw(tx, g.id, slots);
      if (active.length < g.maxParticipants && !input.confirmSmallerGroup) {
        throw new RuleError(`This group has ${active.length} people for ${g.maxParticipants} places. Starting will fix it at ${active.length}. Confirm to go ahead.`, 409, 'CONFIRM_SMALLER_GROUP');
      }
      rounds = slots.length;
      maxParticipants = active.length;
    } else if (active.length < 1) {
      throw new RuleError('At least one approved, active contributor is needed to start.', 409, 'NOT_ENOUGH_PARTICIPANTS');
    }

    const { endsOn } = groupDates({ model: g.model, frequency: g.frequency, intervalCount: g.intervalCount, intervalUnit: g.intervalUnit, startDate: g.startDate, cycleLength: g.cycleLength, rounds });
    const started = await tx.ajoGroup.update({ where: { id: g.id }, data: { status: 'ACTIVE', startedAt: now, endsOn, rounds, maxParticipants } });
    const made = await generateGroupSchedule(tx, { groupId: g.id, now });
    const levy = await assessGroupLevy(tx, { associationId: input.associationId, groupId: g.id, now });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_GROUP_STARTED', tableName: 'ajo_groups', recordId: g.id, oldValues: { status: 'OPEN' }, newValues: { status: 'ACTIVE', endsOn: endsOn.toISOString().slice(0, 10), rounds, participants: active.length, installments: made.created, levyKobo: levy.totalKobo.toString(), levyExempt: levy.exempt } });
    return { group: started, replayed: false, userIds: await memberUserIds(tx, g.id), installments: made.created };
  });
  if (!result.replayed) await tellMembers(input.associationId, result.userIds, { pushType: 'ajo.group_started', entityId: result.group.id, title: 'Your group has started', message: `${result.group.name} starts on ${result.group.startDate.toISOString().slice(0, 10)}. Your schedule is ready.` });
  return { group: toGroupView(result.group), replayed: result.replayed, installments: result.installments };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------------------------------------------

/** Managers see every group in the association; anyone else sees only the groups they belong to. */
export async function listGroups(input: { associationId: number; userId: number; isManager: boolean }) {
  const where: Prisma.AjoGroupWhereInput = input.isManager
    ? { associationId: input.associationId }
    : { associationId: input.associationId, memberships: { some: { status: { not: 'LEFT' }, member: { userId: input.userId } } } };
  const groups = await prisma.ajoGroup.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { memberships: { where: { status: { not: 'LEFT' } } } } } } });
  return groups.map((g) => ({ ...toGroupView(g), seats: { taken: g._count.memberships, total: g.maxParticipants } }));
}

/** Can this person see the group? Managers always can; a member can see a group they are in. Anyone else gets "not found". */
export async function assertGroupVisible(input: { associationId: number; groupId: number; userId: number; isManager: boolean }) {
  const group = await prisma.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId } });
  if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  if (input.isManager) return group;
  const mine = await prisma.ajoMembership.findFirst({ where: { groupId: group.id, status: { not: 'LEFT' }, member: { userId: input.userId } }, select: { id: true } });
  if (!mine) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  return group;
}

export async function getGroupDetail(input: { associationId: number; groupId: number; userId: number; isManager: boolean }) {
  const group = await assertGroupVisible(input);
  const [seats, active, rules] = await Promise.all([
    prisma.ajoMembership.count({ where: { groupId: group.id, status: { not: 'LEFT' } } }),
    prisma.ajoMembership.count({ where: { groupId: group.id, status: 'ACTIVE' } }),
    currentRuleVersion(prisma, group.id),
  ]);
  return { ...toGroupView(group), seats: { taken: seats, total: group.maxParticipants }, activeParticipants: active, currentRuleVersion: rules?.version ?? null };
}

/**
 * The group's full account number, for the people who must pay into it: its members and officers. Never cached. Everywhere else
 * (lists, audit entries, notifications, staff screens) only the masked form appears.
 */
export async function getGroupBankAccount(input: { associationId: number; groupId: number; userId: number; isManager: boolean }) {
  const group = await assertGroupVisible(input);
  if (!group.bankAccountEnc) throw new RuleError("This group has not added its bank account yet.", 404, 'BANK_ACCOUNT_REQUIRED');
  return { bankName: group.bankName, accountName: group.bankAccountName, accountNumber: decryptGroupAccountNumber(group.id, group.bankAccountEnc), masked: maskAccount(group.bankAccountLast4) };
}
