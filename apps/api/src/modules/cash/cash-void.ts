import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { cacheInvalidationService } from '../../services/cache-invalidation.service';
import { memberLedgerService } from '../member-finance/member-ledger.service';
import { unwindDeletedCharges } from '../finance/charge-unwind';
import { CashRuleError } from './cash-rules';
import { notifyCashReceiptVoided } from './cash-notifications';

/**
 * Undoing a cash receipt. Allowed only while its collection is still open (once it is closed the cash has been counted and may
 * be on its way to the bank), by an officer other than the one who took the cash, with a reason. Each payment is reversed with a
 * counter-entry where the ledger and the books are append-only, so history stays honest.
 *
 * Loan repayments cannot be voided here: a repayment reshapes the schedule and releases savings held against the loan, and there is
 * no safe automatic way back. That receipt must be corrected from the cooperative's loan page.
 */

type Item = { id: number; kind: string; sourceId: number | null; label: string; amount: Decimal };

async function reverseDues(item: Item, ctx: { associationId: number; userId: number; receiptNumber: string }) {
  if (!item.sourceId) return;
  const payment = await prisma.payment.findFirst({ where: { id: item.sourceId, associationId: ctx.associationId }, include: { transaction: { include: { category: true } } } });
  if (!payment) return; // already gone — nothing to undo

  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: payment.id } });
    const remaining = await tx.payment.findMany({ where: { transactionId: payment.transactionId }, select: { amountPaid: true } });
    const paid = remaining.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
    const overdue = payment.transaction.dueDate && payment.transaction.dueDate < new Date();
    const status = paid.greaterThanOrEqualTo(payment.transaction.amount) ? 'paid' : paid.greaterThan(0) ? 'partial' : overdue ? 'overdue' : 'pending';
    await tx.transaction.update({ where: { id: payment.transactionId }, data: { status, paymentDate: status === 'paid' ? payment.transaction.paymentDate : null } });
  });

  await memberLedgerService
    .createEntry({
      associationId: ctx.associationId,
      memberId: payment.transaction.memberId,
      entryType: 'DEBIT',
      category: payment.transaction.category.type === 'levy' ? 'LEVY' : payment.transaction.category.type === 'penalty' ? 'PENALTY' : 'DUES',
      amount: payment.amountPaid,
      effectiveDate: new Date(),
      description: `Cash receipt ${ctx.receiptNumber} voided - ${payment.transaction.category.name}`,
      sourceTable: 'payment_void',
      sourceId: payment.id,
      referenceNumber: ctx.receiptNumber,
      createdBy: ctx.userId,
    } as any)
    .catch((error) => console.error('Ledger reversal failed (non-critical):', error));
  await accountingIntegrationService
    .reverseJournalEntry(ctx.associationId, ctx.userId, payment.accountingEntryId, `Cash receipt ${ctx.receiptNumber} voided`, ctx.receiptNumber)
    .catch((error) => console.error('Accounting reversal failed (non-critical):', error));
  await cacheInvalidationService.onPaymentChange(ctx.associationId);
}

async function reverseSavings(item: Item, ctx: { associationId: number; userId: number; receiptNumber: string }) {
  if (!item.sourceId) return;
  const original = await prisma.savingsTransaction.findFirst({ where: { id: item.sourceId, associationId: ctx.associationId } });
  if (!original) return;

  await prisma.$transaction(async (tx) => {
    const account = await tx.savingsAccount.findUniqueOrThrow({ where: { id: original.savingsAccountId } });
    const balance = account.balance.minus(original.amount);
    if (balance.isNegative()) throw new CashRuleError('NOT_VOIDABLE', "The member has already used this money from their savings, so it can't be voided.");
    // A counter-transaction keeps the balance history intact; the deposit total is wound back so it is not counted as a withdrawal.
    await tx.savingsTransaction.create({
      data: {
        associationId: ctx.associationId,
        savingsAccountId: account.id,
        type: 'WITHDRAWAL',
        amount: original.amount,
        balanceAfter: balance,
        paymentMethod: 'cash',
        reference: ctx.receiptNumber,
        processedBy: ctx.userId,
        notes: `Reversal: cash receipt ${ctx.receiptNumber} voided`,
      },
    });
    await tx.savingsAccount.update({ where: { id: account.id }, data: { balance, totalDeposits: account.totalDeposits.minus(original.amount) } });
  });

  await accountingIntegrationService
    .reverseJournalEntry(ctx.associationId, ctx.userId, original.accountingEntryId, `Cash receipt ${ctx.receiptNumber} voided`, ctx.receiptNumber)
    .catch((error) => console.error('Accounting reversal failed (non-critical):', error));
}

async function reverseWelfare(item: Item, ctx: { associationId: number; userId: number; receiptNumber: string }) {
  if (!item.sourceId) return;
  const contribution = await prisma.welfareContribution.findFirst({ where: { id: item.sourceId, associationId: ctx.associationId } });
  if (!contribution || contribution.status !== 'CONFIRMED') return;

  await prisma.$transaction(async (tx) => {
    const fund = await tx.welfareFund.findUniqueOrThrow({ where: { id: contribution.fundId } });
    if (fund.currentBalance.lessThan(contribution.amount)) {
      throw new CashRuleError('NOT_VOIDABLE', "This welfare fund has already paid out this money, so the contribution can't be voided.");
    }
    await tx.welfareContribution.update({
      where: { id: contribution.id },
      data: { status: 'REJECTED', notes: `Voided with cash receipt ${ctx.receiptNumber}` },
    });
    await tx.welfareFund.update({ where: { id: fund.id }, data: { currentBalance: { decrement: contribution.amount } } });
  });

  await accountingIntegrationService
    .reverseJournalEntry(ctx.associationId, ctx.userId, contribution.accountingEntryId, `Cash receipt ${ctx.receiptNumber} voided`, ctx.receiptNumber)
    .catch((error) => console.error('Accounting reversal failed (non-critical):', error));
}

async function reverseDonation(item: Item, ctx: { associationId: number; userId: number; receiptNumber: string }) {
  if (!item.sourceId) return;
  const record = await prisma.donationRecord.findFirst({
    where: { id: item.sourceId, transaction: { associationId: ctx.associationId } },
    include: { transaction: { include: { payments: true } } },
  });
  if (!record) return;

  const paymentIds = record.transaction.payments.map((p) => p.id);
  const memberId = record.transaction.memberId;
  const transactionId = record.transactionId;
  // Same unwinding the existing "delete a transaction" action does for a donation: the gift record, its payments, then the charge.
  await prisma.$transaction(async (tx) => {
    await tx.donationRecord.delete({ where: { id: record.id } });
    await tx.payment.deleteMany({ where: { transactionId: record.transactionId } });
    await tx.transaction.delete({ where: { id: record.transactionId } });
  });

  // The donation is gone, so its charge and its payments come out of the books (both used to stay counted: only the payments were
  // reversed) and off the member's ledger (which was never touched).
  await unwindDeletedCharges({
    associationId: ctx.associationId,
    userId: ctx.userId,
    memberIds: [memberId],
    transactionIds: [transactionId],
    paymentIds,
    reason: `Cash receipt ${ctx.receiptNumber} voided`,
    reference: ctx.receiptNumber,
  });
  await cacheInvalidationService.onPaymentChange(ctx.associationId);
}

/** Checks a receipt can be undone, before anything is changed. */
async function assertVoidable(items: Item[], associationId: number) {
  for (const item of items) {
    if (item.kind === 'LOAN_REPAYMENT') {
      throw new CashRuleError('NOT_VOIDABLE', 'A loan repayment cannot be voided here. Correct it from the loan in the cooperative section.');
    }
    if (item.kind === 'SAVINGS' && item.sourceId) {
      const original = await prisma.savingsTransaction.findFirst({ where: { id: item.sourceId, associationId }, include: { savingsAccount: { select: { balance: true } } } });
      if (original && original.savingsAccount.balance.lessThan(original.amount)) {
        throw new CashRuleError('NOT_VOIDABLE', "The member has already used this money from their savings, so it can't be voided.");
      }
    }
    if (item.kind === 'WELFARE' && item.sourceId) {
      const c = await prisma.welfareContribution.findFirst({ where: { id: item.sourceId, associationId }, include: { fund: { select: { currentBalance: true } } } });
      if (c && c.status === 'CONFIRMED' && c.fund.currentBalance.lessThan(c.amount)) {
        throw new CashRuleError('NOT_VOIDABLE', "This welfare fund has already paid out this money, so the contribution can't be voided.");
      }
    }
  }
}

export async function voidCashReceipt(associationId: number, userId: number, receiptId: number, reason: string) {
  if (!reason.trim()) throw new CashRuleError('INVALID_ITEM', 'Say why this receipt is being voided.');

  const receipt = await prisma.cashReceipt.findFirst({
    where: { id: receiptId, associationId },
    include: { items: true, collection: { select: { status: true } }, member: { select: { firstName: true, lastName: true, userId: true } } },
  });
  if (!receipt) throw new CashRuleError('NOT_FOUND', 'That receipt was not found.');
  if (receipt.status === 'VOIDED') throw new CashRuleError('ALREADY_DECIDED', 'This receipt is already voided.');
  if (receipt.collection.status !== 'OPEN') {
    throw new CashRuleError('COLLECTION_CLOSED', 'This collection is closed, so its receipts can no longer be voided. Record the correction in a new collection.');
  }
  if (receipt.createdBy === userId) {
    throw new CashRuleError('NOT_OWNER', "You can't void a receipt you took yourself. Ask another officer to void it.");
  }

  await assertVoidable(receipt.items, associationId);

  // Claim-then-act: a second void (double tap, two officers) finds nothing ACTIVE.
  const claimed = await prisma.cashReceipt.updateMany({
    where: { id: receiptId, associationId, status: 'ACTIVE' },
    data: { status: 'VOIDED', voidedBy: userId, voidedAt: new Date(), voidReason: reason.trim() },
  });
  if (claimed.count === 0) throw new CashRuleError('ALREADY_DECIDED', 'This receipt is already voided.');

  const ctx = { associationId, userId, receiptNumber: receipt.receiptNumber };
  const failures: string[] = [];
  for (const item of receipt.items) {
    try {
      if (item.kind === 'DUES' || item.kind === 'LEVY') await reverseDues(item, ctx);
      else if (item.kind === 'SAVINGS') await reverseSavings(item, ctx);
      else if (item.kind === 'WELFARE') await reverseWelfare(item, ctx);
      else if (item.kind === 'DONATION') await reverseDonation(item, ctx);
    } catch (error) {
      failures.push(`${item.label}: ${error instanceof Error ? error.message : 'could not be reversed'}`);
    }
  }

  await prisma.auditLog.create({
    data: { associationId, userId, action: 'CASH_RECEIPT_VOID', tableName: 'cash_receipts', recordId: receiptId, newValues: { reason: reason.trim(), failures } },
  });
  void notifyCashReceiptVoided(associationId, {
    receiptId,
    receiptNumber: receipt.receiptNumber,
    memberUserId: receipt.member.userId,
    reason: reason.trim(),
  });

  if (failures.length > 0) {
    throw new CashRuleError('NOT_VOIDABLE', `The receipt was voided but some payments could not be reversed automatically: ${failures.join('; ')}. Please correct them manually.`);
  }
}
