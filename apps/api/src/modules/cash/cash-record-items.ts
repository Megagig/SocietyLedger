import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { cacheInvalidationService } from '../../services/cache-invalidation.service';
import { SettingsService } from '../settings/settings.service';
import { memberLedgerService } from '../member-finance/member-ledger.service';
import { cooperativesService } from '../cooperatives/cooperatives.service';
import { welfareService } from '../welfare/welfare.service';
import { donationsService } from '../finance/advanced/donations.service';
import { CashRuleError } from './cash-rules';

/**
 * Each executor records ONE thing a member paid in cash, by calling the same rules the bank-transfer and manual-entry paths use,
 * with the payment method fixed to "cash". Callers run these inside runAsCashCollection() so the money lands in Cash in hand.
 * Nothing here changes how any existing flow behaves — the dues executor is a faithful copy of recordPayment's checks because that
 * logic lives in a controller and cannot be called.
 */

export type CashItemKindName = 'DUES' | 'LEVY' | 'SAVINGS' | 'WELFARE' | 'DONATION' | 'LOAN_REPAYMENT';

export interface CashItemInput {
  kind: CashItemKindName;
  /** transaction id (dues/levy), savings account id, welfare fund id, donation category id, or loan id */
  targetId: number;
  amount: number;
  /** donations only: the project the gift is for */
  allocationId?: number;
}

export interface RecordedItem {
  kind: CashItemKindName;
  sourceId: number | null;
  label: string;
  amount: number;
}

interface Context {
  associationId: number;
  userId: number;
  member: { id: number; firstName: string; lastName: string };
  receiptNumber: string;
}

const naira = (n: number | Decimal) =>
  Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whether the association takes cash at all (Payment Settings → enabled channels; an empty list means everything is allowed). */
export async function assertCashEnabled(associationId: number): Promise<void> {
  const settings = await SettingsService.getSettings(associationId, 'payments');
  const enabled: string[] = settings.enabledChannels || [];
  if (enabled.length > 0 && !enabled.includes('cash')) {
    throw new CashRuleError('CASH_DISABLED', 'Cash payments are not enabled for this association. Turn on "cash" in Payment Settings first.');
  }
}

// ---- dues / levies / penalties ----------------------------------------------------------------

export async function recordDuesItem(ctx: Context, item: CashItemInput): Promise<RecordedItem> {
  const { associationId, userId, member } = ctx;
  const transaction = await prisma.transaction.findFirst({
    where: { id: item.targetId, associationId, memberId: member.id },
    include: { payments: true, category: { select: { name: true, type: true } } },
  });
  if (!transaction) throw new CashRuleError('INVALID_ITEM', 'That charge was not found for this member.');
  if (transaction.isVoided) throw new CashRuleError('INVALID_ITEM', 'That charge was voided, so it can no longer be paid.');
  if (transaction.category.type === 'donation') {
    throw new CashRuleError('INVALID_ITEM', 'Donation pledges are not collected here. Record the gift as a donation instead.');
  }

  const paid = transaction.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
  const balance = new Decimal(transaction.amount).minus(paid);
  if (balance.lessThanOrEqualTo(0)) throw new CashRuleError('OVER_BALANCE', `${transaction.category.name} is already fully paid.`);

  const amount = new Decimal(item.amount);
  if (amount.lessThan(balance)) {
    const [financial, payments] = await Promise.all([
      SettingsService.getSettings(associationId, 'financial'),
      SettingsService.getSettings(associationId, 'payments'),
    ]);
    if (financial.enablePartialPayments === false || payments.enablePartialPayments === false) {
      throw new CashRuleError(
        'OVER_BALANCE',
        `Partial payments are not enabled for this association. ${transaction.category.name} needs the full ₦${naira(balance)}.`,
      );
    }
  }
  if (amount.greaterThan(balance)) {
    throw new CashRuleError('OVER_BALANCE', `${transaction.category.name} has only ₦${naira(balance)} left to pay.`);
  }

  const timestamp = Date.now().toString().slice(-6);
  const paymentCount = await prisma.payment.count({ where: { associationId } });
  const paymentReceipt = `RCP${String(paymentCount + 1).padStart(6, '0')}-${timestamp}`;
  const newStatus = paid.plus(amount).greaterThanOrEqualTo(transaction.amount) ? 'paid' : 'partial';

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        associationId,
        transactionId: transaction.id,
        amountPaid: item.amount,
        paymentDate: new Date(),
        paymentMethod: 'cash',
        receiptNumber: paymentReceipt,
        confirmedBy: userId,
        confirmedAt: new Date(),
      },
    }),
    prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: newStatus, paymentDate: newStatus === 'paid' ? new Date() : undefined, paymentMethod: 'cash' },
    }),
  ]);

  await prisma.auditLog.create({
    data: { associationId, userId, action: 'CREATE', tableName: 'payments', recordId: payment.id, newValues: { ...payment, cashReceipt: ctx.receiptNumber } as any },
  });
  await cacheInvalidationService.onPaymentChange(associationId);

  try {
    await memberLedgerService.createFromPayment(payment.id, userId);
  } catch (error) {
    console.error('Ledger sync failed (non-critical):', error);
  }
  try {
    const full = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: { transaction: { include: { member: true, category: true } } },
    });
    if (full) await accountingIntegrationService.onPaymentRecorded(full, userId);
  } catch (error) {
    console.error('Accounting sync failed (non-critical):', error);
  }

  return { kind: transaction.category.type === 'levy' ? 'LEVY' : 'DUES', sourceId: payment.id, label: transaction.category.name, amount: item.amount };
}

// ---- cooperative savings ----------------------------------------------------------------------

export async function recordSavingsItem(ctx: Context, item: CashItemInput): Promise<RecordedItem> {
  const account = await prisma.savingsAccount.findFirst({
    where: { id: item.targetId, associationId: ctx.associationId, memberId: ctx.member.id, status: 'ACTIVE' },
    select: { id: true, accountNumber: true },
  });
  if (!account) throw new CashRuleError('INVALID_ITEM', 'That savings account was not found for this member, or is not active.');

  const tx = await cooperativesService.processSavingsTransaction(ctx.associationId, ctx.userId, {
    savingsAccountId: account.id,
    type: 'DEPOSIT',
    amount: item.amount,
    paymentMethod: 'cash',
    reference: ctx.receiptNumber,
    notes: 'Cash collected by an officer',
  });
  return { kind: 'SAVINGS', sourceId: tx.id, label: `Savings ${account.accountNumber}`, amount: item.amount };
}

// ---- welfare ----------------------------------------------------------------------------------

export async function recordWelfareItem(ctx: Context, item: CashItemInput): Promise<RecordedItem> {
  const fund = await prisma.welfareFund.findFirst({
    where: { id: item.targetId, associationId: ctx.associationId, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  if (!fund) throw new CashRuleError('INVALID_ITEM', 'That welfare fund was not found, or is not active.');

  const contribution = await welfareService.recordContribution(ctx.associationId, ctx.userId, {
    fundId: fund.id,
    memberId: ctx.member.id,
    amount: item.amount,
    paymentMethod: 'cash',
    reference: ctx.receiptNumber,
    notes: 'Cash collected by an officer',
  } as any);

  try {
    await welfareService.confirmContribution(ctx.associationId, contribution.id, ctx.userId, 'CONFIRMED');
  } catch (error) {
    // Don't leave a pending contribution behind that nobody knows about.
    await welfareService.confirmContribution(ctx.associationId, contribution.id, ctx.userId, 'REJECTED', 'Cash receipt failed').catch(() => undefined);
    throw error;
  }
  return { kind: 'WELFARE', sourceId: contribution.id, label: fund.name, amount: item.amount };
}

// ---- donations --------------------------------------------------------------------------------

export async function recordDonationItem(ctx: Context, item: CashItemInput): Promise<RecordedItem> {
  const result = await donationsService.recordDonation(ctx.associationId, ctx.userId, {
    memberId: ctx.member.id,
    categoryId: item.targetId,
    amount: item.amount,
    allocationId: item.allocationId,
    paymentMethod: 'cash',
    donationType: 'instant',
    notes: `Cash donation (receipt ${ctx.receiptNumber})`,
  });

  try {
    if (result.payment) {
      await accountingIntegrationService.onCashDonation(result.payment, `${ctx.member.firstName} ${ctx.member.lastName}`.trim(), ctx.userId);
    }
  } catch (error) {
    console.error('Accounting sync failed (non-critical):', error);
  }
  return { kind: 'DONATION', sourceId: result.donationRecord.id, label: result.category.name, amount: item.amount };
}

// ---- loan repayments --------------------------------------------------------------------------

export async function recordLoanRepaymentItem(ctx: Context, item: CashItemInput): Promise<RecordedItem> {
  const loan = await prisma.loan.findFirst({
    where: { id: item.targetId, associationId: ctx.associationId, memberId: ctx.member.id, status: { in: ['ACTIVE', 'OVERDUE'] } },
    select: { id: true, loanNumber: true, outstandingBalance: true },
  });
  if (!loan) throw new CashRuleError('INVALID_ITEM', 'That loan was not found for this member, or is not being repaid.');
  if (new Decimal(item.amount).greaterThan(loan.outstandingBalance)) {
    throw new CashRuleError('OVER_BALANCE', `Loan ${loan.loanNumber} has only ₦${naira(loan.outstandingBalance)} left to repay.`);
  }

  const repayment = await cooperativesService.processLoanRepayment(ctx.associationId, ctx.userId, {
    loanId: loan.id,
    amount: item.amount,
    paymentMethod: 'cash',
    reference: ctx.receiptNumber,
    notes: 'Cash collected by an officer',
  });
  return { kind: 'LOAN_REPAYMENT', sourceId: repayment.id, label: `Loan ${loan.loanNumber}`, amount: item.amount };
}

export async function recordCashItem(ctx: Context, item: CashItemInput): Promise<RecordedItem> {
  switch (item.kind) {
    case 'DUES':
    case 'LEVY':
      return recordDuesItem(ctx, item);
    case 'SAVINGS':
      return recordSavingsItem(ctx, item);
    case 'WELFARE':
      return recordWelfareItem(ctx, item);
    case 'DONATION':
      return recordDonationItem(ctx, item);
    case 'LOAN_REPAYMENT':
      return recordLoanRepaymentItem(ctx, item);
    default:
      throw new CashRuleError('INVALID_ITEM', 'Unknown kind of payment.');
  }
}
