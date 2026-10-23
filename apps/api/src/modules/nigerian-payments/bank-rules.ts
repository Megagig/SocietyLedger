import { prisma } from '../../lib/prisma';

export type BankRuleErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_DECIDED'
  | 'INVALID_LINK'
  | 'DUPLICATE_REFERENCE'
  | 'DUPLICATE_ACCOUNT'
  | 'LAST_ACCOUNT'
  | 'INACTIVE_DEFAULT';

/** Why a bank account or transfer change was refused — the controller turns each code into the right HTTP status. */
export class BankRuleError extends Error {
  constructor(
    public readonly code: BankRuleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BankRuleError';
  }
}

export const BANK_RULE_STATUS: Record<BankRuleErrorCode, number> = {
  NOT_FOUND: 404,
  ALREADY_DECIDED: 409,
  INVALID_LINK: 400,
  DUPLICATE_REFERENCE: 400,
  DUPLICATE_ACCOUNT: 400,
  LAST_ACCOUNT: 409,
  INACTIVE_DEFAULT: 400,
};

/** A transfer reference compared the way people read it: spaces trimmed, case ignored ("TRF123" and "trf123 " are the same). */
export function referenceWhere(reference: string) {
  return { equals: reference.trim(), mode: 'insensitive' as const };
}

/**
 * Everything a transfer links to must belong to this association: the receiving account (and be active — members and
 * officers are told to pay into active accounts only), the member, and the charge. Without this a transfer could be tied to
 * another association's records just by passing their ids.
 */
export async function assertTransferLinks(
  associationId: number,
  links: { bankAccountId?: number | null; memberId?: number | null; transactionId?: number | null },
): Promise<void> {
  if (links.bankAccountId) {
    const account = await prisma.associationBankAccount.findFirst({ where: { id: links.bankAccountId, associationId } });
    if (!account) throw new BankRuleError('INVALID_LINK', 'That receiving bank account was not found for this association.');
    if (!account.isActive) throw new BankRuleError('INVALID_LINK', 'That bank account is no longer active. Choose another receiving account.');
  }
  if (links.memberId) {
    const member = await prisma.member.findFirst({ where: { id: links.memberId, associationId }, select: { id: true } });
    if (!member) throw new BankRuleError('INVALID_LINK', 'That member was not found for this association.');
  }
  if (links.transactionId) {
    const transaction = await prisma.transaction.findFirst({ where: { id: links.transactionId, associationId }, select: { id: true, memberId: true } });
    if (!transaction) throw new BankRuleError('INVALID_LINK', 'That charge was not found for this association.');
    if (links.memberId && transaction.memberId !== links.memberId) {
      throw new BankRuleError('INVALID_LINK', 'That charge belongs to a different member.');
    }
  }
}

/** A reference already used by another transfer in this association (ignoring case and spaces), optionally excluding one. */
export async function assertReferenceFree(associationId: number, reference: string, exceptId?: number): Promise<void> {
  const existing = await prisma.bankTransfer.findFirst({
    where: { associationId, reference: referenceWhere(reference), ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new BankRuleError('DUPLICATE_REFERENCE', 'A bank transfer with this reference already exists.');
}

/** Members are told to pay into the association's active accounts, so the last active one can't be removed. */
export async function assertNotLastActiveAccount(associationId: number, accountId: number): Promise<void> {
  const others = await prisma.associationBankAccount.count({ where: { associationId, isActive: true, id: { not: accountId } } });
  if (others === 0) {
    throw new BankRuleError('LAST_ACCOUNT', 'Members are told to pay into this account. Add another account first, then remove this one.');
  }
}

/**
 * After the default account is retired, makes the oldest remaining active account the default so members always see one.
 * Returns its id, or null when nothing needed changing.
 */
export async function promoteNewDefault(associationId: number): Promise<number | null> {
  const stillDefault = await prisma.associationBankAccount.findFirst({ where: { associationId, isActive: true, isDefault: true }, select: { id: true } });
  if (stillDefault) return null;
  const next = await prisma.associationBankAccount.findFirst({ where: { associationId, isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!next) return null;
  await prisma.associationBankAccount.update({ where: { id: next.id }, data: { isDefault: true } });
  return next.id;
}
