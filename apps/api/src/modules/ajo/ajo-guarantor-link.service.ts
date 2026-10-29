/**
 * A guarantor accepts for themselves (THM6). An officer creates a one-time link for a named guarantor; the guarantor opens it, reads
 * exactly the wording that is recorded, and accepts. No account is needed, so the link is the only proof of who they are: it is long and
 * random, only a hash of it is stored, it expires after seven days, it works once, and a newer link for the same person replaces it.
 *
 * Accepting records the same agreement an officer would have recorded by hand (a guarantor is a record of consent only; nothing is ever
 * taken from them), with `channel: 'link'` as its evidence, then tries to activate the member.
 */
import { createHash, randomBytes } from 'crypto';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { normalizePhone } from '../sms/sms-rules';
import { guarantorWording } from './ajo-consent.service';
import { notifyActivated, tryActivate } from './ajo-membership.service';
import { currentRuleVersion } from './ajo-rules.service';
import { auditAjo, notifyUser } from './ajo-support';

export const GUARANTOR_LINK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface GuarantorLinkInput {
  associationId: number;
  membershipId: number;
  actorUserId: number;
  name: string;
  phone: string;
  relationship: string;
  now?: Date;
}

/** An officer creates the link. The token is returned once and cannot be read back, so lose it and a new link is made. */
export async function createGuarantorLink(input: GuarantorLinkInput) {
  const now = input.now ?? new Date();
  const name = input.name.trim();
  const relationship = input.relationship.trim();
  if (name.length < 2 || name.length > 120) throw new RuleError("Enter the guarantor's full name.", 400, 'INVALID_GUARANTOR');
  if (relationship.length < 2 || relationship.length > 80) throw new RuleError('Say how the guarantor knows the member (for example "aunt" or "market neighbour").', 400, 'INVALID_GUARANTOR');
  const phone = normalizePhone(input.phone);
  if (!phone) throw new RuleError("Enter a valid phone number for the guarantor.", 400, 'INVALID_GUARANTOR');

  return prisma.$transaction(async (tx) => {
    const membership = await tx.ajoMembership.findFirst({ where: { id: input.membershipId, associationId: input.associationId }, include: { member: { select: { firstName: true, lastName: true, phone: true } }, group: { select: { name: true } } } });
    if (!membership) throw new RuleError('That membership was not found.', 404, 'MEMBERSHIP_NOT_FOUND');
    if (membership.status !== 'PENDING' && membership.status !== 'ACTIVE') throw new RuleError(`A ${membership.status.toLowerCase()} membership cannot have a guarantor.`, 409, 'INVALID_MEMBERSHIP_STATE');
    if (normalizePhone(membership.member.phone) === phone) throw new RuleError('The guarantor must be a different person from the member (the phone number is the same).', 400, 'GUARANTOR_IS_MEMBER');
    const version = await currentRuleVersion(tx, membership.groupId, now);
    if (version?.guarantorPolicy === 'NOT_REQUIRED') throw new RuleError('This group does not use guarantors.', 409, 'GUARANTOR_NOT_USED');

    // Only the newest link works: an older one for the same person is put away.
    await tx.ajoGuarantorInvite.updateMany({ where: { membershipId: membership.id, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + GUARANTOR_LINK_DAYS * DAY_MS);
    const invite = await tx.ajoGuarantorInvite.create({ data: { associationId: input.associationId, membershipId: membership.id, name, phone, relationship, tokenHash: hashToken(token), expiresAt, createdBy: input.actorUserId } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_GUARANTOR_LINK_CREATED', tableName: 'ajo_guarantor_invites', recordId: invite.id, newValues: { membershipId: membership.id, expiresAt: expiresAt.toISOString() } });
    return { token, expiresAt, inviteId: invite.id, wording: guarantorWording({ guarantorName: name, memberName: `${membership.member.firstName} ${membership.member.lastName}`.trim(), groupName: membership.group.name }) };
  });
}

type InviteState = 'OPEN' | 'EXPIRED' | 'USED' | 'REVOKED';
const stateOf = (i: { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date): InviteState => (i.usedAt ? 'USED' : i.revokedAt ? 'REVOKED' : i.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : 'OPEN');

const REFUSAL: Record<Exclude<InviteState, 'OPEN'>, RuleError> = {
  USED: new RuleError('This link has already been used. Thank you: your agreement is on record.', 409, 'LINK_USED'),
  REVOKED: new RuleError('This link was replaced by a newer one. Ask the group officer for the latest link.', 409, 'LINK_REPLACED'),
  EXPIRED: new RuleError('This link has expired. Ask the group officer to send you a new one.', 409, 'LINK_EXPIRED'),
};

async function loadOpen(token: string, now: Date) {
  const invite = await prisma.ajoGuarantorInvite.findUnique({ where: { tokenHash: hashToken(token || '') }, include: { membership: { include: { member: { select: { firstName: true, lastName: true } }, group: { select: { name: true } } } } } });
  // One answer for "no such link", so a guess tells nobody anything.
  if (!invite) throw new RuleError('This link is not valid. Check you opened the whole link, or ask the group officer for a new one.', 404, 'LINK_INVALID');
  const state = stateOf(invite, now);
  if (state !== 'OPEN') throw REFUSAL[state];
  return invite;
}

/** What the guarantor is shown: the wording, word for word as it will be recorded. Nothing about money or other members. */
export async function viewGuarantorLink(token: string, now: Date = new Date()) {
  const invite = await loadOpen(token, now);
  const memberName = `${invite.membership.member.firstName} ${invite.membership.member.lastName}`.trim();
  return { guarantorName: invite.name, relationship: invite.relationship, memberName, groupName: invite.membership.group.name, expiresAt: invite.expiresAt, wording: guarantorWording({ guarantorName: invite.name, memberName, groupName: invite.membership.group.name }) };
}

/** The guarantor says yes. Needs the explicit `agreed` flag, so a page load or a crawler can never record anything. */
export async function acceptGuarantorLink(input: { token: string; agreed: boolean; now?: Date }) {
  const now = input.now ?? new Date();
  if (input.agreed !== true) throw new RuleError('Tick the box to say you agree.', 400, 'AGREEMENT_REQUIRED');
  const found = await loadOpen(input.token, now);

  const result = await prisma.$transaction(async (tx) => {
    // The conditional update is what makes two taps at once record one agreement.
    const won = await tx.ajoGuarantorInvite.updateMany({ where: { id: found.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (won.count !== 1) throw REFUSAL.USED;
    const memberName = `${found.membership.member.firstName} ${found.membership.member.lastName}`.trim();
    const wording = guarantorWording({ guarantorName: found.name, memberName, groupName: found.membership.group.name });
    const agreement = await tx.ajoGuarantorAgreement.create({
      data: { associationId: found.associationId, name: found.name, phone: found.phone, relationship: found.relationship, wording, acceptedAt: now, recordedBy: found.createdBy, evidence: { channel: 'link', inviteId: found.id } },
    });
    await tx.ajoMembership.update({ where: { id: found.membershipId }, data: { guarantorAgreementId: agreement.id } });
    await auditAjo(tx, { associationId: found.associationId, userId: found.createdBy, action: 'AJO_GUARANTOR_ACCEPTED_BY_LINK', tableName: 'ajo_guarantor_agreements', recordId: agreement.id, newValues: { membershipId: found.membershipId, channel: 'link' } });
    const activation = await tryActivate(tx, { associationId: found.associationId, membershipId: found.membershipId, actorUserId: found.createdBy, now });
    return { agreementId: agreement.id, activated: activation.activated, memberName, groupName: found.membership.group.name };
  });

  if (result.activated) await notifyActivated(found.associationId, found.membershipId);
  await notifyUser(found.associationId, found.createdBy, { pushType: 'ajo.guarantor_accepted', entityId: found.membershipId, title: 'A guarantor agreed', message: `${found.name} accepted as guarantor for ${result.memberName} in ${result.groupName}.` });
  return { agreementId: result.agreementId, memberName: result.memberName, groupName: result.groupName };
}
