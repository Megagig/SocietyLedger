/**
 * SocietyLedger's platform levy on Ajo groups (T5.4).
 *
 * The levy is SocietyLedger's own revenue. It is assessed from a group's schedule, kept in its own table, billed to the group admin as a
 * separate line on their next payment-taking checkout, and NEVER deducted from a payout or any contribution money. It never touches the
 * group's ledger.
 *
 *   ACCRUED → BILLED → PAID          assessed; put on a checkout; settled when that payment is verified and applied
 *   ACCRUED / BILLED → WAIVED / VOID  staff, with a reason
 *
 * An assessment is immutable except for its status: it keeps the base, the rate, the limits and the calculation in words, frozen at the
 * time. A group on an exempt tier (Starter) gets none. If the same levy is ever paid twice, the extra is kept as a CREDIT against the next.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { heldAddonCodeInFamily } from '../../services/billing/held-addon.service';
import { formatNaira as formatNairaNumber } from '../../services/billing/money';
import type { Quote, QuoteLine } from '../../services/billing/quote.service';
import { PlatformSettingsService } from '../admin/platform-settings.service';
import { RuleError } from '../finance/rule-error';
import { LEVY_OVERDUE_DAYS, describeLevy, isLevyExempt, levyAmount } from './ajo-levy';

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYABLE: Array<'ACCRUED' | 'BILLED'> = ['ACCRUED', 'BILLED'];

/** The tier of Ajo the tenant is on right now (the add-on's code), or null if it has none. Billing owns the add-on tables, so ask billing. */
export async function ajoAddonCode(_db: Db, associationId: number, now: Date): Promise<string | null> {
  return heldAddonCodeInFamily(associationId, 'ajo', now);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Assessing
// ---------------------------------------------------------------------------------------------------------------------------------

export interface AssessResult {
  exempt: boolean;
  noAddon: boolean;
  cycleKobo: bigint;
  participants: number;
  totalKobo: bigint;
}

const none = (over: Partial<AssessResult> = {}): AssessResult => ({ exempt: false, noAddon: false, cycleKobo: 0n, participants: 0, totalKobo: 0n, ...over });

/**
 * Assess the cycle levy and one participant levy for everyone active, from the schedule that was just generated. Runs in the caller's
 * transaction, once when a group starts; assessing again changes nothing (each record has a key that can exist only once).
 */
export async function assessGroupLevy(tx: Tx, input: { associationId: number; groupId: number; now: Date }): Promise<AssessResult> {
  const code = await ajoAddonCode(tx, input.associationId, input.now);
  if (!code) return none({ noAddon: true });
  const settings = await PlatformSettingsService.getSettings();
  if (isLevyExempt(code, settings.ajoLevyExemptAddonCodes)) return none({ exempt: true });

  const group = await tx.ajoGroup.findUniqueOrThrow({ where: { id: input.groupId }, select: { name: true } });
  const sums = await tx.ajoInstallment.groupBy({ by: ['membershipId'], where: { membership: { groupId: input.groupId, status: 'ACTIVE' }, status: { not: 'WAIVED' } }, _sum: { amountKobo: true } });
  const people = await tx.ajoMembership.findMany({ where: { id: { in: sums.map((s) => s.membershipId) } }, select: { id: true, member: { select: { firstName: true, lastName: true } } } });
  const nameOf = new Map(people.map((p) => [p.id, `${p.member.firstName} ${p.member.lastName}`.trim()]));

  const cycleBase = sums.reduce((s, r) => s + (r._sum.amountKobo ?? 0n), 0n);
  const cycleMin = BigInt(settings.ajoCycleLevyMinKobo);
  const cycleMax = BigInt(settings.ajoCycleLevyMaxKobo);
  const cycle = levyAmount(cycleBase, settings.ajoCycleLevyBps, cycleMin, cycleMax);

  const rows: Prisma.AjoLevyAssessmentCreateManyInput[] = [];
  if (cycle > 0n) {
    rows.push({ associationId: input.associationId, groupId: input.groupId, kind: 'CYCLE', dedupeKey: `cycle:${input.groupId}`, baseKobo: cycleBase, rateBps: settings.ajoCycleLevyBps, minKobo: cycleMin, maxKobo: cycleMax, amountKobo: cycle, addonCode: code, calculation: describeLevy({ kind: 'CYCLE', groupName: group.name, baseKobo: cycleBase, rateBps: settings.ajoCycleLevyBps, minKobo: cycleMin, maxKobo: cycleMax, amountKobo: cycle }), accruedAt: input.now });
  }
  let participants = 0;
  let total = cycle;
  const pMin = BigInt(settings.ajoParticipantLevyMinKobo);
  const pMax = BigInt(settings.ajoParticipantLevyMaxKobo);
  for (const s of sums) {
    const base = s._sum.amountKobo ?? 0n;
    const amount = levyAmount(base, settings.ajoParticipantLevyBps, pMin, pMax);
    if (amount <= 0n) continue;
    participants++;
    total += amount;
    rows.push({ associationId: input.associationId, groupId: input.groupId, membershipId: s.membershipId, kind: 'PARTICIPANT', dedupeKey: `participant:${s.membershipId}`, baseKobo: base, rateBps: settings.ajoParticipantLevyBps, minKobo: pMin, maxKobo: pMax, amountKobo: amount, addonCode: code, calculation: describeLevy({ kind: 'PARTICIPANT', groupName: group.name, who: nameOf.get(s.membershipId), baseKobo: base, rateBps: settings.ajoParticipantLevyBps, minKobo: pMin, maxKobo: pMax, amountKobo: amount }), accruedAt: input.now });
  }
  if (rows.length) await tx.ajoLevyAssessment.createMany({ data: rows, skipDuplicates: true });
  return none({ cycleKobo: cycle, participants, totalKobo: total });
}

/** Someone who joins a running collector-thrift group owes a participant levy on their own schedule. The cycle levy is not adjusted. */
export async function assessParticipantLevy(tx: Tx, input: { associationId: number; groupId: number; membershipId: number; now: Date }): Promise<bigint> {
  const code = await ajoAddonCode(tx, input.associationId, input.now);
  if (!code) return 0n;
  const settings = await PlatformSettingsService.getSettings();
  if (isLevyExempt(code, settings.ajoLevyExemptAddonCodes)) return 0n;
  const agg = await tx.ajoInstallment.aggregate({ where: { membershipId: input.membershipId, status: { not: 'WAIVED' } }, _sum: { amountKobo: true } });
  const base = agg._sum.amountKobo ?? 0n;
  const pMin = BigInt(settings.ajoParticipantLevyMinKobo);
  const pMax = BigInt(settings.ajoParticipantLevyMaxKobo);
  const amount = levyAmount(base, settings.ajoParticipantLevyBps, pMin, pMax);
  if (amount <= 0n) return 0n;
  const m = await tx.ajoMembership.findUniqueOrThrow({ where: { id: input.membershipId }, select: { group: { select: { name: true } }, member: { select: { firstName: true, lastName: true } } } });
  await tx.ajoLevyAssessment.createMany({
    data: [{ associationId: input.associationId, groupId: input.groupId, membershipId: input.membershipId, kind: 'PARTICIPANT', dedupeKey: `participant:${input.membershipId}`, baseKobo: base, rateBps: settings.ajoParticipantLevyBps, minKobo: pMin, maxKobo: pMax, amountKobo: amount, addonCode: code, calculation: describeLevy({ kind: 'PARTICIPANT', groupName: m.group.name, who: `${m.member.firstName} ${m.member.lastName}`.trim(), baseKobo: base, rateBps: settings.ajoParticipantLevyBps, minKobo: pMin, maxKobo: pMax, amountKobo: amount }), accruedAt: input.now }],
    skipDuplicates: true,
  });
  return amount;
}

/** A group cancelled before any money was confirmed owes no levy: its not-yet-billed assessments are voided. */
export async function voidUnbilledLevyForGroup(tx: Tx, input: { groupId: number; reason: string; actorUserId: number; now: Date }): Promise<number> {
  const done = await tx.ajoLevyAssessment.updateMany({ where: { groupId: input.groupId, status: 'ACCRUED', kind: { not: 'CREDIT' } }, data: { status: 'VOID', statusReason: input.reason, statusBy: input.actorUserId, statusAt: input.now } });
  return done.count;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The 60-day rule
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Unpaid levy more than 60 days old stops the group's admin starting a NEW group, and nothing else: a group's records, contributions,
 * payouts, reading and exporting are the group's own money and are never blocked.
 */
export async function assertNoOverdueLevy(db: Db, associationId: number, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - LEVY_OVERDUE_DAYS * DAY_MS);
  const agg = await db.ajoLevyAssessment.aggregate({ where: { associationId, status: { in: PAYABLE }, kind: { not: 'CREDIT' }, accruedAt: { lt: cutoff } }, _sum: { amountKobo: true } });
  const owed = agg._sum.amountKobo ?? 0n;
  if (owed > 0n) {
    throw new RuleError(`SocietyLedger’s platform levy of ${formatNairaNumber(Number(owed))} has been unpaid for more than ${LEVY_OVERDUE_DAYS} days, so a new group cannot be started. Your existing groups are not affected. It is added to your next subscription or add-on payment; pay that, or ask SocietyLedger support.`, 403, 'LEVY_OVERDUE');
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// On the checkout
// ---------------------------------------------------------------------------------------------------------------------------------

export interface LevyOnQuote {
  assessmentIds: number[];
  /** What the levy part of the quote adds (never negative). */
  totalKobo: number;
}

/**
 * Add the levy owed to a payment-taking quote as its own labelled lines, itemised per group, with any credit. The levy is outside the plan
 * and add-on shares (the billing code only counts PLAN, ADDON and CREDIT lines against those), so subscription money and levy money never
 * mix. Read-only: nothing is claimed until a payment is actually started (`markLevyBilled`).
 */
export async function attachLevyToQuote(associationId: number, quote: Quote): Promise<Quote> {
  if (quote.deferred) return quote;
  const owed = await prisma.ajoLevyAssessment.findMany({ where: { associationId, status: { in: PAYABLE } }, orderBy: { id: 'asc' } });
  const charges = owed.filter((r) => r.kind !== 'CREDIT' && r.amountKobo > 0n);
  if (!charges.length) return quote;

  const groups = await prisma.ajoGroup.findMany({ where: { id: { in: [...new Set(charges.map((c) => c.groupId))] } }, select: { id: true, name: true } });
  const nameOf = new Map(groups.map((g) => [g.id, g.name]));
  const perGroup = new Map<number, { count: number; kobo: bigint }>();
  for (const c of charges) {
    const cur = perGroup.get(c.groupId) ?? { count: 0, kobo: 0n };
    perGroup.set(c.groupId, { count: cur.count + 1, kobo: cur.kobo + c.amountKobo });
  }

  let levyTotal = charges.reduce((s, c) => s + c.amountKobo, 0n);
  // A credit (a levy paid twice) is used while it still leaves the levy at zero or more.
  const credits = owed.filter((r) => r.kind === 'CREDIT' && r.amountKobo < 0n);
  const usedCredits: typeof credits = [];
  for (const c of credits) {
    if (levyTotal + c.amountKobo >= 0n) {
      levyTotal += c.amountKobo;
      usedCredits.push(c);
    }
  }

  const lines: QuoteLine[] = [...perGroup.entries()].map(([groupId, v]) => ({
    type: 'LEVY' as QuoteLine['type'],
    label: `Ajo platform levy, ${nameOf.get(groupId) ?? 'group'} (${v.count} charge${v.count === 1 ? '' : 's'})`,
    amountKobo: Number(v.kobo),
    amount: formatNairaNumber(Number(v.kobo)),
  }));
  const creditTotal = usedCredits.reduce((s, c) => s + c.amountKobo, 0n);
  if (usedCredits.length) lines.push({ type: 'LEVY' as QuoteLine['type'], label: 'Ajo platform levy credit (paid twice before)', amountKobo: Number(creditTotal), amount: formatNairaNumber(Number(creditTotal)) });

  const totalKobo = quote.totalKobo + Number(levyTotal);
  return { ...quote, lines: [...quote.lines, ...lines], totalKobo, total: formatNairaNumber(totalKobo), levy: { assessmentIds: [...charges.map((c) => c.id), ...usedCredits.map((c) => c.id)], totalKobo: Number(levyTotal) } };
}

/** A payment has been started with these on it. Claimed again by a later checkout if this one is abandoned. */
export async function markLevyBilled(db: Db, assessmentIds: number[], paymentHistoryId: number): Promise<void> {
  if (!assessmentIds.length) return;
  await db.ajoLevyAssessment.updateMany({ where: { id: { in: assessmentIds }, status: { in: PAYABLE } }, data: { status: 'BILLED', billedPaymentId: paymentHistoryId } });
}

/**
 * The payment that carried a levy has been verified and applied. Mark each assessment paid. Anything on that payment that is no longer
 * payable (it was paid by another payment, or staff waived it after the checkout began) was paid for nothing: the extra is kept as a credit
 * against the next levy, never lost. Runs in the same transaction that applies the payment.
 */
export async function settleLevyInTx(tx: Tx, input: { quote: { levy?: LevyOnQuote }; paymentHistoryId: number; now: Date }): Promise<{ paid: number; credited: number }> {
  const ids = input.quote.levy?.assessmentIds ?? [];
  if (!ids.length) return { paid: 0, credited: 0 };
  const rows = await tx.ajoLevyAssessment.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  let paid = 0;
  let credited = 0;
  for (const r of rows) {
    const claimed = await tx.ajoLevyAssessment.updateMany({ where: { id: r.id, status: { in: PAYABLE } }, data: { status: 'PAID', paidPaymentId: input.paymentHistoryId, statusAt: input.now } });
    if (claimed.count === 1) {
      paid++;
      continue;
    }
    // Already settled by this very payment (it was applied before): nothing to do, and certainly not a credit.
    if (r.paidPaymentId === input.paymentHistoryId) continue;
    if (r.kind === 'CREDIT') continue; // a credit someone else already used: nothing more can be done here
    credited++;
    await tx.ajoLevyAssessment.createMany({
      data: [{ associationId: r.associationId, groupId: r.groupId, kind: 'CREDIT', dedupeKey: `credit:${input.paymentHistoryId}:${r.id}`, baseKobo: 0n, rateBps: 0, minKobo: 0n, maxKobo: 0n, amountKobo: -r.amountKobo, addonCode: r.addonCode, calculation: `A credit of ${formatNairaNumber(Number(r.amountKobo))}: a levy charge was paid again after it was already settled or waived. It is taken off your next levy.`, accruedAt: input.now }],
      skipDuplicates: true,
    });
  }
  return { paid, credited };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------------------------------------------------------------

type AssessmentRow = Awaited<ReturnType<typeof prisma.ajoLevyAssessment.findFirstOrThrow>>;

export function toLevyView(r: AssessmentRow) {
  return {
    id: r.id,
    associationId: r.associationId,
    groupId: r.groupId,
    membershipId: r.membershipId,
    kind: r.kind,
    status: r.status,
    baseKobo: r.baseKobo.toString(),
    rateBps: r.rateBps,
    minKobo: r.minKobo.toString(),
    maxKobo: r.maxKobo.toString(),
    amountKobo: r.amountKobo.toString(),
    amount: formatNairaNumber(Number(r.amountKobo)),
    addonCode: r.addonCode,
    calculation: r.calculation,
    billedPaymentId: r.billedPaymentId,
    paidPaymentId: r.paidPaymentId,
    statusReason: r.statusReason,
    accruedAt: r.accruedAt,
    statusAt: r.statusAt,
  };
}

export async function listLevy(input: { status?: string; associationId?: number; groupId?: number; take?: number; skip?: number }) {
  const where: Prisma.AjoLevyAssessmentWhereInput = { ...(input.status ? { status: input.status as never } : {}), ...(input.associationId ? { associationId: input.associationId } : {}), ...(input.groupId ? { groupId: input.groupId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.ajoLevyAssessment.findMany({ where, orderBy: { id: 'desc' }, take: Math.min(Math.max(input.take ?? 50, 1), 200), skip: Math.max(input.skip ?? 0, 0) }),
    prisma.ajoLevyAssessment.count({ where }),
  ]);
  return { total, items: rows.map(toLevyView) };
}

/** The levy per association and status, in one place and apart from subscription payments. */
export async function levyReport(input: { associationId?: number } = {}) {
  const grouped = await prisma.ajoLevyAssessment.groupBy({ by: ['associationId', 'status'], where: input.associationId ? { associationId: input.associationId } : {}, _sum: { amountKobo: true }, _count: { _all: true } });
  const names = await prisma.association.findMany({ where: { id: { in: [...new Set(grouped.map((g) => g.associationId))] } }, select: { id: true, name: true } });
  const nameOf = new Map(names.map((a) => [a.id, a.name]));
  const byAssociation = new Map<number, { associationId: number; name: string; totals: Record<string, { count: number; kobo: string }> }>();
  const grand: Record<string, bigint> = {};
  for (const g of grouped) {
    const entry = byAssociation.get(g.associationId) ?? { associationId: g.associationId, name: nameOf.get(g.associationId) ?? '', totals: {} };
    const sum = g._sum.amountKobo ?? 0n;
    entry.totals[g.status] = { count: g._count._all, kobo: sum.toString() };
    byAssociation.set(g.associationId, entry);
    grand[g.status] = (grand[g.status] ?? 0n) + sum;
  }
  return { associations: [...byAssociation.values()], totals: Object.fromEntries(Object.entries(grand).map(([k, v]) => [k, { kobo: v.toString(), amount: formatNairaNumber(Number(v)) }])) };
}

/** Staff waive or void a levy that is still owed, with a reason. A paid levy is not changed here. */
export async function setLevyStatus(input: { id: number; to: 'WAIVED' | 'VOID'; reason: string; staffId: number; staffRole: string; ipAddress?: string; userAgent?: string; now?: Date }) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < 10) throw new RuleError('Give a reason of at least 10 characters. It stays on the record.', 400, 'REASON_REQUIRED');
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const r = await tx.ajoLevyAssessment.findUnique({ where: { id: input.id } });
    if (!r) throw new RuleError('That levy was not found.', 404, 'LEVY_NOT_FOUND');
    if (r.status === input.to) return { levy: toLevyView(r), replayed: true };
    if (!PAYABLE.includes(r.status as 'ACCRUED' | 'BILLED')) throw new RuleError(`A ${r.status.toLowerCase()} levy cannot be changed.`, 409, 'INVALID_LEVY_STATE');
    const won = await tx.ajoLevyAssessment.updateMany({ where: { id: r.id, status: { in: PAYABLE } }, data: { status: input.to, statusReason: reason, statusBy: input.staffId, statusAt: now } });
    if (won.count !== 1) throw new RuleError('This levy was just changed by someone else.', 409, 'INVALID_LEVY_STATE');
    await tx.platformActionLog.create({
      data: { actorId: input.staffId, actorRole: input.staffRole, actionType: input.to === 'WAIVED' ? 'AJO_LEVY_WAIVED' : 'AJO_LEVY_VOIDED', targetType: 'ajo_levy', targetId: r.id, associationId: r.associationId, beforeState: { status: r.status }, afterState: { status: input.to, amountKobo: r.amountKobo.toString() }, reason, ipAddress: input.ipAddress, userAgent: input.userAgent },
    });
    return { levy: toLevyView(await tx.ajoLevyAssessment.findUniqueOrThrow({ where: { id: r.id } })), replayed: false };
  });
}

/** What a group's admin can see about the levy their groups owe: each charge with its calculation. */
export async function listAssociationLevy(associationId: number) {
  const rows = await prisma.ajoLevyAssessment.findMany({ where: { associationId }, orderBy: { id: 'desc' }, take: 200 });
  const owed = rows.filter((r) => PAYABLE.includes(r.status as 'ACCRUED' | 'BILLED')).reduce((s, r) => s + r.amountKobo, 0n);
  return { owedKobo: owed.toString(), owed: formatNairaNumber(Number(owed)), items: rows.map(toLevyView) };
}
