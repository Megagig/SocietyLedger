import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma, SavingsTransactionType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { assertWithdrawable } from './cooperative-rules';
import { getSavingsPosition } from './savings-lien';
import { accountingIntegrationService } from '../../services/accounting-integration.service';

type Db = Prisma.TransactionClient;

const CREDITS: SavingsTransactionType[] = ['DEPOSIT', 'INTEREST', 'TRANSFER_IN'];

export interface SavingsMovement {
  associationId: number;
  userId: number;
  savingsAccountId: number;
  type: SavingsTransactionType;
  amount: Decimal;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

/**
 * Moves money in or out of one savings account inside the caller's database transaction. The account is read, checked and changed together,
 * and the balance moves in a single atomic step, so two movements at the same moment can't overwrite each other or take an account below
 * zero. Because it takes the caller's transaction, several of these (the lines of one payment request) post together or not at all.
 */
export async function applySavingsMovement(tx: Db, movement: SavingsMovement) {
  const { associationId, savingsAccountId, type, amount } = movement;
  const isCredit = CREDITS.includes(type);

  const account = await tx.savingsAccount.findFirst({ where: { id: savingsAccountId, associationId, status: 'ACTIVE' } });
  if (!account) {
    throw new RuleError('Savings account not found or inactive', 404, 'ACCOUNT_NOT_FOUND');
  }

  if (!isCredit) {
    assertWithdrawable(account.balance, amount);

    // Savings held against an active loan can't be withdrawn or moved out.
    if (type === 'WITHDRAWAL' || type === 'TRANSFER_OUT') {
      const position = await getSavingsPosition(tx, associationId, account.memberId);
      if (position.locked.gt(0) && amount.gt(position.available)) {
        throw new RuleError(
          `Only ₦${position.available.toNumber().toLocaleString('en-NG', { minimumFractionDigits: 2 })} of the savings is available — the rest is held against an active loan`,
          409,
          'SAVINGS_HELD',
        );
      }
    }
  }

  const moved = await tx.savingsAccount.updateMany({
    where: { id: savingsAccountId, status: 'ACTIVE', ...(isCredit ? {} : { balance: { gte: amount } }) },
    data: {
      balance: isCredit ? { increment: amount } : { decrement: amount },
      ...(type === 'DEPOSIT' ? { totalDeposits: { increment: amount } } : {}),
      ...(type === 'WITHDRAWAL' ? { totalWithdrawals: { increment: amount } } : {}),
    },
  });
  if (moved.count === 0) {
    throw new RuleError('Insufficient balance for this withdrawal.', 409, 'INSUFFICIENT_BALANCE');
  }

  const updated = await tx.savingsAccount.findUniqueOrThrow({ where: { id: savingsAccountId }, select: { balance: true } });

  return tx.savingsTransaction.create({
    data: {
      associationId,
      savingsAccountId,
      type,
      amount,
      balanceAfter: updated.balance,
      paymentMethod: movement.paymentMethod,
      reference: movement.reference,
      processedBy: movement.userId,
      notes: movement.notes,
    },
    include: { processor: { select: { email: true } } },
  });
}

/**
 * Tells accounting about a posted deposit or withdrawal. Runs after the database transaction has committed and never throws: the savings
 * movement succeeded either way, and a failed sync is picked up by the accounting sync tools (the row stays `accountingSynced: false`).
 */
export async function syncSavingsToAccounting(
  transaction: { type: string; associationId: number },
  savingsAccountId: number,
  userId: number,
): Promise<void> {
  try {
    const fullAccount = await prisma.savingsAccount.findUnique({
      where: { id: savingsAccountId },
      include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } } },
    });
    if (!fullAccount) return;
    if (transaction.type === 'DEPOSIT') {
      await accountingIntegrationService.onSavingsDeposit(transaction, fullAccount, userId);
    } else if (transaction.type === 'WITHDRAWAL') {
      await accountingIntegrationService.onSavingsWithdrawal(transaction, fullAccount, userId);
    }
  } catch (syncError) {
    console.error('Accounting sync failed (non-critical):', syncError);
  }
}
