/**
 * The Circle board (spec §16.4): what every member of a rotating pot may see about their own circle, and nothing else.
 *
 * Member-safe by construction. Nothing here returns a database row. Every view is built from an explicit list of allowed fields, so a
 * phone number, email, address, bank account, guarantor detail, note or proof link cannot reach a response by accident, and a test fails
 * if one ever does. Statuses and totals come from `ajo-status.ts`, the same functions the officer screens use.
 *
 * Who sees what:
 *  - A rotating pot only. A collector-thrift scheme answers BOARD_NOT_AVAILABLE: other savers' money never affects a saver's payout.
 *  - A member of the circle, or an officer. Anyone else gets "not found", the same answer as for a circle that does not exist.
 *  - The latest rule version must have `memberVisibility = FULL` for members. Officers can always see it.
 *  - A member shows by name only once they have accepted a rule version that says so; until then they are "Member 7" to other members.
 */
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { formatNaira } from './ajo-collections';
import { balanceKobo } from './ajo-ledger.service';
import { addDays, versionInForceOn } from './ajo-risk';
import { businessDay, dayInZone, describeCadence, toCalendarDate, type Frequency } from './ajo-schedule';
import { emptyCounts, onTimeBps, paymentStatus, spreadReported, statusSortRank, STATUS_LABEL, summariseRound, isPaid, type PaymentState, type PaymentStatus } from './ajo-status';

const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (from: Date, to: Date) => Math.round((toCalendarDate(to).getTime() - toCalendarDate(from).getTime()) / DAY_MS);
const lastFour = (text: string | null | undefined) => (text ? text.slice(-4) : null);
const k = (kobo: bigint) => kobo.toString();

export const BOARD_NOT_AVAILABLE = 'BOARD_NOT_AVAILABLE';
export const BOARD_OFF = 'BOARD_OFF';
/** Reported payments that wait longer than this are shown to members as late confirmations (spec D5). */
export const CONFIRM_TARGET_HOURS = 48;

export interface BoardViewer {
  userId: number;
  /** Holds ajo.manage, ajo.reconcile or ajo.approve_payout. */
  isOfficer: boolean;
}

interface Cell {
  membershipId: number;
  round: number;
  installmentId: number;
  dueDate: Date;
  amountKobo: bigint;
  paidKobo: bigint;
  reportedKobo: bigint;
  state: PaymentState;
  completedOn: Date | null;
  confirmedAt: Date | null;
  method: 'CASH' | 'TRANSFER' | null;
  receiptLast4: string | null;
}

interface Person {
  membershipId: number;
  memberId: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  shares: number;
  status: string;
  joinedAt: Date | null;
  /** Accepted a rule version with the board on, so other members may see their name. */
  consented: boolean;
  verified: boolean;
  positions: number[];
  ordinal: number;
}

interface Board {
  group: NonNullable<Awaited<ReturnType<typeof loadGroup>>>;
  viewer: BoardViewer;
  now: Date;
  today: Date;
  nameDisplay: 'FIRST_INITIAL' | 'FULL';
  people: Person[];
  rounds: Date[];
  /** Index into `rounds` of the round now being collected, or null once every round is past. */
  currentIdx: number | null;
  cells: Cell[];
  payouts: Array<{ id: number; membershipId: number; round: number | null; status: string; netKobo: bigint; grossKobo: bigint; sequence: number; approvedBy: number | null; approvedAt: Date | null; paidRecordedBy: number | null; paidAt: Date | null; paidReference: string | null }>;
  userNames: Map<number, string>;
}

async function loadGroup(associationId: number, groupId: number) {
  return prisma.ajoGroup.findFirst({ where: { id: groupId, associationId } });
}

/** "Adaeze O." or the full name. */
export function shownName(first: string, last: string, style: 'FIRST_INITIAL' | 'FULL'): string {
  const f = first.trim();
  const l = last.trim();
  if (style === 'FULL') return [f, l].filter(Boolean).join(' ') || 'Member';
  return l ? `${f} ${l.charAt(0).toUpperCase()}.` : f || 'Member';
}

/** Who a reader sees: their own name always, an officer sees everyone's, another member sees only people who consented. */
function nameFor(board: Board, person: Person): string {
  const mine = person.userId !== null && person.userId === board.viewer.userId;
  if (mine || board.viewer.isOfficer || person.consented) return shownName(person.firstName, person.lastName, board.nameDisplay);
  return `Member ${person.ordinal}`;
}
const isMine = (board: Board, person: Person) => person.userId !== null && person.userId === board.viewer.userId;

/** An officer's name for "confirmed by" lines: first name and last initial, never more. */
const officerName = (board: Board, userId: number | null) => (userId === null ? null : board.userNames.get(userId) ?? 'An officer');

async function loadBoard(input: { associationId: number; groupId: number; viewer: BoardViewer; now?: Date }): Promise<Board> {
  const now = input.now ?? new Date();
  const group = await loadGroup(input.associationId, input.groupId);
  const notFound = () => new RuleError('That circle was not found.', 404, 'GROUP_NOT_FOUND');
  if (!group) throw notFound();
  if (!input.viewer.isOfficer) {
    const mine = await prisma.ajoMembership.findFirst({ where: { groupId: group.id, status: { not: 'LEFT' }, member: { userId: input.viewer.userId } }, select: { id: true } });
    if (!mine) throw notFound();
  }
  if (group.model !== 'ROTATING_POT') throw new RuleError('Only a rotating pot has a circle board. A collector-thrift saver sees their own savings.', 403, BOARD_NOT_AVAILABLE);

  const versions = await prisma.ajoGroupRuleVersion.findMany({ where: { groupId: group.id }, orderBy: { version: 'asc' } });
  const inEffect = versions.filter((v) => v.effectiveFrom.getTime() <= now.getTime());
  const current = inEffect[inEffect.length - 1] ?? versions[versions.length - 1] ?? null;
  if (!input.viewer.isOfficer && current?.memberVisibility !== 'FULL') throw new RuleError('The admin has not turned on the circle board for this circle.', 403, BOARD_OFF);
  const nameDisplay = (current?.nameDisplay as 'FIRST_INITIAL' | 'FULL' | undefined) ?? 'FIRST_INITIAL';
  const visibleVersionIds = new Set(versions.filter((v) => v.memberVisibility === 'FULL').map((v) => v.id));

  const memberships = await prisma.ajoMembership.findMany({
    where: { groupId: group.id },
    orderBy: { id: 'asc' },
    select: {
      id: true, memberId: true, shares: true, status: true, joinedAt: true,
      member: { select: { firstName: true, lastName: true, userId: true } },
      acceptances: { select: { ruleVersionId: true, acceptedAt: true } },
      slots: { select: { position: true } },
    },
  });
  const verifiedRows = await prisma.ajoVerification.findMany({ where: { memberId: { in: memberships.map((m) => m.memberId) }, status: 'VERIFIED' }, select: { memberId: true } });
  const verified = new Set(verifiedRows.map((v) => v.memberId));
  const people: Person[] = memberships.map((m, i) => ({
    membershipId: m.id, memberId: m.memberId, userId: m.member.userId, firstName: m.member.firstName, lastName: m.member.lastName, shares: m.shares, status: m.status, joinedAt: m.joinedAt,
    consented: m.acceptances.some((a) => visibleVersionIds.has(a.ruleVersionId)), verified: verified.has(m.memberId), positions: m.slots.map((s) => s.position).sort((a, b) => a - b), ordinal: i + 1,
  }));

  const installments = await prisma.ajoInstallment.findMany({ where: { membershipId: { in: people.map((p) => p.membershipId) } }, orderBy: { dueDate: 'asc' }, select: { id: true, membershipId: true, dueDate: true, amountKobo: true, paidKobo: true, status: true } });
  const rounds = [...new Set(installments.map((i) => iso(i.dueDate)))].sort().map((d) => new Date(`${d}T00:00:00.000Z`));
  const roundNo = new Map(rounds.map((d, i) => [iso(d), i + 1]));
  const today = businessDay(now, group.timezone, group.cutoffTime);
  const idx = rounds.findIndex((d) => d.getTime() >= today.getTime());
  const currentIdx = idx === -1 ? null : idx;

  // Money waiting for an officer, spread over each member's unpaid rounds oldest first, the way confirming it would.
  const pending = await prisma.ajoContribution.groupBy({ by: ['membershipId'], where: { groupId: group.id, status: { in: ['REPORTED', 'CASH_RECEIVED'] } }, _sum: { amountKobo: true } });
  const pendingBy = new Map(pending.map((p) => [p.membershipId, p._sum.amountKobo ?? 0n]));

  // The confirmed payment that completed a round: which day it counted for, when it was confirmed, how, and its reference (last 4 only).
  const allocations = await prisma.ajoContributionAllocation.findMany({
    where: { installmentId: { in: installments.map((i) => i.id) }, contribution: { status: 'CONFIRMED', reversedBy: { is: null } } },
    select: { installmentId: true, contribution: { select: { businessDate: true, confirmedAt: true, method: true, reference: true } } },
  });
  const lastPayment = new Map<number, (typeof allocations)[number]['contribution']>();
  for (const a of allocations) {
    if (a.installmentId === null) continue;
    const have = lastPayment.get(a.installmentId);
    const when = (c: typeof a.contribution) => (c.businessDate ?? c.confirmedAt ?? new Date(0)).getTime();
    if (!have || when(a.contribution) >= when(have)) lastPayment.set(a.installmentId, a.contribution);
  }

  const disputes = await prisma.ajoDispute.findMany({ where: { membershipId: { in: people.map((p) => p.membershipId) }, status: 'OPEN' }, select: { installmentId: true, contribution: { select: { installmentId: true } } } });
  const disputed = new Set<number>();
  for (const d of disputes) {
    const target = d.installmentId ?? d.contribution?.installmentId ?? null;
    if (target !== null) disputed.add(target);
  }

  const acceptances = new Map(memberships.map((m) => [m.id, m.acceptances]));
  const versionRefs = versions.map((v) => ({ id: v.id, version: v.version, effectiveFrom: v.effectiveFrom }));
  const graceOf = new Map(versions.map((v) => [v.id, v.graceDays]));
  const fallbackGrace = versions[0]?.graceDays ?? 3;

  const cells: Cell[] = [];
  for (const person of people) {
    const mine = installments.filter((i) => i.membershipId === person.membershipId);
    const spread = spreadReported(mine.map((i) => ({ amountKobo: i.amountKobo, paidKobo: i.paidKobo, waived: i.status === 'WAIVED' })), pendingBy.get(person.membershipId) ?? 0n);
    mine.forEach((inst, n) => {
      const round = roundNo.get(iso(inst.dueDate)) ?? 0;
      const paidWith = lastPayment.get(inst.id) ?? null;
      const completedOn = inst.paidKobo >= inst.amountKobo && paidWith ? (paidWith.businessDate ?? (paidWith.confirmedAt ? dayInZone(paidWith.confirmedAt, group.timezone) : null)) : null;
      const versionId = versionInForceOn(inst.dueDate, versionRefs, acceptances.get(person.membershipId) ?? []);
      const state = paymentStatus(
        { dueDate: inst.dueDate, amountKobo: inst.amountKobo, paidKobo: inst.paidKobo, reportedKobo: spread[n] ?? 0n, waived: inst.status === 'WAIVED', completedOn, disputed: disputed.has(inst.id), graceDays: versionId !== null ? graceOf.get(versionId) ?? fallbackGrace : fallbackGrace, isCurrentRound: currentIdx !== null && round === currentIdx + 1 },
        today,
      );
      cells.push({ membershipId: person.membershipId, round, installmentId: inst.id, dueDate: inst.dueDate, amountKobo: inst.amountKobo, paidKobo: inst.paidKobo, reportedKobo: spread[n] ?? 0n, state, completedOn, confirmedAt: paidWith?.confirmedAt ?? null, method: paidWith ? (paidWith.method as 'CASH' | 'TRANSFER') : null, receiptLast4: lastFour(paidWith?.reference) });
    });
  }

  const payouts = await prisma.ajoPayout.findMany({
    where: { groupId: group.id, status: { in: ['PREPARED', 'APPROVED', 'PAID'] } },
    orderBy: [{ round: 'asc' }, { sequence: 'asc' }],
    select: { id: true, membershipId: true, round: true, status: true, netKobo: true, grossKobo: true, sequence: true, approvedBy: true, approvedAt: true, paidRecordedBy: true, paidAt: true, paidReference: true },
  });

  // Officers are named by first name and last initial only.
  const userIds = new Set<number>();
  for (const p of payouts) [p.approvedBy, p.paidRecordedBy].forEach((u) => u !== null && userIds.add(u));
  const confirmers = await prisma.ajoContribution.findMany({ where: { groupId: group.id, confirmedBy: { not: null } }, select: { confirmedBy: true }, distinct: ['confirmedBy'] });
  confirmers.forEach((c) => c.confirmedBy !== null && userIds.add(c.confirmedBy));
  const events = await prisma.ajoPayoutOrderEvent.findMany({ where: { groupId: group.id, type: { in: ['SWAP', 'EXCEPTION'] } }, select: { approvedBy: true } });
  events.forEach((e) => e.approvedBy !== null && userIds.add(e.approvedBy));
  const named = await prisma.member.findMany({ where: { associationId: input.associationId, userId: { in: [...userIds] } }, select: { userId: true, firstName: true, lastName: true } });
  const userNames = new Map(named.filter((m) => m.userId !== null).map((m) => [m.userId as number, shownName(m.firstName, m.lastName, 'FIRST_INITIAL')]));

  return { group, viewer: input.viewer, now, today, nameDisplay, people, rounds, currentIdx, cells, payouts, userNames };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------------------------------------------

const cellsOfRound = (b: Board, round: number) => b.cells.filter((c) => c.round === round);
const personOf = (b: Board, membershipId: number) => b.people.find((p) => p.membershipId === membershipId) as Person;
const currentRound = (b: Board): number => (b.currentIdx !== null ? b.currentIdx + 1 : b.rounds.length);
const roundSummary = (b: Board, round: number) => summariseRound(cellsOfRound(b, round).map((c) => ({ amountKobo: c.amountKobo, paidKobo: c.paidKobo, status: c.state.status })));

function summaryDto(s: ReturnType<typeof summariseRound>) {
  return { expectedCount: s.expectedCount, paidCount: s.paidCount, expectedKobo: k(s.expectedKobo), collectedKobo: k(s.collectedKobo), collectionBps: s.collectionBps, counts: s.counts };
}

function statusDto(c: Cell) {
  return { status: c.state.status, label: STATUS_LABEL[c.state.status], graceEndsOn: c.state.graceEndsOn ? iso(c.state.graceEndsOn) : null, behindKobo: k(c.state.behindKobo), daysLate: c.state.daysLate };
}

type PayoutState = { status: 'UPCOMING' | 'PREPARED' | 'APPROVED' | 'PAID' | 'HELD'; holdReason: string | null };

/** Where one position's payout stands, and when it is held, why, in a category that gives away nothing private. */
async function payoutStates(b: Board): Promise<Map<number, PayoutState>> {
  const slots = await prisma.ajoPayoutSlot.findMany({ where: { groupId: b.group.id }, select: { position: true, membershipId: true } });
  const withAccount = new Set((await prisma.ajoPayoutAccount.findMany({ where: { memberId: { in: b.people.map((p) => p.memberId) } }, select: { memberId: true } })).map((a) => a.memberId));
  const states = new Map<number, PayoutState>();
  for (const slot of slots) {
    const made = b.payouts.filter((p) => p.round === slot.position);
    const best = made.find((p) => p.status === 'PAID') ?? made.find((p) => p.status === 'APPROVED') ?? made.find((p) => p.status === 'PREPARED');
    if (best) {
      states.set(slot.position, { status: best.status as 'PREPARED' | 'APPROVED' | 'PAID', holdReason: null });
      continue;
    }
    const dueDate = b.rounds[slot.position - 1];
    const reached = dueDate ? toCalendarDate(b.today).getTime() >= dueDate.getTime() : false;
    if (!reached) {
      states.set(slot.position, { status: 'UPCOMING', holdReason: null });
      continue;
    }
    const person = personOf(b, slot.membershipId);
    const round = roundSummary(b, slot.position);
    const reason = !person.verified ? 'Waiting for SocietyLedger verification' : !withAccount.has(person.memberId) ? 'Waiting for the recipient to add a payout account' : round.collectedKobo < round.expectedKobo ? 'Round not fully collected' : 'Waiting for the officers to prepare it';
    states.set(slot.position, { status: 'HELD', holdReason: reason });
  }
  return states;
}

function dayPhrase(days: number): string {
  if (days === 0) return 'today';
  return days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} ago`;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The views
// ---------------------------------------------------------------------------------------------------------------------------------

/** 4.1 Overview: header, this round, up next, you, and the health strip. */
export async function boardOverview(input: { associationId: number; groupId: number; viewer: BoardViewer; now?: Date }) {
  const b = await loadBoard(input);
  const g = b.group;
  const round = currentRound(b);
  const states = await payoutStates(b);
  const rows = cellsOfRound(b, round);
  const dueDate = b.rounds[round - 1] ?? null;
  const summary = roundSummary(b, round);

  const slot = await prisma.ajoPayoutSlot.findFirst({ where: { groupId: g.id, position: round }, select: { membershipId: true, position: true } });
  const upNext = slot ? { position: slot.position, recipient: nameFor(b, personOf(b, slot.membershipId)), isYou: isMine(b, personOf(b, slot.membershipId)), scheduledOn: dueDate ? iso(dueDate) : null, status: states.get(slot.position)?.status ?? 'UPCOMING', holdReason: states.get(slot.position)?.holdReason ?? null } : null;

  const me = b.people.find((p) => isMine(b, p) && p.status !== 'LEFT') ?? null;
  const youCells = me ? b.cells.filter((c) => c.membershipId === me.membershipId) : [];
  const youNow = youCells.find((c) => c.round === round) ?? null;
  const youBehind = youCells.reduce((sum, c) => sum + (c.state.status === 'OVERDUE' || c.state.status === 'MISSED' ? c.state.behindKobo : 0n), 0n);
  const you = me
    ? { thisRound: youNow ? statusDto(youNow) : null, shares: me.shares, positions: me.positions.map((p) => ({ position: p, scheduledOn: b.rounds[p - 1] ? iso(b.rounds[p - 1] as Date) : null, status: states.get(p)?.status ?? 'UPCOMING' })), behindKobo: k(youBehind), upToDate: youBehind === 0n }
    : null;

  const allCounts = emptyCounts();
  b.cells.forEach((c) => (allCounts[c.state.status] += 1));
  const roundsCompleted = b.rounds.filter((d, i) => d.getTime() < toCalendarDate(b.today).getTime() && roundSummary(b, i + 1).collectedKobo >= roundSummary(b, i + 1).expectedKobo).length;
  const paidOut = b.payouts.filter((p) => p.status === 'PAID');

  return {
    header: { name: g.name, status: g.status, round, totalRounds: g.rounds ?? b.rounds.length, contributionPerShareKobo: k(g.contributionKobo), frequency: g.frequency, cadence: describeCadence(g.frequency as Frequency, { intervalCount: g.intervalCount, intervalUnit: g.intervalUnit }), startDate: iso(g.startDate), endsOn: g.endsOn ? iso(g.endsOn) : null, timezone: g.timezone, cutoffTime: g.cutoffTime },
    thisRound: { round, dueDate: dueDate ? iso(dueDate) : null, dueIn: dueDate ? dayPhrase(daysBetween(b.today, dueDate)) : null, ...summaryDto(summary), rows: rows.length },
    upNext,
    you,
    health: { collectionBps: summary.collectionBps, onTimeBps: onTimeBps(allCounts), roundsCompleted, totalRounds: g.rounds ?? b.rounds.length, payoutsRecordedCount: paidOut.length, payoutsRecordedKobo: k(paidOut.reduce((s, p) => s + p.netKobo, 0n)) },
    visibility: { anonymisedUntilAccepted: !b.viewer.isOfficer },
  };
}

/** 4.2 This round, or any earlier round: every member, those who still need to act first. */
export async function boardRound(input: { associationId: number; groupId: number; viewer: BoardViewer; round: number; filter?: 'ALL' | 'PAID' | 'NOT_PAID'; now?: Date }) {
  const b = await loadBoard(input);
  if (!Number.isInteger(input.round) || input.round < 1 || input.round > b.rounds.length) throw new RuleError('That round does not exist.', 404, 'ROUND_NOT_FOUND');
  const dueDate = b.rounds[input.round - 1] as Date;
  let rows = cellsOfRound(b, input.round);
  if (input.filter === 'PAID') rows = rows.filter((c) => isPaid(c.state.status));
  if (input.filter === 'NOT_PAID') rows = rows.filter((c) => !isPaid(c.state.status) && c.state.status !== 'WAIVED');
  const people = rows
    .map((c) => ({ c, p: personOf(b, c.membershipId) }))
    .sort((x, y) => statusSortRank(x.c.state.status) - statusSortRank(y.c.state.status) || nameFor(b, x.p).localeCompare(nameFor(b, y.p)))
    .map(({ c, p }) => ({ membershipId: p.membershipId, name: nameFor(b, p), isYou: isMine(b, p), shares: p.shares, ...statusDto(c), amountKobo: k(c.amountKobo), datePaid: c.completedOn ? iso(c.completedOn) : null, confirmedAt: c.confirmedAt ? c.confirmedAt.toISOString() : null, method: c.method, receiptLast4: c.receiptLast4 }));
  return { round: input.round, totalRounds: b.rounds.length, isCurrent: input.round === currentRound(b), dueDate: iso(dueDate), timezone: b.group.timezone, summary: summaryDto(roundSummary(b, input.round)), people };
}

/** 4.3 Payment history: members by rounds, with totals both ways. */
export async function boardMatrix(input: { associationId: number; groupId: number; viewer: BoardViewer; now?: Date }) {
  const b = await loadBoard(input);
  const live = b.people.filter((p) => b.cells.some((c) => c.membershipId === p.membershipId));
  return {
    timezone: b.group.timezone,
    rounds: b.rounds.map((d, i) => ({ round: i + 1, dueDate: iso(d), ...summaryDto(roundSummary(b, i + 1)) })),
    members: live.map((p) => {
      const mine = b.cells.filter((c) => c.membershipId === p.membershipId).sort((x, y) => x.round - y.round);
      const due = mine.filter((c) => c.dueDate.getTime() <= toCalendarDate(b.today).getTime() && c.state.status !== 'WAIVED');
      return { membershipId: p.membershipId, name: nameFor(b, p), isYou: isMine(b, p), shares: p.shares, roundsPaid: due.filter((c) => isPaid(c.state.status)).length, roundsDue: due.length, cells: mine.map((c) => ({ round: c.round, status: c.state.status, label: STATUS_LABEL[c.state.status], datePaid: c.completedOn ? iso(c.completedOn) : null })) };
    }),
  };
}

/** 4.4 Payouts: the order with each position's status, the draw record, and every change made since. */
export async function boardPayouts(input: { associationId: number; groupId: number; viewer: BoardViewer; now?: Date }) {
  const b = await loadBoard(input);
  const states = await payoutStates(b);
  const slots = await prisma.ajoPayoutSlot.findMany({ where: { groupId: b.group.id }, orderBy: { position: 'asc' }, select: { id: true, position: true, shareNo: true, membershipId: true } });
  const events = await prisma.ajoPayoutOrderEvent.findMany({ where: { groupId: b.group.id }, orderBy: { id: 'asc' }, select: { id: true, type: true, detail: true, reason: true, approvedBy: true, createdAt: true } });
  const draw = [...events].reverse().find((e) => e.type === (b.group.orderMethod === 'ADMIN_SET' ? 'ADMIN_SET' : 'DRAW'));
  const drawDetail = (draw?.detail ?? {}) as { seed?: string };

  const rows = slots.map((s) => {
    const person = personOf(b, s.membershipId);
    const state = states.get(s.position) ?? { status: 'UPCOMING' as const, holdReason: null };
    const made = b.payouts.filter((p) => p.round === s.position);
    const paid = made.find((p) => p.status === 'PAID') ?? null;
    const first = made[0] ?? null;
    const round = roundSummary(b, s.position);
    return {
      position: s.position, shareNo: s.shareNo, recipient: nameFor(b, person), isYou: isMine(b, person), scheduledOn: b.rounds[s.position - 1] ? iso(b.rounds[s.position - 1] as Date) : null,
      status: state.status, holdReason: state.holdReason, potKobo: k(first ? first.grossKobo : round.expectedKobo),
      recordedAt: paid?.paidAt ? paid.paidAt.toISOString() : null, referenceLast4: lastFour(paid?.paidReference), recordedBy: paid ? officerName(b, paid.paidRecordedBy) : null, approvedBy: paid ? officerName(b, paid.approvedBy) : null,
    };
  });

  const nameOfMembership = (id: number | undefined) => (id ? nameFor(b, personOf(b, id)) : null);
  const changes = events
    .filter((e) => e.type === 'SWAP' || e.type === 'EXCEPTION')
    .map((e) => {
      const d = e.detail as { a?: { membershipId: number; from: number; to: number }; b?: { membershipId: number; from: number; to: number }; membershipId?: number; from?: number; to?: number };
      if (e.type === 'SWAP') return { id: e.id, type: 'SWAP' as const, at: e.createdAt.toISOString(), approvedBy: officerName(b, e.approvedBy), reason: null, summary: `Swap approved: positions ${d.a?.from} and ${d.b?.from}`, people: [nameOfMembership(d.a?.membershipId), nameOfMembership(d.b?.membershipId)].filter((n): n is string => !!n) };
      return { id: e.id, type: 'EXCEPTION' as const, at: e.createdAt.toISOString(), approvedBy: officerName(b, e.approvedBy), reason: e.reason, summary: `Emergency exception: ${nameOfMembership(d.membershipId)} moved from position ${d.from} to ${d.to}`, people: [nameOfMembership(d.membershipId)].filter((n): n is string => !!n) };
    });

  return { timezone: b.group.timezone, drawn: !!draw, draw: draw ? { drawnAt: draw.createdAt.toISOString(), method: b.group.orderMethod, reason: draw.reason, seed: b.group.orderMethod === 'ADMIN_SET' ? null : (drawDetail.seed ?? null), howToCheck: 'The order is worked out from this seed and the list of members. Anyone can repeat the draw with the same seed and get the same order.' } : null, rows, changes };
}

/** 4.5 Members: the roster, with counts. */
export async function boardMembers(input: { associationId: number; groupId: number; viewer: BoardViewer; now?: Date }) {
  const b = await loadBoard(input);
  const shown = b.people.filter((p) => p.status !== 'LEFT' || b.cells.some((c) => c.membershipId === p.membershipId));
  const shortStatus = (s: string) => (s === 'PENDING' ? 'Pending' : s === 'LEFT' ? 'Left' : 'Active');
  const live = b.people.filter((p) => p.status !== 'LEFT');
  return {
    counts: { members: live.length, shares: live.reduce((s, p) => s + p.shares, 0), verified: live.filter((p) => p.verified).length },
    people: shown.map((p) => ({ membershipId: p.membershipId, name: nameFor(b, p), isYou: isMine(b, p), joinedOn: p.joinedAt ? iso(p.joinedAt) : null, shares: p.shares, positions: p.positions, status: shortStatus(p.status), verified: p.verified })),
  };
}

/** 4.6 Arrears and accountability. Names the facts ("Behind by ₦20,000.00"), never a label. */
export async function boardArrears(input: { associationId: number; groupId: number; viewer: BoardViewer; now?: Date }) {
  const b = await loadBoard(input);
  const received = new Map<number, number>();
  const paidSlots = await prisma.ajoPayoutSlot.findMany({ where: { groupId: b.group.id }, select: { position: true, membershipId: true } });
  for (const s of paidSlots) if (b.payouts.some((p) => p.round === s.position && p.status === 'PAID')) received.set(s.membershipId, Math.min(received.get(s.membershipId) ?? s.position, s.position));
  const onPlan = new Set((await prisma.ajoRepaymentPlan.findMany({ where: { status: 'ACTIVE', defaultCase: { groupId: b.group.id } }, select: { defaultCase: { select: { membershipId: true } } } })).map((p) => p.defaultCase.membershipId));

  const behind = b.people
    .map((p) => {
      const mine = b.cells.filter((c) => c.membershipId === p.membershipId);
      const missed = mine.filter((c) => c.state.status === 'MISSED');
      const review = mine.some((c) => c.state.status === 'UNDER_REVIEW');
      const behindKobo = mine.filter((c) => c.state.status === 'MISSED').reduce((s, c) => s + c.state.behindKobo, 0n);
      return { p, missed, review, behindKobo, days: missed.reduce((d, c) => Math.max(d, c.state.daysLate), 0) };
    })
    .filter((r) => r.missed.length > 0)
    .sort((x, y) => (y.behindKobo > x.behindKobo ? 1 : y.behindKobo < x.behindKobo ? -1 : 0))
    .map((r) => ({
      membershipId: r.p.membershipId, name: nameFor(b, r.p), isYou: isMine(b, r.p), roundsMissed: r.missed.length, behindKobo: k(r.behindKobo), behindText: `Behind by ${formatNaira(r.behindKobo)}`, daysOverdue: r.days,
      status: r.review ? 'Under review' : onPlan.has(r.p.membershipId) ? 'Repayment plan agreed' : 'Overdue',
      afterPayoutRound: received.get(r.p.membershipId) ?? null,
    }));

  const fees = await prisma.ajoLateFeeAssessment.findMany({ where: { installment: { membership: { groupId: b.group.id } } }, select: { feeKobo: true, paidKobo: true, status: true } });
  const sum = (rows: typeof fees, pick: (f: (typeof fees)[number]) => bigint) => rows.reduce((s, f) => s + pick(f), 0n);
  const waived = fees.filter((f) => f.status === 'WAIVED');
  const waiting = await prisma.ajoContribution.findMany({ where: { groupId: b.group.id, status: { in: ['REPORTED', 'CASH_RECEIVED'] } }, select: { createdAt: true }, orderBy: { createdAt: 'asc' } });
  const oldest = waiting[0] ? Math.max(0, Math.floor((b.now.getTime() - (waiting[0] as { createdAt: Date }).createdAt.getTime()) / DAY_MS)) : null;
  const late = waiting.filter((w) => b.now.getTime() - w.createdAt.getTime() > CONFIRM_TARGET_HOURS * 3600_000).length;

  return {
    behind,
    afterPayout: behind.filter((r) => r.afterPayoutRound !== null).map((r) => ({ ...r, text: `Received the pot in round ${r.afterPayoutRound} · ${r.behindText.charAt(0).toLowerCase()}${r.behindText.slice(1)}` })),
    lateFees: { chargedKobo: k(sum(fees.filter((f) => f.status !== 'WAIVED'), (f) => f.feeKobo)), waivedKobo: k(sum(waived, (f) => f.feeKobo)), paidKobo: k(sum(fees, (f) => f.paidKobo)) },
    confirmation: { waitingCount: waiting.length, oldestDays: oldest, targetHours: CONFIRM_TARGET_HOURS, pastTargetCount: late },
  };
}

/** 4.7 Charts and metrics. */
export async function boardMetrics(input: { associationId: number; groupId: number; viewer: BoardViewer; now?: Date }) {
  const b = await loadBoard(input);
  const today = toCalendarDate(b.today).getTime();
  const rounds = b.rounds.map((d, i) => ({ d, n: i + 1, s: roundSummary(b, i + 1), counts: summariseRound(cellsOfRound(b, i + 1).map((c) => ({ amountKobo: c.amountKobo, paidKobo: c.paidKobo, status: c.state.status }))).counts }));
  const past = rounds.filter((r) => r.d.getTime() <= today || r.s.collectedKobo > 0n);

  const paidPayouts = b.payouts.filter((p) => p.status === 'PAID');
  let moneyIn = 0n;
  let moneyOut = 0n;
  const cumulative = past.map((r) => {
    moneyIn += r.s.collectedKobo;
    moneyOut += paidPayouts.filter((p) => p.round === r.n).reduce((s, p) => s + p.netKobo, 0n);
    return { round: r.n, contributionsKobo: k(moneyIn), payoutsKobo: k(moneyOut) };
  });

  const slots = await prisma.ajoPayoutSlot.findMany({ where: { groupId: b.group.id }, select: { position: true } });
  const punctual = paidPayouts.filter((p) => p.round !== null && p.paidAt && b.rounds[p.round - 1] && dayInZone(p.paidAt, b.group.timezone).getTime() <= (b.rounds[p.round - 1] as Date).getTime()).length;
  const lateCells = b.cells.filter((c) => c.state.status === 'PAID_LATE');
  const avgDaysLate = lateCells.length > 0 ? Math.round((lateCells.reduce((s, c) => s + c.state.daysLate, 0) / lateCells.length) * 10) / 10 : null;
  const live = b.people.filter((p) => p.status !== 'LEFT');
  const upToDate = live.filter((p) => !b.cells.some((c) => c.membershipId === p.membershipId && (c.state.status === 'OVERDUE' || c.state.status === 'MISSED'))).length;
  const totalBehind = b.cells.filter((c) => c.state.status === 'OVERDUE' || c.state.status === 'MISSED').reduce((s, c) => s + c.state.behindKobo, 0n);
  const nextSlot = slots.map((s) => s.position).sort((a, c) => a - c).find((pos) => !paidPayouts.some((p) => p.round === pos));
  const nextDate = nextSlot ? b.rounds[nextSlot - 1] : undefined;
  const balance = await balanceKobo(prisma, { associationId: input.associationId, groupId: b.group.id });

  return {
    perRound: past.map((r) => ({ round: r.n, dueDate: iso(r.d), expectedKobo: k(r.s.expectedKobo), collectedKobo: k(r.s.collectedKobo), onTimeBps: onTimeBps(r.counts) })),
    cumulative,
    recordedBalance: { kobo: k(balance), caption: "From SocietyLedger records. Your group's bank statement is the final word." },
    statusMix: cellsOfRound(b, currentRound(b)).reduce((acc, c) => ({ ...acc, [c.state.status]: (acc[c.state.status] ?? 0) + 1 }), {} as Partial<Record<PaymentStatus, number>>),
    payoutPunctuality: { paidCount: paidPayouts.length, onScheduleCount: punctual, onScheduleBps: paidPayouts.length > 0 ? Math.round((punctual * 10_000) / paidPayouts.length) : null },
    averageDaysLate: avgDaysLate,
    membersUpToDate: { upToDate, total: live.length },
    totalBehindKobo: k(totalBehind),
    nextPayout: nextDate ? { position: nextSlot as number, scheduledOn: iso(nextDate), daysTo: daysBetween(b.today, nextDate) } : null,
  };
}

/** 4.8 Circle activity: a read-only feed, newest first. A correction is a new entry, never an edit. */
export async function boardActivity(input: { associationId: number; groupId: number; viewer: BoardViewer; limit?: number; before?: Date; now?: Date }) {
  const b = await loadBoard(input);
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  type Entry = { at: Date; kind: string; text: string };
  const entries: Entry[] = [];
  const roundOfInstallment = new Map(b.cells.map((c) => [c.installmentId, c.round]));
  const nameOfMembership = (id: number) => nameFor(b, personOf(b, id));
  const ref = (r: string | null | undefined) => (r ? ` (ref ••${r.slice(-4)})` : '');
  const when = (d: Date) => d.toISOString();

  const confirmed = await prisma.ajoContribution.findMany({ where: { groupId: b.group.id, status: 'CONFIRMED', confirmedAt: { not: null }, reversalOfId: null }, orderBy: { confirmedAt: 'desc' }, take: 200, select: { membershipId: true, amountKobo: true, confirmedAt: true, confirmedBy: true, allocations: { select: { installmentId: true } } } });
  for (const c of confirmed) {
    const r = c.allocations.map((a) => (a.installmentId ? roundOfInstallment.get(a.installmentId) : undefined)).find((n) => n !== undefined);
    entries.push({ at: c.confirmedAt as Date, kind: 'CONFIRMED', text: `${officerName(b, c.confirmedBy) ?? 'An officer'} confirmed ${formatNaira(c.amountKobo)} from ${nameOfMembership(c.membershipId)}${r ? ` for round ${r}` : ''}` });
  }
  const reversed = await prisma.ajoContribution.findMany({ where: { groupId: b.group.id, status: 'REVERSED' }, orderBy: { createdAt: 'desc' }, take: 100, select: { createdAt: true, reason: true } });
  for (const c of reversed) entries.push({ at: c.createdAt, kind: 'REVERSED', text: `A contribution was reversed${c.reason ? `. Reason: ${c.reason.slice(0, 120)}` : ''}` });

  for (const p of b.payouts.filter((x) => x.status === 'PAID' && x.paidAt)) {
    entries.push({ at: p.paidAt as Date, kind: 'PAYOUT', text: `${formatNaira(p.netKobo)} payout to ${nameOfMembership(p.membershipId)} recorded as paid${ref(p.paidReference)}${p.approvedBy ? `, approved by ${officerName(b, p.approvedBy)}` : ''}` });
  }
  const versions = await prisma.ajoGroupRuleVersion.findMany({ where: { groupId: b.group.id, version: { gt: 1 } }, select: { version: true, createdAt: true, effectiveFrom: true } });
  for (const v of versions) entries.push({ at: v.createdAt, kind: 'RULES', text: `Rules updated to version ${v.version}. They apply from ${iso(v.effectiveFrom)}` });

  const events = await prisma.ajoPayoutOrderEvent.findMany({ where: { groupId: b.group.id, type: { in: ['SWAP', 'EXCEPTION'] } }, select: { type: true, detail: true, reason: true, createdAt: true, approvedBy: true } });
  for (const e of events) {
    const d = e.detail as { a?: { membershipId: number; from: number }; b?: { from: number }; membershipId?: number; from?: number; to?: number };
    entries.push({ at: e.createdAt, kind: e.type, text: e.type === 'SWAP' ? `Swap approved: positions ${d.a?.from} and ${d.b?.from}` : `Emergency exception: ${d.membershipId ? nameOfMembership(d.membershipId) : 'A member'} moved from position ${d.from} to ${d.to}${e.reason ? `. Reason: ${e.reason.slice(0, 120)}` : ''} (approved by ${e.approvedBy ? officerName(b, e.approvedBy) : 'an admin'})` });
  }

  const page = entries.filter((e) => !input.before || e.at.getTime() < input.before.getTime()).sort((x, y) => y.at.getTime() - x.at.getTime()).slice(0, limit);
  return { timezone: b.group.timezone, entries: page.map((e) => ({ at: when(e.at), kind: e.kind, text: e.text })), nextBefore: page.length === limit ? when((page[page.length - 1] as Entry).at) : null };
}
