/**
 * A member's payout account (T2.2): where the group pays them out of its own bank account.
 *
 * It is recorded, not verified by any service (SocietyLedger staff compare the account name with the person's name in step two). The
 * number is encrypted at rest and shown masked everywhere; the full number comes only from `revealAccountNumber`, which is audited.
 *
 * Changing the account is the moment a payout could be quietly redirected, so one transaction does all of: start the cool-off, void any
 * payout that was approved but not yet paid, send the person back to pending verification, and write the audit entry. The person and the
 * group's admins are then told. The first entry starts a cool-off too, because a fake account would be set up the same way.
 */
import prisma from '../../lib/prisma';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { RuleError } from '../finance/rule-error';
import { auditAjo, notifyPermissionHolders, notifyUser } from './ajo-support';
import { decryptAccountNumber, encryptAccountNumber, lastFour, maskAccount, normaliseAccountNumber } from './ajo-secrets';
import { resetVerificationForAccountChange } from './ajo-verification.service';

const HOUR_MS = 60 * 60 * 1000;

/** Pure: when the cool-off ends, or null when the platform has it switched off (0 hours). */
export function coolOffEnd(now: Date, hours: number): Date | null {
  return hours > 0 ? new Date(now.getTime() + hours * HOUR_MS) : null;
}

/** Pure: is the person still inside a cool-off? */
export function isInCoolOff(coolOffUntil: Date | null | undefined, now: Date): boolean {
  return !!coolOffUntil && coolOffUntil.getTime() > now.getTime();
}

export interface PayoutAccountView {
  bankName: string;
  accountName: string;
  /** "••••1234": the only form of the number this projection ever carries. */
  accountMasked: string;
  changedAt: Date;
  coolOffUntil: Date | null;
  inCoolOff: boolean;
}

function toView(account: { bankName: string; accountName: string; last4: string; changedAt: Date; coolOffUntil: Date | null }, now: Date): PayoutAccountView {
  return {
    bankName: account.bankName,
    accountName: account.accountName,
    accountMasked: maskAccount(account.last4),
    changedAt: account.changedAt,
    coolOffUntil: account.coolOffUntil,
    inCoolOff: isInCoolOff(account.coolOffUntil, now),
  };
}

async function memberInAssociation(associationId: number, memberId: number) {
  const member = await prisma.member.findFirst({ where: { id: memberId, associationId }, select: { id: true, userId: true, firstName: true, lastName: true } });
  // Another association's member is reported as missing, never as forbidden.
  if (!member) throw new RuleError('That member was not found.', 404, 'MEMBER_NOT_FOUND');
  return member;
}

/** The masked account, or null if the person has not entered one. */
export async function getPayoutAccount(input: { associationId: number; memberId: number; now?: Date }): Promise<PayoutAccountView | null> {
  await memberInAssociation(input.associationId, input.memberId);
  const account = await prisma.ajoPayoutAccount.findFirst({ where: { memberId: input.memberId, associationId: input.associationId } });
  return account ? toView(account, input.now ?? new Date()) : null;
}

/**
 * The full account number. Only the person entering it and officers with `ajo.manage` may call this (the route checks); every call is
 * written to the audit trail, so who looked at a number is on record.
 */
export async function revealAccountNumber(input: { associationId: number; memberId: number; actorUserId: number }): Promise<string> {
  await memberInAssociation(input.associationId, input.memberId);
  return prisma.$transaction(async (tx) => {
    const account = await tx.ajoPayoutAccount.findFirst({ where: { memberId: input.memberId, associationId: input.associationId } });
    if (!account) throw new RuleError('This person has not entered a payout account.', 404, 'PAYOUT_ACCOUNT_MISSING');
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_PAYOUT_ACCOUNT_VIEWED', tableName: 'ajo_payout_accounts', recordId: account.id, newValues: { memberId: input.memberId } });
    return decryptAccountNumber(input.memberId, account.accountNumberEnc);
  });
}

export interface SetPayoutAccountInput {
  associationId: number;
  memberId: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  actorUserId: number;
  now?: Date;
}

export interface SetPayoutAccountResult {
  account: PayoutAccountView;
  /** True when nothing changed (the same details sent again): no cool-off restart, no void, no notice. */
  replayed: boolean;
  voidedPayoutIds: number[];
  verification: 'NONE' | 'REFRESHED' | 'RESET';
}

function clean(value: unknown, label: string, min: number, max: number): string {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (text.length < min || text.length > max) throw new RuleError(`${label} must be ${min} to ${max} characters.`, 400, 'INVALID_PAYOUT_ACCOUNT');
  return text;
}

/** Enter or change a payout account. The same details sent twice are a no-op, so a retry never restarts the cool-off. */
export async function setPayoutAccount(input: SetPayoutAccountInput): Promise<SetPayoutAccountResult> {
  const now = input.now ?? new Date();
  const bankName = clean(input.bankName, 'The bank name', 2, 80);
  const accountName = clean(input.accountName, 'The account name', 2, 120);
  const accountNumber = normaliseAccountNumber(input.accountNumber);
  if (!accountNumber) throw new RuleError('An account number is exactly 10 digits.', 400, 'INVALID_PAYOUT_ACCOUNT');

  const member = await memberInAssociation(input.associationId, input.memberId);
  const settings = await PlatformSettingsService.getSettings();
  const hours = Number.isInteger(settings.ajoPayoutCooloffHours) ? settings.ajoPayoutCooloffHours : 72;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.ajoPayoutAccount.findUnique({ where: { memberId: input.memberId } });

    if (existing) {
      let sameNumber = false;
      try {
        sameNumber = decryptAccountNumber(input.memberId, existing.accountNumberEnc) === accountNumber;
      } catch {
        // Unreadable (for example the platform key changed): treat it as different, so the person can set it again.
      }
      if (sameNumber && existing.bankName.toLowerCase() === bankName.toLowerCase() && existing.accountName.toLowerCase() === accountName.toLowerCase()) {
        return { view: toView(existing, now), replayed: true, voidedPayoutIds: [] as number[], verification: 'NONE' as const, first: false };
      }
    }

    const data = {
      associationId: input.associationId,
      bankName,
      accountNumberEnc: encryptAccountNumber(input.memberId, accountNumber),
      last4: lastFour(accountNumber),
      accountName,
      changedAt: now,
      changedBy: input.actorUserId,
      coolOffUntil: coolOffEnd(now, hours),
    };
    const saved = existing
      ? await tx.ajoPayoutAccount.update({ where: { memberId: input.memberId }, data })
      : await tx.ajoPayoutAccount.create({ data: { memberId: input.memberId, ...data } });

    // An approval was given for the old account. It no longer stands: the payout must be prepared and approved again.
    const approved = await tx.ajoPayout.findMany({ where: { associationId: input.associationId, status: 'APPROVED', membership: { memberId: input.memberId } }, select: { id: true } });
    const voidedPayoutIds = approved.map((p) => p.id);
    if (voidedPayoutIds.length) {
      await tx.ajoPayout.updateMany({
        where: { id: { in: voidedPayoutIds }, status: 'APPROVED' },
        data: { status: 'VOID', voidReason: 'The payout account was changed after this payout was approved.' },
      });
    }

    const verification = await resetVerificationForAccountChange(tx, { associationId: input.associationId, memberId: input.memberId });

    await auditAjo(tx, {
      associationId: input.associationId,
      userId: input.actorUserId,
      action: existing ? 'AJO_PAYOUT_ACCOUNT_CHANGED' : 'AJO_PAYOUT_ACCOUNT_SET',
      tableName: 'ajo_payout_accounts',
      recordId: saved.id,
      oldValues: existing ? { bankName: existing.bankName, accountMasked: maskAccount(existing.last4), accountName: existing.accountName } : null,
      newValues: { memberId: input.memberId, bankName, accountMasked: maskAccount(saved.last4), accountName, coolOffUntil: saved.coolOffUntil?.toISOString() ?? null, voidedPayoutIds, verification },
    });

    return { view: toView(saved, now), replayed: false, voidedPayoutIds, verification, first: !existing };
  });

  if (!result.replayed) {
    const who = `${member.firstName} ${member.lastName}`.trim();
    const until = result.view.coolOffUntil ? ` No payout to them can be approved until ${result.view.coolOffUntil.toISOString()}.` : '';
    const voided = result.voidedPayoutIds.length ? ` ${result.voidedPayoutIds.length === 1 ? 'An approved payout was' : 'Approved payouts were'} cancelled and must be approved again.` : '';
    if (member.userId) {
      await notifyUser(input.associationId, member.userId, {
        pushType: 'ajo.payout_account_changed',
        title: result.first ? 'Payout account saved' : 'Payout account changed',
        message: `Your payout account is now ${result.view.accountMasked} at ${bankName}. If you did not do this, tell your group admin now.${until}`,
      });
    }
    await notifyPermissionHolders(
      input.associationId,
      'ajo.manage',
      { pushType: 'ajo.payout_account_changed', title: result.first ? 'Payout account added' : 'Payout account changed', message: `${who}'s payout account is now ${result.view.accountMasked} at ${bankName}.${until}${voided}` },
      input.actorUserId,
    );
  }

  return { account: result.view, replayed: result.replayed, voidedPayoutIds: result.voidedPayoutIds, verification: result.verification };
}
