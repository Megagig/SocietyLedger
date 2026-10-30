/**
 * Adding a whole list of contributors at once (standalone thrift onboarding, step 3, and any officer setting up a circle).
 *
 * A brand-new group has no association members to pick from, so this creates the people as well as putting them in the circle: for each
 * row it finds the person by phone number (or creates them), adds them to the group, optionally records that the rules were explained
 * to them and agreed in person, and optionally gives the group's approval. Each person is handled on their own, so one bad row never
 * stops the rest, and the answer says what happened to every row.
 *
 * Doing the same list twice changes nothing: a person is matched by phone number, one already in the group is reported as such, and the
 * approval and rule acceptance are never recorded twice. Nobody can approve their own membership (the approval step refuses it).
 */
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { SettingsService } from '../settings/settings.service';
import { normalizePhone } from '../sms/sms-rules';
import { acceptRules } from './ajo-consent.service';
import { addMember, approveMembership } from './ajo-membership.service';
import { auditAjo } from './ajo-support';

export const MAX_BULK_ROWS = 200;
export const RULES_ON_BEHALF_NOTE = 'The group rules were explained and agreed in person while the group was being set up.';

export interface BulkRowInput {
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  address?: unknown;
  email?: unknown;
  shares?: unknown;
}

export interface CleanRow {
  firstName: string;
  lastName: string;
  phone: string;
  address: string | null;
  email: string | null;
  shares: number;
}

export type RowCheck = { ok: true; row: CleanRow } | { ok: false; message: string };

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pure: one typed or uploaded row, checked and tidied, or the reason in plain words. */
export function checkRow(raw: BulkRowInput, options: { rotating: boolean; maxShares: number }): RowCheck {
  const firstName = text(raw.firstName);
  const lastName = text(raw.lastName);
  if (!firstName || firstName.length > 60) return { ok: false, message: 'Enter a first name (up to 60 characters).' };
  if (!lastName || lastName.length > 60) return { ok: false, message: 'Enter a last name (up to 60 characters).' };
  const phone = text(raw.phone);
  if (!normalizePhone(phone)) return { ok: false, message: 'Enter a Nigerian phone number, for example 08031234567.' };
  const email = text(raw.email);
  if (email && !EMAIL.test(email)) return { ok: false, message: 'That email address does not look right.' };
  const address = text(raw.address);
  if (address.length > 200) return { ok: false, message: 'The address is too long (up to 200 characters).' };
  let shares = 1;
  if (options.rotating && text(raw.shares) !== '') {
    shares = Number(text(raw.shares));
    if (!Number.isInteger(shares) || shares < 1 || shares > options.maxShares) return { ok: false, message: `Shares must be a whole number from 1 to ${options.maxShares}.` };
  }
  return { ok: true, row: { firstName, lastName, phone, address: address || null, email: email || null, shares } };
}

export type RowStatus = 'added' | 'already_in_group' | 'invalid' | 'failed';
export interface RowResult {
  row: number;
  name: string;
  status: RowStatus;
  membershipId?: number;
  /** The person's member record, for sending them a login link afterwards. */
  memberId?: number;
  approved?: boolean;
  rulesRecorded?: boolean;
  /** True when the person is fully in (every requirement met). */
  active?: boolean;
  message?: string;
}

export interface BulkInput {
  associationId: number;
  groupId: number;
  actorUserId: number;
  items: BulkRowInput[];
  /** The officer knows these people and approves them for the group. */
  approve: boolean;
  /** The officer explained the rules and the people agreed in person. */
  acceptRulesOnBehalf: boolean;
}

const last10 = (phone: string): string => (normalizePhone(phone) ?? '').slice(-10);

async function nextMemberNumbers(associationId: number) {
  const prefix = (await SettingsService.getSetting(associationId, 'members_access', 'memberIdPrefix')) || 'MEM';
  let count = await prisma.member.count({ where: { associationId } });
  return async (): Promise<string> => {
    let memberId: string;
    do {
      count += 1;
      memberId = `${prefix}${String(count).padStart(4, '0')}`;
    } while (await prisma.member.findFirst({ where: { associationId, memberId }, select: { id: true } }));
    return memberId;
  };
}

/** The person already on file with this phone number in this association, if any. */
async function findByPhone(associationId: number, phone: string) {
  const tail = last10(phone);
  if (!tail) return null;
  const candidates = await prisma.member.findMany({ where: { associationId, phone: { contains: tail.slice(-9) } }, select: { id: true, phone: true, status: true }, take: 10 });
  return candidates.find((m) => last10(m.phone ?? '') === tail) ?? null;
}

export async function bulkAddContributors(input: BulkInput): Promise<{ results: RowResult[]; summary: { added: number; alreadyIn: number; approved: number; active: number; problems: number } }> {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new RuleError('Add at least one person.', 400, 'NO_ROWS');
  if (input.items.length > MAX_BULK_ROWS) throw new RuleError(`Add up to ${MAX_BULK_ROWS} people at a time.`, 400, 'TOO_MANY_ROWS');

  const group = await prisma.ajoGroup.findFirst({ where: { id: input.groupId, associationId: input.associationId }, select: { id: true, model: true, maxSharesPerMember: true, status: true } });
  if (!group) throw new RuleError('That circle was not found.', 404, 'GROUP_NOT_FOUND');

  const makeNumber = await nextMemberNumbers(input.associationId);
  const seenPhones = new Map<string, number>();
  const results: RowResult[] = [];

  for (let i = 0; i < input.items.length; i++) {
    const rowNo = i + 1;
    const raw = input.items[i] ?? {};
    const name = `${text(raw.firstName)} ${text(raw.lastName)}`.trim() || `Row ${rowNo}`;
    const checked = checkRow(raw, { rotating: group.model === 'ROTATING_POT', maxShares: group.maxSharesPerMember });
    if (!checked.ok) {
      results.push({ row: rowNo, name, status: 'invalid', message: checked.message });
      continue;
    }
    const { row } = checked;
    const key = last10(row.phone);
    const dup = seenPhones.get(key);
    if (dup !== undefined) {
      results.push({ row: rowNo, name, status: 'invalid', message: `This is the same phone number as row ${dup}.` });
      continue;
    }
    seenPhones.set(key, rowNo);

    try {
      let person = await findByPhone(input.associationId, row.phone);
      if (!person) {
        const created = await prisma.member.create({
          data: { associationId: input.associationId, memberId: await makeNumber(), firstName: row.firstName, lastName: row.lastName, phone: row.phone, address: row.address, email: row.email, status: 'active', joinDate: new Date() },
          select: { id: true, phone: true, status: true },
        });
        person = created;
      } else if (person.status !== 'active') {
        results.push({ row: rowNo, name, status: 'failed', message: 'This person is on file but is not an active member, so they cannot be added.' });
        continue;
      }

      let status: RowStatus = 'added';
      let membershipId: number;
      try {
        membershipId = (await addMember({ associationId: input.associationId, groupId: group.id, memberId: person.id, actorUserId: input.actorUserId, shares: row.shares, allowDraft: true })).id;
      } catch (error) {
        if (!(error instanceof RuleError) || error.code !== 'ALREADY_IN_GROUP') throw error;
        const existing = await prisma.ajoMembership.findFirst({ where: { groupId: group.id, memberId: person.id, status: { not: 'LEFT' } }, select: { id: true } });
        if (!existing) throw error;
        membershipId = existing.id;
        status = 'already_in_group';
      }

      let rulesRecorded = false;
      if (input.acceptRulesOnBehalf) {
        await acceptRules({ associationId: input.associationId, membershipId, actorUserId: input.actorUserId, actorIsOfficer: true, note: RULES_ON_BEHALF_NOTE });
        rulesRecorded = true;
      }

      let approved = false;
      let active = false;
      let message: string | undefined;
      if (input.approve) {
        const result = await approveMembership({ associationId: input.associationId, membershipId, actorUserId: input.actorUserId });
        approved = result.approvedAt !== null;
        active = result.activated || result.status === 'ACTIVE';
        if (result.blockedByLimit) message = result.blockedByLimit.message;
      }
      results.push({ row: rowNo, name, status, membershipId, memberId: person.id, approved, rulesRecorded, active, ...(message ? { message } : {}) });
    } catch (error) {
      results.push({ row: rowNo, name, status: 'failed', message: error instanceof RuleError ? error.message : 'This person could not be added. Please try again.' });
    }
  }

  const summary = {
    added: results.filter((r) => r.status === 'added').length,
    alreadyIn: results.filter((r) => r.status === 'already_in_group').length,
    approved: results.filter((r) => r.approved).length,
    active: results.filter((r) => r.active).length,
    problems: results.filter((r) => r.status === 'invalid' || r.status === 'failed' || (r.message && !r.active && input.approve)).length,
  };
  await prisma.$transaction((tx) => auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_BULK_MEMBERS_ADDED', tableName: 'ajo_groups', recordId: group.id, newValues: { rows: input.items.length, ...summary, approve: input.approve, rulesOnBehalf: input.acceptRulesOnBehalf } }));
  return { results, summary };
}
