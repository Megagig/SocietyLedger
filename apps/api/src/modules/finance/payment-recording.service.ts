/**
 * Recording payments an officer has received, for one charge or for several at once.
 *
 * One function does it all, so the single-payment endpoint, the batch endpoint and every screen that records a payment share the same rules:
 * the charge exists and is not voided, it still has a balance, the amount is not more than the balance (and not less if the association has
 * switched partial payments off), the method is one the association accepts, and an officer does not record a payment against their own debt
 * unless the association has allowed it.
 *
 * Several charges are all-or-nothing: they are checked and saved inside one database transaction, with the charge rows locked, so two
 * officers recording at the same moment cannot both pay the same balance, and a failure on any one charge leaves every charge untouched.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { SettingsService } from '../settings/settings.service';
import { cacheInvalidationService } from '../../services/cache-invalidation.service';
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { memberLedgerService } from '../member-finance/member-ledger.service';
import { dispatchNotification } from '../../services/notification-preferences.service';
import { RuleError } from './rule-error';
import { PURPOSE_INCLUDE, purposeOf } from './charge-purpose';

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'mobile_money', 'cheque', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A rule that stopped one specific charge, so the screen can say which. */
export class PaymentRuleError extends RuleError {
  constructor(
    message: string,
    status: 400 | 403 | 404 | 409,
    code: string,
    readonly transactionId?: number,
  ) {
    super(message, status, code);
  }
}

export interface PaymentItem {
  transactionId: number;
  amountPaid: number;
}

export interface RecordPaymentsInput {
  items: PaymentItem[];
  paymentDate?: Date;
  paymentMethod?: PaymentMethod;
  notes?: string | null;
  /** Which screen the officer recorded it from, kept in the audit log ("levy-campaign", "member-ledger", …). */
  source?: string;
}

const naira = (value: Decimal) => value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

type Db = Prisma.TransactionClient;

interface Planned {
  transactionId: number;
  amount: Decimal;
  chargeAmount: Decimal;
  newStatus: 'paid' | 'partial';
  label: string;
  remaining: Decimal;
}

/** The one place the "may an officer record their own payment" setting is read. */
export async function allowsSelfPayment(associationId: number): Promise<boolean> {
  const financial = await SettingsService.getSettings(associationId, 'financial');
  return (financial as { allowOfficerSelfPayment?: boolean }).allowOfficerSelfPayment === true;
}

async function partialPaymentsAllowed(associationId: number): Promise<boolean> {
  const [financial, payments] = await Promise.all([
    SettingsService.getSettings(associationId, 'financial'),
    SettingsService.getSettings(associationId, 'payments'),
  ]);
  return financial.enablePartialPayments !== false && payments.enablePartialPayments !== false;
}

/** Checks every item against the locked charge rows and returns what each payment will do. Throws on the first charge that breaks a rule. */
async function plan(db: Db, associationId: number, actorUserId: number, input: RecordPaymentsInput, partialOk: boolean, selfOk: boolean): Promise<Planned[]> {
  const ids = input.items.map((item) => item.transactionId);
  if (new Set(ids).size !== ids.length) {
    throw new PaymentRuleError('The same charge is listed twice. Combine them into one amount.', 400, 'DUPLICATE_CHARGE');
  }
  await db.$queryRaw`SELECT id FROM transactions WHERE id IN (${Prisma.join(ids)}) AND association_id = ${associationId} FOR UPDATE`;
  const rows = await db.transaction.findMany({
    where: { id: { in: ids }, associationId },
    include: { payments: true, category: { select: { name: true } }, member: { select: { userId: true, firstName: true, lastName: true } }, ...PURPOSE_INCLUDE },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return input.items.map((item) => {
    const row = byId.get(item.transactionId);
    if (!row) throw new PaymentRuleError('Transaction not found', 404, 'NOT_FOUND', item.transactionId);
    const label = `${purposeOf(row) ?? row.category?.name ?? 'Charge'} (${row.member?.firstName ?? ''} ${row.member?.lastName ?? ''})`.replace(/\s+\)/, ')');
    if (row.isVoided) {
      throw new PaymentRuleError('This charge was voided, so it can no longer be paid. Pay its replacement instead.', 400, 'VOIDED', row.id);
    }
    if (!selfOk && row.member?.userId === actorUserId) {
      throw new PaymentRuleError('Another officer needs to record your payment.', 403, 'SELF_PAYMENT_NOT_ALLOWED', row.id);
    }
    const paid = row.payments.reduce((sum, p) => sum.plus(p.amountPaid), new Decimal(0));
    const balance = new Decimal(row.amount).minus(paid);
    if (balance.lessThanOrEqualTo(0)) {
      throw new PaymentRuleError('Transaction is already fully paid', 400, 'ALREADY_PAID', row.id);
    }
    const amount = new Decimal(item.amountPaid);
    if (amount.lessThan(balance) && !partialOk) {
      throw new PaymentRuleError('Partial payments are not enabled for this association. The full balance must be paid.', 400, 'PARTIAL_NOT_ALLOWED', row.id);
    }
    if (amount.greaterThan(balance)) {
      throw new PaymentRuleError(`Payment amount exceeds balance. Maximum: ${balance}`, 400, 'OVER_BALANCE', row.id);
    }
    const total = paid.plus(amount);
    return {
      transactionId: row.id,
      amount,
      chargeAmount: new Decimal(row.amount),
      newStatus: total.greaterThanOrEqualTo(row.amount) ? 'paid' : 'partial',
      label,
      remaining: new Decimal(row.amount).minus(total),
    };
  });
}

export const paymentRecordingService = {
  async record(associationId: number, actorUserId: number, input: RecordPaymentsInput) {
    if (input.items.length === 0) throw new PaymentRuleError('Choose at least one charge to pay.', 400, 'NO_ITEMS');

    // The method has to be one the association accepts.
    if (input.paymentMethod) {
      const settings = await SettingsService.getSettings(associationId, 'payments');
      const enabled: string[] = settings.enabledChannels || [];
      if (enabled.length > 0 && !enabled.includes(input.paymentMethod)) {
        throw new PaymentRuleError(`Payment method "${input.paymentMethod}" is not enabled for this association`, 400, 'METHOD_NOT_ENABLED');
      }
    }

    const [partialOk, selfOk] = await Promise.all([partialPaymentsAllowed(associationId), allowsSelfPayment(associationId)]);
    const paymentDate = input.paymentDate ?? new Date();
    const stamp = Date.now().toString().slice(-6);

    const saved = await prisma.$transaction(
      async (tx) => {
        const planned = await plan(tx, associationId, actorUserId, input, partialOk, selfOk);
        const before = await tx.payment.count({ where: { associationId } });
        const out: Array<{ payment: Awaited<ReturnType<typeof tx.payment.create>>; planned: Planned }> = [];
        for (let i = 0; i < planned.length; i++) {
          const p = planned[i];
          const payment = await tx.payment.create({
            data: {
              associationId,
              transactionId: p.transactionId,
              amountPaid: p.amount,
              paymentDate,
              paymentMethod: input.paymentMethod,
              receiptNumber: `RCP${String(before + i + 1).padStart(6, '0')}-${stamp}`,
              confirmedBy: actorUserId,
              confirmedAt: new Date(),
            },
          });
          await tx.transaction.update({
            where: { id: p.transactionId },
            data: { status: p.newStatus, paymentDate: p.newStatus === 'paid' ? new Date() : undefined, paymentMethod: input.paymentMethod },
          });
          // A levy campaign keeps its own status for the member; keep it in step with the money.
          await tx.levyCampaignAssignment.updateMany({ where: { transactionId: p.transactionId }, data: { status: p.newStatus } });
          out.push({ payment, planned: p });
        }
        return out;
      },
      { timeout: 30_000 },
    );

    // After the money is safely saved: the audit trail, the caches, the member's ledger, the books and the receipt. A failure in any of these
    // must never undo or hide a payment that has been recorded, so each is logged and skipped.
    await cacheInvalidationService.onPaymentChange(associationId);
    for (const { payment, planned } of saved) {
      await prisma.auditLog
        .create({
          data: {
            associationId,
            userId: actorUserId,
            action: 'CREATE',
            tableName: 'payments',
            recordId: payment.id,
            newValues: { ...payment, source: input.source ?? 'api', notes: input.notes ?? null, batchSize: saved.length } as unknown as Prisma.InputJsonValue,
          },
        })
        .catch((error: unknown) => console.error('Audit log failed (non-critical):', error));
      try {
        await memberLedgerService.createFromPayment(payment.id, actorUserId);
      } catch (ledgerError) {
        console.error('Ledger sync failed (non-critical):', ledgerError);
      }
      const full = await prisma.payment.findUnique({
        where: { id: payment.id },
        include: {
          transaction: {
            include: {
              member: { select: { id: true, memberId: true, firstName: true, lastName: true, userId: true } },
              category: { select: { id: true, name: true, type: true } },
            },
          },
        },
      });
      try {
        if (full) await accountingIntegrationService.onPaymentRecorded(full, actorUserId);
      } catch (syncError) {
        console.error('Accounting sync failed (non-critical):', syncError);
      }
      try {
        const auto = await SettingsService.getSetting(associationId, 'payments', 'receiptAutoGenerate');
        const memberUserId = full?.transaction.member?.userId;
        if (auto !== false && memberUserId && full) {
          const association = await prisma.association.findUnique({ where: { id: associationId }, select: { name: true } });
          await dispatchNotification({
            associationId,
            userId: memberUserId,
            title: 'Payment Received',
            message: `Your payment of ₦${naira(planned.amount)} has been received and confirmed.`,
            kind: 'payment_received',
            sendEmail: true,
            emailSubject: 'Payment Receipt',
            emailTemplate: 'payment-receipt',
            emailData: {
              memberName: `${full.transaction.member!.firstName} ${full.transaction.member!.lastName}`,
              receiptNumber: payment.receiptNumber,
              amount: planned.amount.toNumber(),
              categoryName: full.transaction.category?.name || 'Payment',
              paymentMethod: input.paymentMethod || 'N/A',
              paymentDate: paymentDate.toLocaleDateString(),
              associationName: association?.name || 'Your Association',
            },
          });
        }
      } catch (receiptError) {
        console.error('Receipt email failed (non-critical):', receiptError);
      }
    }

    return saved.map(({ payment, planned }) => ({
      payment,
      transactionId: planned.transactionId,
      label: planned.label,
      transactionStatus: planned.newStatus,
      remainingBalance: planned.remaining,
    }));
  },
};
