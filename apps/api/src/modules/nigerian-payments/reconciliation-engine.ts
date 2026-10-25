import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { cacheInvalidationService } from '../../services/cache-invalidation.service';
import { memberLedgerService } from '../member-finance/member-ledger.service';
import {
  assertChargeOpen,
  assertLineFits,
  assertNotOwnMatch,
  availableOn,
  rankSuggestions,
  statusAfterPayment,
  type MatchKind,
  type MoneyIn,
  type OpenCharge,
} from './reconcile-rules';

/**
 * Matching bank money to charges, and recording the payment when an officer confirms.
 *
 *  - A match is proposed (PENDING) and holds the bank line, so no other match can use it. The partial unique index
 *    `payment_reconciliations_one_live_match_per_line` backs that up in the database.
 *  - The amount is always the bank line's own amount. It is never typed in, and never zero.
 *  - The charge row is locked while a match is made or confirmed, so two officers can't both fill the same charge.
 *  - Confirming records one payment, dated the day the money reached the bank, and marks the charge paid or part paid.
 *  - Whoever proposed a match can't confirm it. Disputing releases the line (or the declared transfer) so it can be matched again.
 *
 * Accounting and ledger syncs run after the database transaction commits and never undo a confirmation.
 */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function lockCharge(tx: Tx, associationId: number, transactionId: number) {
  const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM transactions WHERE id = ${transactionId} AND association_id = ${associationId} FOR UPDATE`;
  if (locked.length === 0) throw new RuleError('Charge not found.', 404, 'CHARGE_NOT_FOUND');
  return tx.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { member: { select: { id: true, status: true, firstName: true, lastName: true } }, payments: { select: { amountPaid: true } } },
  });
}

const sumDecimal = (values: Decimal.Value[]) => values.reduce<Decimal>((s, v) => s.plus(v), new Decimal(0));

async function reservedOn(tx: Tx | typeof prisma, transactionId: number): Promise<Decimal> {
  const pending = await tx.paymentReconciliation.aggregate({ where: { transactionId, status: 'PENDING' }, _sum: { matchedAmount: true } });
  return new Decimal(pending._sum.matchedAmount ?? 0);
}

// ---------------------------------------------------------------- suggestions

export async function suggestMatches(associationId: number) {
  const [entries, transfers, chargeRows] = await Promise.all([
    prisma.bankStatementEntry.findMany({
      where: { import: { associationId }, matchStatus: 'UNMATCHED', creditAmount: { gt: 0 } },
      orderBy: { transactionDate: 'asc' },
      take: 2000,
    }),
    prisma.bankTransfer.findMany({ where: { associationId, status: 'VERIFIED', reconciliationId: null, transactionId: null }, take: 500 }),
    prisma.transaction.findMany({
      where: { associationId, isVoided: false, status: { in: ['pending', 'partial', 'overdue'] }, member: { status: { not: 'terminated' } } },
      include: {
        member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
        category: { select: { name: true } },
        payments: { select: { amountPaid: true } },
      },
      take: 5000,
    }),
  ]);

  const pending = await prisma.paymentReconciliation.groupBy({
    by: ['transactionId'],
    where: { associationId, status: 'PENDING', transactionId: { in: chargeRows.map((c) => c.id) } },
    _sum: { matchedAmount: true },
  });
  const reserved = new Map(pending.map((p) => [p.transactionId, new Decimal(p._sum.matchedAmount ?? 0)]));

  const charges: OpenCharge[] = chargeRows
    .map((c) => ({
      id: c.id,
      referenceNumber: c.referenceNumber,
      memberId: c.memberId,
      firstName: c.member.firstName,
      lastName: c.member.lastName,
      available: availableOn(c.amount, sumDecimal(c.payments.map((p) => p.amountPaid)), reserved.get(c.id) ?? 0),
    }))
    .filter((c) => c.available.greaterThan(0));

  const lines: MoneyIn[] = [
    ...entries.map((e) => ({
      key: `entry:${e.id}`, source: 'entry' as const, id: e.id, amount: new Decimal(e.creditAmount!), reference: e.reference, description: e.description, date: e.transactionDate, memberId: null,
    })),
    ...transfers.map((t) => ({
      key: `transfer:${t.id}`, source: 'transfer' as const, id: t.id, amount: new Decimal(t.amount), reference: t.reference, description: `${t.senderAccountName ?? ''} ${t.narration ?? ''}`.trim() || t.reference, date: t.transferDate, memberId: t.memberId,
    })),
  ];

  const byCharge = new Map(chargeRows.map((c) => [c.id, c]));
  const suggestions = rankSuggestions(lines, charges).map((s) => {
    const c = byCharge.get(s.charge.id)!;
    return {
      source: s.line.source,
      statementEntryId: s.line.source === 'entry' ? s.line.id : null,
      bankTransferId: s.line.source === 'transfer' ? s.line.id : null,
      line: { amount: s.line.amount.toFixed(2), date: s.line.date, reference: s.line.reference, description: s.line.description },
      transactionId: s.charge.id,
      charge: {
        referenceNumber: c.referenceNumber,
        categoryName: c.category.name,
        memberId: c.member.id,
        memberNumber: c.member.memberId,
        memberName: `${c.member.firstName} ${c.member.lastName}`,
        amount: new Decimal(c.amount).toFixed(2),
        available: s.charge.available.toFixed(2),
        dueDate: c.dueDate,
      },
      confidence: s.confidence,
      matchType: s.kind as MatchKind,
      reasons: s.reasons,
      recommended: s.recommended,
    };
  });

  return {
    suggestions,
    counts: { unmatchedLines: lines.length, suggested: suggestions.length, recommended: suggestions.filter((s) => s.recommended).length, withoutSuggestion: lines.length - suggestions.length },
  };
}

// ---------------------------------------------------------------- proposing a match

export type MatchInput = { transactionId: number; statementEntryId?: number | null; bankTransferId?: number | null; matchType: 'AUTO_REFERENCE' | 'AUTO_AMOUNT' | 'MANUAL'; confidence?: number; notes?: string | null };

export async function proposeMatch(associationId: number, userId: number, input: MatchInput) {
  if (Boolean(input.statementEntryId) === Boolean(input.bankTransferId)) {
    throw new RuleError('Choose one bank line, or one declared transfer, to match.', 400, 'ONE_SOURCE');
  }

  return prisma.$transaction(async (tx) => {
    const charge = await lockCharge(tx, associationId, input.transactionId);
    const paid = sumDecimal(charge.payments.map((p) => p.amountPaid));
    const available = availableOn(charge.amount, paid, await reservedOn(tx, charge.id));
    assertChargeOpen(charge, available);

    let amount: Decimal;
    if (input.statementEntryId) {
      const entry = await tx.bankStatementEntry.findFirst({ where: { id: input.statementEntryId, import: { associationId } } });
      if (!entry) throw new RuleError('Bank line not found.', 404, 'ENTRY_NOT_FOUND');
      if (!entry.creditAmount || new Decimal(entry.creditAmount).lessThanOrEqualTo(0)) {
        throw new RuleError('This line is money going out, not money received, so it can’t pay a charge.', 400, 'ENTRY_NOT_CREDIT');
      }
      amount = new Decimal(entry.creditAmount);
      assertLineFits(amount, available);

      // Claim the line: only one match can hold it
      const claimed = await tx.bankStatementEntry.updateMany({
        where: { id: entry.id, matchStatus: 'UNMATCHED' },
        data: {
          matchStatus: input.matchType === 'MANUAL' ? 'MANUAL_MATCHED' : 'AUTO_MATCHED',
          matchedTransactionId: charge.id,
          matchConfidence: input.confidence ?? (input.matchType === 'AUTO_REFERENCE' ? 100 : input.matchType === 'AUTO_AMOUNT' ? 70 : 100),
          matchedAt: new Date(),
          matchedBy: userId,
        },
      });
      if (claimed.count === 0) throw new RuleError('This bank line is already matched to a charge.', 409, 'ALREADY_MATCHED');
    } else {
      const transfer = await tx.bankTransfer.findFirst({ where: { id: input.bankTransferId!, associationId } });
      if (!transfer) throw new RuleError('Bank transfer not found.', 404, 'TRANSFER_NOT_FOUND');
      if (transfer.status !== 'VERIFIED' || transfer.reconciliationId) throw new RuleError('Only a verified transfer that is not matched yet can be matched.', 409, 'TRANSFER_NOT_AVAILABLE');
      amount = new Decimal(transfer.amount);
      assertLineFits(amount, available);
    }

    const reconciliation = await tx.paymentReconciliation.create({
      data: {
        associationId,
        transactionId: charge.id,
        statementEntryId: input.statementEntryId ?? null,
        matchType: input.matchType,
        matchedAmount: amount,
        variance: 0,
        status: 'PENDING',
        createdBy: userId,
        notes: input.notes ?? undefined,
      },
    });

    if (input.bankTransferId) {
      const claimed = await tx.bankTransfer.updateMany({
        where: { id: input.bankTransferId, associationId, status: 'VERIFIED', reconciliationId: null },
        data: { reconciliationId: reconciliation.id, transactionId: charge.id, status: 'MATCHED' },
      });
      if (claimed.count === 0) throw new RuleError('This transfer is already matched.', 409, 'ALREADY_MATCHED');
    }
    return reconciliation;
  });
}

// ---------------------------------------------------------------- confirming and disputing

export async function confirmMatch(id: number, associationId: number, userId: number, notes?: string | null) {
  const syncs: (() => Promise<unknown>)[] = [];

  const result = await prisma.$transaction(async (tx) => {
    const found = await tx.paymentReconciliation.findFirst({ where: { id, associationId } });
    if (!found) throw new RuleError('Reconciliation not found.', 404, 'NOT_FOUND');
    if (found.status !== 'PENDING') throw new RuleError('This match was already decided. It can’t be decided again.', 409, 'ALREADY_DECIDED');
    assertNotOwnMatch(found.createdBy, userId);

    const charge = await lockCharge(tx, associationId, found.transactionId);
    const amount = new Decimal(found.matchedAmount);
    if (amount.lessThanOrEqualTo(0)) throw new RuleError('This match has no amount, so it can’t record a payment. Dispute it instead.', 409, 'NO_AMOUNT');

    // What is owed now, not counting this match itself (it is the one being confirmed)
    const paid = sumDecimal(charge.payments.map((p) => p.amountPaid));
    const others = (await reservedOn(tx, charge.id)).minus(amount);
    const available = availableOn(charge.amount, paid, others);
    try {
      assertChargeOpen(charge, available);
      assertLineFits(amount, available);
    } catch (error) {
      if (error instanceof RuleError) throw new RuleError(`${error.message} Dispute this match, then match the line again.`, 409, 'CHARGE_CHANGED');
      throw error;
    }

    const claimed = await tx.paymentReconciliation.updateMany({
      where: { id, associationId, status: 'PENDING' },
      data: { status: 'CONFIRMED', reconciledBy: userId, reconciledAt: new Date(), notes: notes || undefined },
    });
    if (claimed.count === 0) throw new RuleError('This match was just decided by someone else.', 409, 'ALREADY_DECIDED');

    // The day the money reached the bank
    const entry = found.statementEntryId ? await tx.bankStatementEntry.findUnique({ where: { id: found.statementEntryId } }) : null;
    const transfer = await tx.bankTransfer.findFirst({ where: { reconciliationId: found.id } });
    const paymentDate = entry?.transactionDate ?? transfer?.transferDate ?? new Date();

    const count = await tx.payment.count({ where: { associationId } });
    const payment = await tx.payment.create({
      data: {
        associationId,
        transactionId: charge.id,
        amountPaid: amount,
        paymentDate,
        paymentMethod: 'bank_transfer',
        receiptNumber: `RCP${String(count + 1).padStart(6, '0')}`,
        confirmedBy: userId,
        confirmedAt: new Date(),
      },
      include: {
        transaction: { include: { member: { select: { id: true, memberId: true, firstName: true, lastName: true } }, category: { select: { id: true, name: true, type: true } } } },
      },
    });

    const status = statusAfterPayment(charge.amount, paid.plus(amount));
    await tx.transaction.update({ where: { id: charge.id }, data: { status, paymentDate, paymentMethod: 'bank_transfer' } });
    if (status === 'paid') await tx.levyCampaignAssignment.updateMany({ where: { transactionId: charge.id }, data: { status: 'paid' } });

    syncs.push(() => accountingIntegrationService.onPaymentRecorded(payment, userId));
    syncs.push(() => memberLedgerService.createFromPayment(payment.id, userId));
    return { id: found.id, status: 'CONFIRMED' as const, reconciliationId: found.id, paymentId: payment.id, receiptNumber: payment.receiptNumber, chargeStatus: status, amount: amount.toFixed(2) };
  });

  await cacheInvalidationService.onPaymentChange(associationId).catch((e) => console.error('Cache invalidation failed (non-critical):', e));
  for (const sync of syncs) {
    try {
      await sync();
    } catch (error) {
      console.error('Accounting/ledger sync failed (non-critical):', error);
    }
  }
  return result;
}

/** Turns a proposed match down: the bank line (or declared transfer) is released so it can be matched to something else. */
export async function disputeMatch(id: number, associationId: number, userId: number, notes?: string | null) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.paymentReconciliation.findFirst({ where: { id, associationId } });
    if (!found) throw new RuleError('Reconciliation not found.', 404, 'NOT_FOUND');

    const claimed = await tx.paymentReconciliation.updateMany({
      where: { id, associationId, status: 'PENDING' },
      data: { status: 'DISPUTED', reconciledBy: userId, reconciledAt: new Date(), notes: notes || undefined },
    });
    if (claimed.count === 0) throw new RuleError('This match was already decided. It can’t be decided again.', 409, 'ALREADY_DECIDED');

    if (found.statementEntryId) {
      await tx.bankStatementEntry.updateMany({
        where: { id: found.statementEntryId },
        data: { matchStatus: 'UNMATCHED', matchedTransactionId: null, matchedBankTransferId: null, matchConfidence: null, matchedAt: null, matchedBy: null },
      });
    }
    await tx.bankTransfer.updateMany({ where: { reconciliationId: found.id, associationId }, data: { reconciliationId: null, transactionId: null, status: 'VERIFIED' } });
    return tx.paymentReconciliation.findUniqueOrThrow({ where: { id } });
  });
}
