/**
 * Recorded consent (T3.2, T3.6): a member accepting the group's rules, and a guarantor agreeing to be named.
 *
 * Many Ajo contributors have no app login, so an acceptance can come from two places, and both count equally for joining:
 *   - the member themselves (`channel: 'app'`), or
 *   - an officer on their behalf (`channel: 'officer'`), who must say how it was given ("read aloud, agreed in person"). The note is
 *     required, is audited, and the channel is always visible, so a group can see how many acceptances were secondhand.
 * An officer cannot record an acceptance for themselves. A guarantor never has a login, so their consent is only ever officer-recorded.
 *
 * A guarantor record is a recorded consent only. SocietyLedger does not create, hold or enforce a legal guarantee.
 */
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { normalizePhone } from '../sms/sms-rules';
import { ActivationOutcome, notifyActivated, tryActivate } from './ajo-membership.service';
import { currentRuleVersion, describeRules } from './ajo-rules.service';
import { auditAjo } from './ajo-support';

export const MIN_NOTE_LENGTH = 5;

export type ConsentChannel = 'app' | 'officer';

function requireNote(note: string | undefined): string {
  const text = (note ?? '').trim();
  if (text.length < MIN_NOTE_LENGTH) {
    throw new RuleError('Say how this was given (for example "read aloud, agreed in person"), so the record shows where it came from.', 400, 'NOTE_REQUIRED');
  }
  return text.slice(0, 300);
}

export interface AcceptRulesInput {
  associationId: number;
  membershipId: number;
  /** The signed-in user doing it. */
  actorUserId: number;
  /** True when the caller is an officer with `ajo.manage` (checked by the route). */
  actorIsOfficer: boolean;
  /** Defaults to the newest version, including one that has not taken effect yet. */
  ruleVersionId?: number;
  note?: string;
  /** Where the request came from, for the evidence (for example "mobile"). */
  device?: string;
  now?: Date;
}

export interface AcceptRulesResult {
  acceptanceId: number;
  ruleVersion: number;
  channel: ConsentChannel;
  replayed: boolean;
  activation: ActivationOutcome;
}

/** Record that a member accepted a version of their group's rules, then try to activate them. Accepting the same version twice changes nothing. */
export async function acceptRules(input: AcceptRulesInput): Promise<AcceptRulesResult> {
  const now = input.now ?? new Date();
  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, include: { member: { select: { userId: true } } } });
    if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
    if (membership.status !== 'PENDING' && membership.status !== 'ACTIVE') throw new RuleError(`A ${membership.status.toLowerCase()} membership cannot accept rules.`, 409, 'INVALID_MEMBERSHIP_STATE');

    const own = membership.member.userId !== null && membership.member.userId === input.actorUserId;
    if (!own && !input.actorIsOfficer) throw new RuleError('Only the member, or an officer recording it for them, can accept the rules.', 403, 'FORBIDDEN');
    const channel: ConsentChannel = own ? 'app' : 'officer';
    const note = channel === 'officer' ? requireNote(input.note) : undefined;

    const version = input.ruleVersionId
      ? await tx.ajoGroupRuleVersion.findFirst({ where: { id: input.ruleVersionId, groupId: membership.groupId } })
      : await tx.ajoGroupRuleVersion.findFirst({ where: { groupId: membership.groupId }, orderBy: { version: 'desc' } });
    if (!version) throw new RuleError('This circle has no rules to accept.', 404, 'RULES_NOT_FOUND');

    const existing = await tx.ajoRuleAcceptance.findUnique({ where: { membershipId_ruleVersionId: { membershipId: membership.id, ruleVersionId: version.id } } });
    if (existing) {
      const activation = await tryActivate(tx, { associationId: input.associationId, membershipId: membership.id, actorUserId: input.actorUserId, now });
      return { acceptanceId: existing.id, ruleVersion: version.version, channel: ((existing.evidence as { channel?: ConsentChannel } | null)?.channel ?? channel) as ConsentChannel, replayed: true, activation };
    }

    const acceptance = await tx.ajoRuleAcceptance.create({
      data: {
        associationId: input.associationId,
        membershipId: membership.id,
        ruleVersionId: version.id,
        acceptedAt: now,
        evidence: { channel, ...(channel === 'officer' ? { recordedBy: input.actorUserId, note } : {}), ...(input.device ? { device: input.device } : {}) },
      },
    });
    // Keep the shortcut on the membership pointing at the newest version accepted.
    const current = membership.acceptedRuleVersionId
      ? await tx.ajoGroupRuleVersion.findUnique({ where: { id: membership.acceptedRuleVersionId }, select: { version: true } })
      : null;
    if (!current || current.version < version.version) await tx.ajoMembership.update({ where: { id: membership.id }, data: { acceptedRuleVersionId: version.id } });

    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_RULES_ACCEPTED', tableName: 'ajo_rule_acceptances', recordId: acceptance.id, newValues: { membershipId: membership.id, version: version.version, channel, ...(note ? { note } : {}) } });
    const activation = await tryActivate(tx, { associationId: input.associationId, membershipId: membership.id, actorUserId: input.actorUserId, now });
    return { acceptanceId: acceptance.id, ruleVersion: version.version, channel, replayed: false, activation };
  });

  if (result.activation.activated) await notifyActivated(input.associationId, input.membershipId);
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Guarantor
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * The exact words the guarantor agrees to. Built here, not typed by the officer, so every guarantee in every group says the same thing, and
 * stored as shown. It is a recorded consent only and says so.
 */
export function guarantorWording(input: { guarantorName: string; memberName: string; groupName: string }): string {
  return (
    `I, ${input.guarantorName}, know ${input.memberName} and agree to be named as their guarantor in ${input.groupName}. ` +
    `I understand that this is only a record that I agreed to be named. It is not a legal guarantee, SocietyLedger does not collect any money from me, ` +
    `and I have not been asked to pay anything.`
  );
}

export interface GuarantorInput {
  associationId: number;
  membershipId: number;
  actorUserId: number;
  name: string;
  phone: string;
  relationship: string;
  /** How the consent was given, for the record. */
  note: string;
  now?: Date;
}

/** An officer records that a guarantor agreed. Replaces an earlier agreement (which stays on file). Then tries to activate the member. */
export async function recordGuarantorConsent(input: GuarantorInput) {
  const now = input.now ?? new Date();
  const name = input.name.trim();
  const relationship = input.relationship.trim();
  if (name.length < 2 || name.length > 120) throw new RuleError("Enter the guarantor's full name.", 400, 'INVALID_GUARANTOR');
  if (relationship.length < 2 || relationship.length > 80) throw new RuleError('Say how the guarantor knows the member (for example "aunt" or "market neighbour").', 400, 'INVALID_GUARANTOR');
  const phone = normalizePhone(input.phone);
  if (!phone) throw new RuleError("Enter a valid phone number for the guarantor.", 400, 'INVALID_GUARANTOR');
  const note = requireNote(input.note);

  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.ajoMembership.findFirst({
      where: { id: input.membershipId, associationId: input.associationId },
      include: { member: { select: { firstName: true, lastName: true, phone: true } }, group: { select: { name: true } } },
    });
    if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
    if (membership.status !== 'PENDING' && membership.status !== 'ACTIVE') throw new RuleError(`A ${membership.status.toLowerCase()} membership cannot have a guarantor recorded.`, 409, 'INVALID_MEMBERSHIP_STATE');
    if (normalizePhone(membership.member.phone) === phone) throw new RuleError('The guarantor must be a different person from the member (the phone number is the same).', 400, 'GUARANTOR_IS_MEMBER');

    const version = await currentRuleVersion(tx, membership.groupId, now);
    if (version?.guarantorPolicy === 'NOT_REQUIRED') throw new RuleError('This circle does not use guarantors.', 409, 'GUARANTOR_NOT_USED');

    const memberName = `${membership.member.firstName} ${membership.member.lastName}`.trim();
    const wording = guarantorWording({ guarantorName: name, memberName, groupName: membership.group.name });
    const agreement = await tx.ajoGuarantorAgreement.create({
      data: { associationId: input.associationId, name, phone, relationship, wording, acceptedAt: now, recordedBy: input.actorUserId, evidence: { channel: 'officer', note } },
    });
    await tx.ajoMembership.update({ where: { id: membership.id }, data: { guarantorAgreementId: agreement.id } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_GUARANTOR_RECORDED', tableName: 'ajo_guarantor_agreements', recordId: agreement.id, oldValues: membership.guarantorAgreementId ? { replacedAgreementId: membership.guarantorAgreementId } : null, newValues: { membershipId: membership.id, relationship, note } });
    const activation = await tryActivate(tx, { associationId: input.associationId, membershipId: membership.id, actorUserId: input.actorUserId, now });
    return { agreementId: agreement.id, wording, activation };
  });

  if (result.activation.activated) await notifyActivated(input.associationId, input.membershipId);
  return result;
}

/** What a guarantor would be shown, for an officer to read out. Not stored until consent is recorded. */
export async function previewGuarantorWording(input: { associationId: number; membershipId: number; guarantorName: string }) {
  const membership = await prisma.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, include: { member: { select: { firstName: true, lastName: true } }, group: { select: { name: true } } } });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  return guarantorWording({ guarantorName: input.guarantorName.trim() || 'the guarantor', memberName: `${membership.member.firstName} ${membership.member.lastName}`.trim(), groupName: membership.group.name });
}

/** The rules as plain sentences, for the accept screen. */
export async function rulesToAccept(db: typeof prisma, input: { associationId: number; membershipId: number }) {
  const membership = await db.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, select: { groupId: true } });
  if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
  const latest = await db.ajoGroupRuleVersion.findFirst({ where: { groupId: membership.groupId }, orderBy: { version: 'desc' } });
  if (!latest) return null;
  const rules = { lateFeeType: latest.lateFeeType as 'NONE' | 'FIXED' | 'PERCENT', lateFeeValue: latest.lateFeeValue, lateFeeCapKobo: latest.lateFeeCapKobo, graceDays: latest.graceDays, guarantorPolicy: latest.guarantorPolicy as 'NOT_REQUIRED' | 'OPTIONAL' | 'REQUIRED', defaultProcedure: latest.defaultProcedure as 'NOTIFY_ADMIN' | 'REPAYMENT_PLAN' | 'CASE_AND_PLAN', remindersEnabled: latest.remindersEnabled, blockAtRiskEarly: latest.blockAtRiskEarly, memberVisibility: latest.memberVisibility as 'FULL' | 'OFF', nameDisplay: latest.nameDisplay as 'FIRST_INITIAL' | 'FULL' };
  return { ruleVersionId: latest.id, version: latest.version, effectiveFrom: latest.effectiveFrom, summary: describeRules(rules) };
}
