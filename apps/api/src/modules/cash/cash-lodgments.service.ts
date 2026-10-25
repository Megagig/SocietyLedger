import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { accountingIntegrationService } from '../../services/accounting-integration.service';
import { deleteFile, getPresignedUrl, uploadFile } from '../../lib/storage';
import { SettingsService } from '../settings/settings.service';
import { collectionTotals, officerNames } from './cash-collections.service';
import {
  CashRuleError,
  DEFAULT_LODGMENT_DUE_DAYS,
  collectionRemaining,
  daysBetween,
  isLodgmentOverdue,
  isValidMoney,
  lodgmentShortfall,
  officerCashPosition,
  planLodgment,
} from './cash-rules';
import { notifyLodgmentDecided, notifyLodgmentRecorded } from './cash-notifications';

const num = (d: Decimal.Value | null | undefined) => Number(d ?? 0);

export async function getLodgmentDueDays(associationId: number): Promise<number> {
  try {
    const settings = await SettingsService.getSettings(associationId, 'payments');
    const days = Number(settings.cashLodgmentDueDays);
    return Number.isFinite(days) && days >= 0 ? days : DEFAULT_LODGMENT_DUE_DAYS;
  } catch {
    return DEFAULT_LODGMENT_DUE_DAYS;
  }
}

type LodgmentRow = Prisma.CashLodgmentGetPayload<{ include: { allocations: { include: { collection: { select: { id: true; title: true } } } } } }>;

function shapeLodgment(l: LodgmentRow, names: Map<number, string>, banks: Map<number, { bankName: string; accountName: string; accountNumber: string }>) {
  const bank = banks.get(l.bankAccountId);
  return {
    id: l.id,
    status: l.status,
    amount: num(l.amount),
    expectedAmount: num(l.expectedAmount),
    shortfall: num(lodgmentShortfall(l.expectedAmount, l.amount)),
    shortfallReason: l.shortfallReason,
    depositDate: l.depositDate,
    bankReference: l.bankReference,
    hasSlip: !!l.slipKey,
    bankAccount: bank
      ? { id: l.bankAccountId, bankName: bank.bankName, accountName: bank.accountName, accountNumber: bank.accountNumber }
      : { id: l.bankAccountId, bankName: 'Removed account', accountName: '', accountNumber: '' },
    lodgedBy: { id: l.lodgedBy, name: names.get(l.lodgedBy) ?? 'Unknown officer' },
    verifiedBy: l.verifiedBy ? { id: l.verifiedBy, name: names.get(l.verifiedBy) ?? 'Unknown officer' } : null,
    verifiedAt: l.verifiedAt,
    rejectionReason: l.rejectionReason,
    createdAt: l.createdAt,
    collections: l.allocations.map((a) => ({ id: a.collectionId, title: a.collection.title, amount: num(a.amount) })),
  };
}

async function bankMap(associationId: number, ids: number[]) {
  const banks = await prisma.associationBankAccount.findMany({
    where: { associationId, id: { in: [...new Set(ids)] } },
    select: { id: true, bankName: true, accountName: true, accountNumber: true },
  });
  return new Map(banks.map((b) => [b.id, b]));
}

export const cashLodgmentsService = {
  /**
   * Where the cash is. Everyone with cash access sees their own position; officers who can view cash also see every officer's, which
   * is how the treasurer spots money that has sat too long. Cash in hand drops when a lodgment is recorded, so a lodgment waiting
   * for a check is shown separately instead of vanishing.
   */
  async getOverview(associationId: number, access: { userId: number; viewAll: boolean }) {
    const dueDays = await getLodgmentDueDays(associationId);
    const now = new Date();

    const collections = await prisma.cashCollection.findMany({
      where: { associationId, ...(access.viewAll ? {} : { collectedBy: access.userId }) },
      select: { id: true, collectedBy: true, status: true, closedAt: true },
    });
    const totals = await collectionTotals(collections.map((c) => c.id));

    const pendingByOfficer = await prisma.cashLodgment.groupBy({
      by: ['lodgedBy'],
      where: { associationId, status: 'PENDING', ...(access.viewAll ? {} : { lodgedBy: access.userId }) },
      _sum: { amount: true },
    });
    const awaiting = new Map(pendingByOfficer.map((p) => [p.lodgedBy, p._sum.amount ?? new Decimal(0)]));

    const officerIds = new Set<number>([access.userId, ...collections.map((c) => c.collectedBy), ...awaiting.keys()]);
    const names = await officerNames([...officerIds]);

    const positions = [...officerIds].map((officerId) => {
      const mine = collections
        .filter((c) => c.collectedBy === officerId)
        .map((c) => ({
          collectionId: c.id,
          status: c.status as 'OPEN' | 'CLOSED',
          closedAt: c.closedAt,
          collected: totals.get(c.id)?.collected ?? 0,
          allocated: totals.get(c.id)?.allocated ?? 0,
        }));
      const p = officerCashPosition(mine, awaiting.get(officerId) ?? 0);
      const overdue = isLodgmentOverdue(p.oldestUnlodgedSince, now, dueDays);
      return {
        officer: { id: officerId, name: names.get(officerId) ?? 'Unknown officer' },
        inOpenCollections: num(p.inOpenCollections),
        readyToLodge: num(p.readyToLodge),
        awaitingCheck: num(p.awaitingCheck),
        inHand: num(p.inOpenCollections.plus(p.readyToLodge)),
        oldestUnlodgedSince: p.oldestUnlodgedSince,
        daysUnlodged: p.oldestUnlodgedSince ? daysBetween(p.oldestUnlodgedSince, now) : 0,
        overdue,
      };
    });

    const mine = positions.find((p) => p.officer.id === access.userId) ?? null;
    const officers = access.viewAll ? positions.filter((p) => p.inHand > 0 || p.awaitingCheck > 0).sort((a, b) => b.inHand - a.inHand) : [];

    const waitingForMe = await prisma.cashLodgment.count({ where: { associationId, status: 'PENDING', lodgedBy: { not: access.userId } } });

    return {
      dueDays,
      mine,
      officers,
      totals: access.viewAll
        ? {
            inHand: officers.reduce((s, o) => s + o.inHand, 0),
            awaitingCheck: officers.reduce((s, o) => s + o.awaitingCheck, 0),
            overdueOfficers: officers.filter((o) => o.overdue).length,
          }
        : null,
      lodgmentsToVerify: waitingForMe,
    };
  },

  /** The closed collections the caller could lodge now, oldest first, with the cash left in each. */
  async getLodgable(associationId: number, userId: number) {
    const collections = await prisma.cashCollection.findMany({
      where: { associationId, collectedBy: userId, status: 'CLOSED' },
      orderBy: { closedAt: 'asc' },
      select: { id: true, title: true, closedAt: true },
    });
    const totals = await collectionTotals(collections.map((c) => c.id));
    const rows = collections
      .map((c) => ({ id: c.id, title: c.title, closedAt: c.closedAt, remaining: num(collectionRemaining(totals.get(c.id) ?? { collected: 0, allocated: 0 })) }))
      .filter((c) => c.remaining > 0);
    return { collections: rows, total: rows.reduce((s, c) => s + c.remaining, 0) };
  },

  async recordLodgment(
    associationId: number,
    userId: number,
    data: {
      bankAccountId: number;
      amount: number;
      depositDate: Date;
      bankReference?: string | null;
      shortfallReason?: string | null;
      collectionIds?: number[];
    },
    slip: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    if (!isValidMoney(data.amount)) throw new CashRuleError('INVALID_ITEM', 'Enter the amount you paid into the bank, in naira and kobo.');
    if (data.depositDate.getTime() > Date.now() + 86_400_000) throw new CashRuleError('INVALID_ITEM', 'The deposit date cannot be in the future.');

    const bank = await prisma.associationBankAccount.findFirst({ where: { id: data.bankAccountId, associationId } });
    if (!bank) throw new CashRuleError('INVALID_LINK', 'That bank account was not found for this association.');
    if (!bank.isActive) throw new CashRuleError('INVALID_LINK', 'That bank account is no longer active. Choose another account.');

    // Fail early, before the slip is stored, when there is nothing to lodge or the amount is off.
    const lodgable = await this.getLodgable(associationId, userId);
    const preview = planLodgment(
      lodgable.collections.map((c) => ({ collectionId: c.id, closedAt: c.closedAt, remaining: c.remaining })),
      data.collectionIds,
    );
    if (preview.lines.length === 0) {
      throw new CashRuleError('NOTHING_TO_LODGE', 'You have no closed collection with cash left to lodge. Close the collection first.');
    }
    if (new Decimal(data.amount).greaterThan(preview.expected)) {
      throw new CashRuleError('OVER_CASH_IN_HAND', `You can lodge at most ₦${preview.expected.toNumber().toLocaleString('en-NG')} — that is all the cash you hold in these collections.`);
    }
    if (lodgmentShortfall(preview.expected, data.amount).greaterThan(0) && !data.shortfallReason?.trim()) {
      throw new CashRuleError('SHORTFALL_REASON_REQUIRED', 'You are lodging less than you collected. Say why, so the treasurer can follow it up.');
    }

    const ext = (slip.originalname.match(/\.[a-zA-Z0-9]+$/)?.[0] || '').toLowerCase();
    const slipKey = `cash-lodgments/${associationId}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    await uploadFile(slipKey, slip.buffer, slip.mimetype);

    try {
      const created = await prisma.$transaction(
        async (tx) => {
          // Lock the collections so two lodgments can't both claim the same cash.
          const ids = preview.lines.map((l) => l.collectionId);
          await tx.$queryRaw`SELECT id FROM cash_collections WHERE id IN (${Prisma.join(ids)}) FOR UPDATE`;

          const [receipts, allocations] = await Promise.all([
            tx.cashReceipt.groupBy({ by: ['collectionId'], where: { collectionId: { in: ids }, status: 'ACTIVE' }, _sum: { totalAmount: true } }),
            tx.cashLodgmentAllocation.groupBy({
              by: ['collectionId'],
              where: { collectionId: { in: ids }, lodgment: { status: { in: ['PENDING', 'VERIFIED'] } } },
              _sum: { amount: true },
            }),
          ]);
          const collected = new Map(receipts.map((r) => [r.collectionId, new Decimal(r._sum.totalAmount ?? 0)]));
          const allocated = new Map(allocations.map((a) => [a.collectionId, new Decimal(a._sum.amount ?? 0)]));
          const lines = preview.lines
            .map((l) => ({
              collectionId: l.collectionId,
              amount: collectionRemaining({ collected: collected.get(l.collectionId) ?? 0, allocated: allocated.get(l.collectionId) ?? 0 }),
            }))
            .filter((l) => l.amount.greaterThan(0));
          const expected = lines.reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
          if (lines.length === 0 || new Decimal(data.amount).greaterThan(expected)) {
            throw new CashRuleError('OVER_CASH_IN_HAND', 'The cash in these collections changed while you were lodging. Review it and try again.');
          }

          return tx.cashLodgment.create({
            data: {
              associationId,
              bankAccountId: bank.id,
              lodgedBy: userId,
              amount: data.amount,
              expectedAmount: expected,
              shortfallReason: lodgmentShortfall(expected, data.amount).greaterThan(0) ? data.shortfallReason!.trim() : null,
              depositDate: data.depositDate,
              bankReference: data.bankReference?.trim() || null,
              slipKey,
              allocations: { create: lines.map((l) => ({ collectionId: l.collectionId, amount: l.amount })) },
            },
            include: { allocations: { include: { collection: { select: { id: true, title: true } } } } },
          });
        },
        { maxWait: 15000, timeout: 30000 },
      );

      await prisma.auditLog.create({
        data: { associationId, userId, action: 'CASH_LODGMENT', tableName: 'cash_lodgments', recordId: created.id, newValues: { amount: data.amount, bankAccountId: bank.id } },
      });
      void notifyLodgmentRecorded(associationId, { id: created.id, lodgedBy: userId, amount: data.amount, bankName: bank.bankName });

      const [names, banks] = await Promise.all([officerNames([userId]), bankMap(associationId, [bank.id])]);
      return shapeLodgment(created, names, banks);
    } catch (error) {
      await deleteFile(slipKey).catch(() => undefined); // never leave an orphaned slip behind
      throw error;
    }
  },

  async listLodgments(
    associationId: number,
    opts: { userId: number; viewAll: boolean; status?: 'PENDING' | 'VERIFIED' | 'REJECTED'; page: number; limit: number },
  ) {
    const where: Prisma.CashLodgmentWhereInput = {
      associationId,
      ...(opts.viewAll ? {} : { lodgedBy: opts.userId }),
      ...(opts.status ? { status: opts.status } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.cashLodgment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
        include: { allocations: { include: { collection: { select: { id: true, title: true } } } } },
      }),
      prisma.cashLodgment.count({ where }),
    ]);
    const [names, banks] = await Promise.all([
      officerNames(rows.flatMap((r) => [r.lodgedBy, r.verifiedBy ?? r.lodgedBy])),
      bankMap(associationId, rows.map((r) => r.bankAccountId)),
    ]);
    return {
      lodgments: rows.map((r) => shapeLodgment(r, names, banks)),
      pagination: { page: opts.page, limit: opts.limit, total, totalPages: Math.max(1, Math.ceil(total / opts.limit)) },
    };
  },

  async getLodgment(associationId: number, id: number, access: { userId: number; viewAll: boolean }) {
    const row = await prisma.cashLodgment.findFirst({
      where: { id, associationId },
      include: { allocations: { include: { collection: { select: { id: true, title: true } } } } },
    });
    if (!row || (!access.viewAll && row.lodgedBy !== access.userId)) throw new CashRuleError('NOT_FOUND', 'That lodgment was not found.');
    const [names, banks] = await Promise.all([officerNames([row.lodgedBy, row.verifiedBy ?? row.lodgedBy]), bankMap(associationId, [row.bankAccountId])]);
    return shapeLodgment(row, names, banks);
  },

  /** A short-lived link to the deposit slip photo, for the officer who lodged it or anyone who can view cash. */
  async getSlipUrl(associationId: number, id: number, access: { userId: number; viewAll: boolean }, requestHost?: string) {
    const row = await prisma.cashLodgment.findFirst({ where: { id, associationId }, select: { slipKey: true, lodgedBy: true } });
    if (!row || !row.slipKey || (!access.viewAll && row.lodgedBy !== access.userId)) throw new CashRuleError('NOT_FOUND', 'That deposit slip was not found.');
    const ext = (row.slipKey.match(/\.([a-zA-Z0-9]+)$/)?.[1] || '').toLowerCase();
    const mimeType = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return { url: await getPresignedUrl(row.slipKey, 3600, requestHost), mimeType, filename: `deposit-slip${ext ? `.${ext}` : ''}` };
  },

  /**
   * A different officer checks the lodgment against the bank statement. The collector can never verify their own. Verifying posts
   * the cash from Cash in hand to the bank; rejecting hands the cash back to the collector to lodge again.
   */
  async decideLodgment(associationId: number, userId: number, id: number, decision: { status: 'VERIFIED' | 'REJECTED'; reason?: string | null }) {
    const lodgment = await prisma.cashLodgment.findFirst({ where: { id, associationId }, include: { allocations: true } });
    if (!lodgment) throw new CashRuleError('NOT_FOUND', 'That lodgment was not found.');
    if (lodgment.lodgedBy === userId) throw new CashRuleError('OWN_LODGMENT', "You can't verify a lodgment you made yourself. Ask another officer to check it.");
    if (decision.status === 'REJECTED' && !decision.reason?.trim()) throw new CashRuleError('INVALID_ITEM', 'Say why the lodgment is not accepted, so the officer can fix it.');

    // Claim-then-act: only one decision wins, a second one finds nothing PENDING.
    const claimed = await prisma.cashLodgment.updateMany({
      where: { id, associationId, status: 'PENDING', lodgedBy: { not: userId } },
      data: {
        status: decision.status,
        verifiedBy: userId,
        verifiedAt: new Date(),
        rejectionReason: decision.status === 'REJECTED' ? decision.reason!.trim() : null,
      },
    });
    if (claimed.count === 0) throw new CashRuleError('ALREADY_DECIDED', 'This lodgment was already decided.');

    await prisma.auditLog.create({
      data: { associationId, userId, action: decision.status === 'VERIFIED' ? 'CASH_LODGMENT_VERIFY' : 'CASH_LODGMENT_REJECT', tableName: 'cash_lodgments', recordId: id, newValues: { reason: decision.reason ?? null } },
    });

    if (decision.status === 'VERIFIED') {
      try {
        const bank = await prisma.associationBankAccount.findFirst({ where: { id: lodgment.bankAccountId }, select: { bankName: true } });
        await accountingIntegrationService.onCashLodgmentVerified(lodgment, bank?.bankName ?? 'the bank', userId);
      } catch (error) {
        console.error('Accounting sync failed (non-critical):', error);
      }
    }

    void notifyLodgmentDecided(associationId, {
      id,
      lodgedBy: lodgment.lodgedBy,
      status: decision.status,
      amount: num(lodgment.amount),
      rejectionReason: decision.reason,
    });
    return this.getLodgment(associationId, id, { userId, viewAll: true });
  },
};
