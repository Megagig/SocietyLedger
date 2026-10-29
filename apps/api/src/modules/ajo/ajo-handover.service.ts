/**
 * The collector's day (T4.2): what they expected, what they took, what they hand over, and the officer's line-by-line reconcile.
 *
 * Cash never counts until it is reconciled. The collector hands over a day's cash (one handover per collector, group and business day). The
 * officer then ticks the payments they actually received and states what they counted; the two must agree. Ticked payments become
 * confirmed and pay installments. Unticked ones stay "cash received", are flagged missing from the handover, and the contributor is told
 * they are being followed up; they can be handed in on a later day, or rejected with a reason if the cash never arrives.
 *
 * "Expected" is only the installments falling due on the business day for the collector's assigned contributors. It is an indicator: it
 * never feeds the reconcile, and arrears are shown beside it, not inside it.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { confirmContributionInTx } from './ajo-allocation.service';
import { ReconcileError, checkReconcile, formatNaira, handoverFigures, type CashLine, type ReceiptFacts } from './ajo-collections';
import { assertMayConfirm, MIN_NOTE_LENGTH } from './ajo-contribution.service';
import { createReceiptInTx, deliverReceipt } from './ajo-receipt.service';
import { businessDay, toCalendarDate } from './ajo-schedule';
import { auditAjo } from './ajo-support';

type Tx = Prisma.TransactionClient;

const handoverKey = (associationId: number, key: string) => `a${associationId}:${key}`;

async function activeGroup(db: Tx | typeof prisma, associationId: number, groupId: number) {
  const group = await db.ajoGroup.findFirst({ where: { id: groupId, associationId } });
  if (!group) throw new RuleError('That group was not found.', 404, 'GROUP_NOT_FOUND');
  return group;
}

const lineOf = (c: { id: number; amountKobo: bigint }): CashLine => ({ contributionId: c.id, amountKobo: c.amountKobo });

// ---------------------------------------------------------------------------------------------------------------------------------
// The day's summary
// ---------------------------------------------------------------------------------------------------------------------------------

export interface DaySummaryInput {
  associationId: number;
  groupId: number;
  collectorUserId: number;
  /** The business day. Defaults to today in the group's timezone. */
  forDate?: Date;
  now?: Date;
}

/** Expected, collected, in hand, handed over and difference for one collector on one business day, with arrears shown separately. */
export async function collectorDaySummary(input: DaySummaryInput) {
  const now = input.now ?? new Date();
  const group = await activeGroup(prisma, input.associationId, input.groupId);
  const day = input.forDate ? toCalendarDate(input.forDate) : businessDay(now, group.timezone, group.cutoffTime);

  const assignments = await prisma.ajoCollectorAssignment.findMany({
    where: { associationId: input.associationId, collectorUserId: input.collectorUserId, startsOn: { lte: day }, OR: [{ endsOn: null }, { endsOn: { gte: day } }], membership: { groupId: group.id, status: 'ACTIVE' } },
    include: { membership: { select: { id: true, member: { select: { firstName: true, lastName: true } } } } },
  });
  const membershipIds = assignments.map((a) => a.membershipId);

  const [dueToday, overdue, todays, carried, handover] = await Promise.all([
    prisma.ajoInstallment.findMany({ where: { membershipId: { in: membershipIds }, dueDate: day, status: { not: 'WAIVED' } }, select: { amountKobo: true } }),
    prisma.ajoInstallment.findMany({ where: { membershipId: { in: membershipIds }, dueDate: { lt: day }, status: { not: 'WAIVED' } }, select: { membershipId: true, amountKobo: true, paidKobo: true } }),
    prisma.ajoContribution.findMany({ where: { groupId: group.id, associationId: input.associationId, collectorId: input.collectorUserId, method: 'CASH', businessDate: day, status: { in: ['CASH_RECEIVED', 'CONFIRMED'] }, reversalOfId: null }, orderBy: { id: 'asc' }, include: { membership: { select: { member: { select: { firstName: true, lastName: true } } } } } }),
    prisma.ajoContribution.findMany({ where: { groupId: group.id, associationId: input.associationId, collectorId: input.collectorUserId, method: 'CASH', status: 'CASH_RECEIVED', missingFromHandover: true, NOT: { businessDate: day } }, orderBy: { id: 'asc' }, include: { membership: { select: { member: { select: { firstName: true, lastName: true } } } } } }),
    prisma.ajoCashHandover.findUnique({ where: { groupId_collectorUserId_forDate: { groupId: group.id, collectorUserId: input.collectorUserId, forDate: day } } }),
  ]);

  const nameOf = new Map(assignments.map((a) => [a.membershipId, `${a.membership.member.firstName} ${a.membership.member.lastName}`.trim()]));
  const arrears = new Map<number, bigint>();
  for (const i of overdue) {
    const left = i.amountKobo - i.paidKobo;
    if (left > 0n) arrears.set(i.membershipId, (arrears.get(i.membershipId) ?? 0n) + left);
  }

  const expectedKobo = dueToday.reduce((s, i) => s + i.amountKobo, 0n);
  const targetKobo = assignments.reduce((s, a) => s + (a.dailyTargetKobo ?? 0n), 0n);
  const collectedKobo = todays.reduce((s, c) => s + c.amountKobo, 0n);
  const carriedKobo = carried.reduce((s, c) => s + c.amountKobo, 0n);
  const handedOverKobo = handover?.handedOverKobo ?? 0n;
  const inHandKobo = handover ? handover.collectedKobo - handover.handedOverKobo : collectedKobo + carriedKobo;

  const str = (n: bigint) => n.toString();
  const person = (c: (typeof todays)[number]) => ({ contributionId: c.id, reference: c.reference, name: `${c.membership.member.firstName} ${c.membership.member.lastName}`.trim(), amountKobo: str(c.amountKobo), status: c.status, handoverId: c.handoverId });
  return {
    forDate: day,
    groupId: group.id,
    contributors: assignments.length,
    expectedKobo: str(expectedKobo),
    /** The collector's own targets for these people, when the group set any. A separate figure from what is due. */
    targetKobo: str(targetKobo),
    collectedKobo: str(collectedKobo),
    carriedOverKobo: str(carriedKobo),
    inHandKobo: str(inHandKobo),
    handedOverKobo: str(handedOverKobo),
    differenceKobo: str(handover ? handover.differenceKobo : collectedKobo + carriedKobo - handedOverKobo),
    handover: handover ? { id: handover.id, reconciled: handover.reconciledAt !== null, reconciledAt: handover.reconciledAt, note: handover.note } : null,
    payments: todays.map(person),
    carriedOver: carried.map(person),
    arrears: [...arrears.entries()].map(([membershipId, kobo]) => ({ membershipId, name: nameOf.get(membershipId) ?? '', overdueKobo: str(kobo), overdue: formatNaira(kobo) })).sort((a, b) => (BigInt(b.overdueKobo) > BigInt(a.overdueKobo) ? 1 : -1)),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Handing over
// ---------------------------------------------------------------------------------------------------------------------------------

export interface HandoverInput {
  associationId: number;
  groupId: number;
  /** The collector handing over: always the signed-in user. */
  collectorUserId: number;
  handedOverKobo: bigint;
  idempotencyKey: string;
  note?: string;
  forDate?: Date;
  now?: Date;
}

/**
 * The collector hands over the day's cash. The figures are frozen on the record: what was expected, what was collected (including cash
 * carried over from an earlier handover that came up short), what was handed over, and what is left in their hand.
 */
export async function createHandover(input: HandoverInput) {
  const now = input.now ?? new Date();
  const key = (input.idempotencyKey ?? '').trim();
  if (key.length < 8 || key.length > 120) throw new RuleError('A handover needs an idempotency key of 8 to 120 characters, so sending it twice cannot hand over twice.', 400, 'KEY_REQUIRED');
  if (typeof input.handedOverKobo !== 'bigint' || input.handedOverKobo < 0n) throw new RuleError('The amount handed over cannot be negative.', 400, 'INVALID_AMOUNT');

  const stored = handoverKey(input.associationId, key);
  const prior = await prisma.ajoCashHandover.findUnique({ where: { idempotencyKey: stored } });
  if (prior) {
    if (prior.associationId !== input.associationId || prior.groupId !== input.groupId || prior.collectorUserId !== input.collectorUserId || prior.handedOverKobo !== input.handedOverKobo) {
      throw new RuleError('That idempotency key was already used for a different handover.', 409, 'IDEMPOTENCY_CONFLICT');
    }
    return { handoverId: prior.id, replayed: true };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const group = await activeGroup(tx, input.associationId, input.groupId);
        if (group.status !== 'ACTIVE') throw new RuleError('This group is not running, so there is nothing to hand over.', 409, 'GROUP_NOT_STARTED');
        const today = businessDay(now, group.timezone, group.cutoffTime);
        const forDate = input.forDate ? toCalendarDate(input.forDate) : today;
        if (forDate.getTime() > today.getTime()) throw new RuleError('You cannot hand over cash for a day that has not come yet.', 400, 'INVALID_DATE');

        // One collector hands over once at a time.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ajo-handover:' + group.id + ':' + input.collectorUserId}))`;
        const existing = await tx.ajoCashHandover.findUnique({ where: { groupId_collectorUserId_forDate: { groupId: group.id, collectorUserId: input.collectorUserId, forDate } }, select: { id: true } });
        if (existing) throw new RuleError('You have already handed over the cash for that day.', 409, 'ALREADY_HANDED_OVER');

        const lines = await tx.ajoContribution.findMany({
          where: {
            groupId: group.id,
            associationId: input.associationId,
            collectorId: input.collectorUserId,
            method: 'CASH',
            status: 'CASH_RECEIVED',
            reversalOfId: null,
            // Today's cash that has not been handed in, and cash an earlier handover found missing.
            OR: [{ businessDate: forDate, handoverId: null }, { missingFromHandover: true }],
          },
          orderBy: { id: 'asc' },
          select: { id: true, amountKobo: true },
        });
        if (!lines.length) throw new RuleError('There is no cash to hand over for that day.', 409, 'NOTHING_TO_HAND_OVER');

        let figures;
        try {
          figures = handoverFigures(lines.map(lineOf), input.handedOverKobo);
        } catch (error) {
          throw new RuleError(error instanceof Error ? error.message : 'Check the amount handed over.', 400, 'INVALID_AMOUNT');
        }

        const assigned = await tx.ajoCollectorAssignment.findMany({ where: { associationId: input.associationId, collectorUserId: input.collectorUserId, startsOn: { lte: forDate }, OR: [{ endsOn: null }, { endsOn: { gte: forDate } }], membership: { groupId: group.id, status: 'ACTIVE' } }, select: { membershipId: true, dailyTargetKobo: true } });
        const due = await tx.ajoInstallment.findMany({ where: { membershipId: { in: assigned.map((a) => a.membershipId) }, dueDate: forDate, status: { not: 'WAIVED' } }, select: { amountKobo: true } });

        const handover = await tx.ajoCashHandover.create({
          data: {
            associationId: input.associationId,
            groupId: group.id,
            collectorUserId: input.collectorUserId,
            forDate,
            expectedKobo: due.reduce((s, i) => s + i.amountKobo, 0n),
            targetKobo: assigned.reduce((s, a) => s + (a.dailyTargetKobo ?? 0n), 0n),
            collectedKobo: figures.collectedKobo,
            handedOverKobo: figures.handedOverKobo,
            differenceKobo: figures.differenceKobo,
            idempotencyKey: stored,
            note: input.note?.trim() || null,
          },
        });
        await tx.ajoContribution.updateMany({ where: { id: { in: lines.map((l) => l.id) } }, data: { handoverId: handover.id, missingFromHandover: false } });
        await auditAjo(tx, { associationId: input.associationId, userId: input.collectorUserId, action: 'AJO_HANDOVER_CREATED', tableName: 'ajo_cash_handovers', recordId: handover.id, newValues: { forDate: forDate.toISOString().slice(0, 10), collectedKobo: figures.collectedKobo.toString(), handedOverKobo: figures.handedOverKobo.toString(), differenceKobo: figures.differenceKobo.toString(), payments: lines.length } });
        return { handoverId: handover.id, replayed: false, collectedKobo: figures.collectedKobo.toString(), handedOverKobo: figures.handedOverKobo.toString(), differenceKobo: figures.differenceKobo.toString(), payments: lines.length };
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // The same handover sent twice at once: the other request won.
      const winner = await prisma.ajoCashHandover.findUnique({ where: { idempotencyKey: stored } });
      if (winner) return { handoverId: winner.id, replayed: true };
      throw new RuleError('You have already handed over the cash for that day.', 409, 'ALREADY_HANDED_OVER');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reconciling
// ---------------------------------------------------------------------------------------------------------------------------------

export interface ReconcileInput {
  associationId: number;
  handoverId: number;
  actorUserId: number;
  /** What the officer counted. */
  countedKobo: bigint;
  /** The payments actually received. Leave out to mean every payment in the handover. */
  receivedContributionIds?: number[];
  note?: string;
  confirmOwn?: boolean;
  now?: Date;
}

export async function reconcileHandover(input: ReconcileInput) {
  const now = input.now ?? new Date();
  if (typeof input.countedKobo !== 'bigint' || input.countedKobo < 0n) throw new RuleError('The cash counted cannot be negative.', 400, 'INVALID_AMOUNT');

  const receipts: number[] = [];
  const result = await prisma.$transaction(
    async (tx) => {
      // The handover is locked, so two officers reconciling it at once take turns and the second sees it already done.
      await tx.$queryRaw`SELECT id FROM ajo_cash_handovers WHERE id = ${input.handoverId} AND association_id = ${input.associationId} FOR UPDATE`;
      const h = await tx.ajoCashHandover.findFirst({ where: { id: input.handoverId, associationId: input.associationId }, include: { group: { select: { name: true } } } });
      if (!h) throw new RuleError('That handover was not found.', 404, 'HANDOVER_NOT_FOUND');
      if (h.reconciledAt) return { handoverId: h.id, replayed: true, confirmed: 0, missing: 0, countedKobo: (h.countedKobo ?? 0n).toString() };

      const self = await assertMayConfirm(tx, { associationId: input.associationId, actorUserId: input.actorUserId, conflicted: h.collectorUserId === input.actorUserId, confirmOwn: input.confirmOwn, note: input.note, what: 'handover' });

      const rows = await tx.ajoContribution.findMany({ where: { handoverId: h.id, status: 'CASH_RECEIVED' }, orderBy: { id: 'asc' }, include: { group: { select: { name: true } }, membership: { select: { member: { select: { firstName: true, lastName: true } } } } } });
      const lines = rows.map(lineOf);
      const ticked = input.receivedContributionIds ?? lines.map((l) => l.contributionId);

      let check;
      try {
        check = checkReconcile(lines, ticked, input.countedKobo);
      } catch (error) {
        if (error instanceof ReconcileError) throw new RuleError(error.message, error.code === 'COUNT_MISMATCH' ? 409 : 400, error.code);
        throw error;
      }

      const note = (input.note ?? '').trim();
      if ((check.missingIds.length > 0 || input.countedKobo !== h.handedOverKobo) && note.length < MIN_NOTE_LENGTH) {
        throw new RuleError('Something does not add up (a payment was not received, or the count differs from what the collector said they handed over). Write a note saying what happened.', 400, 'NOTE_REQUIRED');
      }

      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const id of check.receivedIds) {
        try {
          await confirmContributionInTx(tx, { associationId: input.associationId, contributionId: id, actorUserId: input.actorUserId, now, extra: { selfConfirmed: self.self, confirmNote: self.note } });
        } catch (error) {
          if (error instanceof RuleError && error.code === 'EXCEEDS_OWED') {
            throw new RuleError(`${byId.get(id)?.reference ?? 'A payment'}: ${error.message} Untick it and follow it up separately.`, 409, 'EXCEEDS_OWED');
          }
          throw error;
        }
        const c = byId.get(id)!;
        const facts: ReceiptFacts = { moment: 'CONFIRMED', method: 'CASH', amountKobo: c.amountKobo, groupName: c.group.name, reference: c.reference };
        const made = await createReceiptInTx(tx, { associationId: input.associationId, contributionId: id, facts });
        if (made.created) receipts.push(made.id);
      }
      if (check.missingIds.length) {
        await tx.ajoContribution.updateMany({ where: { id: { in: check.missingIds }, status: 'CASH_RECEIVED' }, data: { missingFromHandover: true } });
        for (const id of check.missingIds) {
          const c = byId.get(id)!;
          const facts: ReceiptFacts = { moment: 'MISSING', method: 'CASH', amountKobo: c.amountKobo, groupName: c.group.name, reference: c.reference };
          const made = await createReceiptInTx(tx, { associationId: input.associationId, contributionId: id, facts });
          if (made.created) receipts.push(made.id);
        }
      }

      await tx.ajoCashHandover.update({ where: { id: h.id }, data: { reconciledBy: input.actorUserId, reconciledAt: now, countedKobo: input.countedKobo, reconcileNote: note || null } });
      await auditAjo(tx, {
        associationId: input.associationId,
        userId: input.actorUserId,
        action: 'AJO_HANDOVER_RECONCILED',
        tableName: 'ajo_cash_handovers',
        recordId: h.id,
        newValues: { countedKobo: input.countedKobo.toString(), handedOverKobo: h.handedOverKobo.toString(), confirmed: check.receivedIds.length, missing: check.missingIds.length, missingKobo: check.missingKobo.toString(), selfConfirmed: self.self, note: note || null },
      });
      return { handoverId: h.id, replayed: false, confirmed: check.receivedIds.length, missing: check.missingIds.length, confirmedKobo: check.receivedKobo.toString(), missingKobo: check.missingKobo.toString(), countedKobo: input.countedKobo.toString() };
    },
    { timeout: 60_000 },
  );

  for (const id of receipts) await deliverReceipt(id);
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------------------------------------------

export async function listHandovers(input: { associationId: number; groupId: number; reconciled?: boolean; take?: number; skip?: number }) {
  await activeGroup(prisma, input.associationId, input.groupId);
  const rows = await prisma.ajoCashHandover.findMany({
    where: { associationId: input.associationId, groupId: input.groupId, ...(input.reconciled === undefined ? {} : { reconciledAt: input.reconciled ? { not: null } : null }) },
    orderBy: [{ forDate: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.max(input.take ?? 100, 1), 200),
    skip: Math.max(input.skip ?? 0, 0),
  });
  return rows.map(handoverView);
}

export async function getHandover(input: { associationId: number; handoverId: number }) {
  const h = await prisma.ajoCashHandover.findFirst({
    where: { id: input.handoverId, associationId: input.associationId },
    include: { contributions: { orderBy: { id: 'asc' }, include: { membership: { select: { member: { select: { firstName: true, lastName: true } } } } } } },
  });
  if (!h) throw new RuleError('That handover was not found.', 404, 'HANDOVER_NOT_FOUND');
  return {
    ...handoverView(h),
    payments: h.contributions.map((c) => ({ contributionId: c.id, reference: c.reference, name: `${c.membership.member.firstName} ${c.membership.member.lastName}`.trim(), amountKobo: c.amountKobo.toString(), status: c.status, missingFromHandover: c.missingFromHandover })),
  };
}

function handoverView(h: { id: number; groupId: number; collectorUserId: number; forDate: Date; expectedKobo: bigint; targetKobo: bigint | null; collectedKobo: bigint; handedOverKobo: bigint; differenceKobo: bigint; countedKobo: bigint | null; reconciledBy: number | null; reconciledAt: Date | null; note: string | null; reconcileNote: string | null }) {
  return {
    id: h.id,
    groupId: h.groupId,
    collectorUserId: h.collectorUserId,
    forDate: h.forDate,
    expectedKobo: h.expectedKobo.toString(),
    targetKobo: h.targetKobo?.toString() ?? null,
    collectedKobo: h.collectedKobo.toString(),
    handedOverKobo: h.handedOverKobo.toString(),
    differenceKobo: h.differenceKobo.toString(),
    countedKobo: h.countedKobo?.toString() ?? null,
    reconciled: h.reconciledAt !== null,
    reconciledBy: h.reconciledBy,
    reconciledAt: h.reconciledAt,
    note: h.note,
    reconcileNote: h.reconcileNote,
  };
}
