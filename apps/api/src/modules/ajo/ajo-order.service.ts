/**
 * Payout order for a rotating pot (T3.7): the recorded draw, swaps, and the emergency exception.
 *
 * The order is made of slots, one per share. The default is a recorded random draw: the seed and the whole result are saved as a DRAW
 * event and shown to every participant, and anyone can reproduce it from the seed. Before any payout has been paid, two participants can
 * swap slots with the admin's approval. After the first payout, a paid slot never moves; the only change left is an admin-approved
 * emergency exception with a written reason, and it only moves slots that have not been paid.
 *
 * Every step is an appended AjoPayoutOrderEvent. The order is never edited without leaving one.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { RuleError } from '../finance/rule-error';
import { drawOrder, moveWithinUnpaid, newSeed, rosterFingerprint, type SlotKey } from './ajo-draw';
import { auditAjo, notifyPermissionHolders, notifyUser } from './ajo-support';
import { atRiskMembershipIds } from './ajo-trust.service';

type Db = Prisma.TransactionClient | typeof prisma;
type Tx = Prisma.TransactionClient;

export const MIN_EXCEPTION_REASON = 10;

/** One slot per share for each active membership. */
export function expectedSlots(active: Array<{ id: number; shares: number }>): SlotKey[] {
  return active.flatMap((m) => Array.from({ length: m.shares }, (_, i) => ({ membershipId: m.id, shareNo: i + 1 })));
}

/**
 * Memberships whose owner is in the "At risk" trust band, judged on their record in their other groups (this group has no history yet).
 * The group's optional rule keeps these out of the early positions in the draw.
 */
export async function atRiskMemberships(db: Db, groupId: number, now: Date = new Date()): Promise<Set<number>> {
  return atRiskMembershipIds(db, groupId, now);
}

async function lockGroup(tx: Tx, associationId: number, groupId: number) {
  await tx.$queryRaw`SELECT id FROM ajo_groups WHERE id = ${groupId} AND association_id = ${associationId} FOR UPDATE`;
  const group = await tx.ajoGroup.findFirst({ where: { id: groupId, associationId } });
  if (!group) throw new RuleError('That circle was not found.', 404, 'GROUP_NOT_FOUND');
  if (group.model !== 'ROTATING_POT') throw new RuleError('Only a rotating pot has a payout order.', 409, 'NOT_A_ROTATING_POT');
  return group;
}

/** Rounds that have been paid out. A slot whose position is in this set is paid and can never move. */
export async function paidPositions(db: Db, groupId: number): Promise<Set<number>> {
  const rows = await db.ajoPayout.findMany({ where: { groupId, status: 'PAID', round: { not: null } }, select: { round: true } });
  return new Set(rows.map((r) => r.round as number));
}

/**
 * Rounds whose slot may no longer move: a payout for it is prepared, approved or paid. Between preparing and paying, a swap would send an
 * approved payout to the wrong person, so the slot is held still until the payout is paid or stopped.
 */
export async function lockedPositions(db: Db, groupId: number): Promise<Set<number>> {
  const rows = await db.ajoPayout.findMany({ where: { groupId, status: { in: ['PREPARED', 'APPROVED', 'PAID'] }, round: { not: null } }, select: { round: true } });
  return new Set(rows.map((r) => r.round as number));
}

export async function anyPayoutPaid(db: Db, groupId: number): Promise<boolean> {
  return (await db.ajoPayout.count({ where: { groupId, status: 'PAID' } })) > 0;
}

/** The newest draw, and whether it still matches the roster it was made for. */
export async function drawState(db: Db, groupId: number, slots: SlotKey[]) {
  const event = await db.ajoPayoutOrderEvent.findFirst({ where: { groupId, type: 'DRAW' }, orderBy: { id: 'desc' } });
  if (!event) return { drawn: false as const, current: false, event: null };
  const detail = event.detail as { rosterFingerprint?: string };
  return { drawn: true as const, current: detail.rosterFingerprint === rosterFingerprint(slots), event };
}

/** Starting a rotating pot needs a draw that matches who is in it now. */
export async function assertCurrentDraw(db: Db, groupId: number, slots: SlotKey[]): Promise<void> {
  const state = await drawState(db, groupId, slots);
  if (!state.drawn) throw new RuleError('Run the draw before starting: the payout order has not been drawn yet.', 409, 'DRAW_REQUIRED');
  if (!state.current) throw new RuleError('The roster or the shares changed after the last draw. Run the draw again before starting.', 409, 'DRAW_REQUIRED');
  const stored = await db.ajoPayoutSlot.count({ where: { groupId } });
  if (stored !== slots.length) throw new RuleError('The saved order does not match the roster. Run the draw again before starting.', 409, 'DRAW_REQUIRED');
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The draw
// ---------------------------------------------------------------------------------------------------------------------------------

export interface DrawInput {
  associationId: number;
  groupId: number;
  actorUserId: number;
  now?: Date;
}

/**
 * Draw the order for an open rotating pot. Allowed once the roster is final. Asking again is refused unless the roster or the shares have
 * changed since the last draw, so a result cannot be re-rolled because someone did not like it.
 */
export async function runDraw(input: DrawInput) {
  const result = await prisma.$transaction(async (tx) => {
    const group = await lockGroup(tx, input.associationId, input.groupId);
    if (group.status !== 'OPEN') throw new RuleError(group.status === 'DRAFT' ? 'Open the group first.' : 'The order is drawn before the group starts, and it has now started.', 409, 'INVALID_GROUP_STATE');

    const active = await tx.ajoMembership.findMany({ where: { groupId: group.id, status: 'ACTIVE' }, select: { id: true, shares: true } });
    const slots = expectedSlots(active);
    if (slots.length < 2) throw new RuleError('A rotating pot needs at least 2 shares before it can be drawn.', 409, 'NOT_ENOUGH_PARTICIPANTS');

    const state = await drawState(tx, group.id, slots);
    if (state.drawn && state.current) throw new RuleError('The order has already been drawn for this roster. It can only be drawn again if someone joins, leaves or changes their shares.', 409, 'DRAW_ALREADY_DONE');

    const rules = await tx.ajoGroupRuleVersion.findFirst({ where: { groupId: group.id }, orderBy: { version: 'desc' }, select: { blockAtRiskEarly: true } });
    const seed = newSeed();
    const placed = drawOrder({ slots, seed, blockAtRiskEarly: rules?.blockAtRiskEarly ?? false, atRisk: await atRiskMemberships(tx, group.id, input.now ?? new Date()) });

    await tx.ajoPayoutSlot.deleteMany({ where: { groupId: group.id } });
    await tx.ajoPayoutSlot.createMany({ data: placed.positions.map((p) => ({ associationId: input.associationId, groupId: group.id, membershipId: p.membershipId, shareNo: p.shareNo, position: p.position })) });
    const event = await tx.ajoPayoutOrderEvent.create({
      data: {
        associationId: input.associationId,
        groupId: group.id,
        type: 'DRAW',
        detail: { seed, rosterFingerprint: rosterFingerprint(slots), blockAtRiskEarly: rules?.blockAtRiskEarly ?? false, atRiskRuleFullyApplied: placed.atRiskRuleFullyApplied, positions: placed.positions.map((p) => ({ membershipId: p.membershipId, shareNo: p.shareNo, position: p.position })) },
        requestedBy: input.actorUserId,
        approvedBy: input.actorUserId,
      },
    });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_ORDER_DRAWN', tableName: 'ajo_payout_order_events', recordId: event.id, newValues: { groupId: group.id, slots: slots.length, redraw: state.drawn } });

    const members = await tx.ajoMembership.findMany({ where: { groupId: group.id, status: 'ACTIVE' }, select: { member: { select: { userId: true } } } });
    return { eventId: event.id, seed, groupName: group.name, positions: placed.positions, atRiskRuleFullyApplied: placed.atRiskRuleFullyApplied, redraw: state.drawn, userIds: members.map((m) => m.member.userId).filter((u): u is number => u !== null) };
  });

  for (const userId of result.userIds) {
    await notifyUser(input.associationId, userId, { pushType: 'ajo.order_drawn', entityId: input.groupId, title: 'Payout order drawn', message: `The payout order for ${result.groupName} has been drawn. You can see where you are and check the draw.` });
  }
  return { eventId: result.eventId, seed: result.seed, redraw: result.redraw, atRiskRuleFullyApplied: result.atRiskRuleFullyApplied, slots: result.positions.length };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reading the order
// ---------------------------------------------------------------------------------------------------------------------------------

/** The order as every participant sees it, with the draw's seed so anyone can check it, and the history of changes. */
export async function getOrder(db: Db, groupId: number, viewerUserId: number | null) {
  const [group, active, pendingPeople] = await Promise.all([
    db.ajoGroup.findUnique({ where: { id: groupId }, select: { status: true } }),
    db.ajoMembership.findMany({ where: { groupId, status: 'ACTIVE' }, select: { id: true, shares: true } }),
    db.ajoMembership.count({ where: { groupId, status: 'PENDING' } }),
  ]);
  const [slots, events, paid] = await Promise.all([
    db.ajoPayoutSlot.findMany({ where: { groupId }, orderBy: { position: 'asc' }, include: { membership: { select: { id: true, member: { select: { firstName: true, lastName: true, userId: true } } } } } }),
    db.ajoPayoutOrderEvent.findMany({ where: { groupId }, orderBy: { id: 'asc' } }),
    paidPositions(db, groupId),
  ]);
  const draw = [...events].reverse().find((e) => e.type === 'DRAW');
  const drawDetail = draw?.detail as { seed?: string; rosterFingerprint?: string } | undefined;
  // Whether the newest draw still matches who is in the circle now. If not, the circle cannot start until it is drawn again.
  const current = !!draw && drawDetail?.rosterFingerprint === rosterFingerprint(expectedSlots(active));
  const drawnFor = new Set(slots.map((x) => x.membershipId));
  const nowIn = new Set(active.map((a) => a.id));
  const joined = active.filter((a) => !drawnFor.has(a.id)).length;
  const left = [...drawnFor].filter((id) => !nowIn.has(id)).length;
  const stale = !!draw && !current;
  const staleBecause = !stale ? null : [joined > 0 ? `${joined} ${joined === 1 ? 'person was' : 'people were'} approved since the draw` : null, left > 0 ? `${left} ${left === 1 ? 'person is' : 'people are'} no longer in the circle` : null].filter(Boolean).join(' and ') || 'The shares changed since the draw';
  return {
    drawn: !!draw,
    /** The newest draw matches the roster now. False means: draw again before starting. */
    current,
    stale,
    staleBecause,
    /** A new draw is allowed: the circle is open and there is none yet, or the roster changed since the last one. */
    canDraw: group?.status === 'OPEN' && (!draw || stale),
    /** People who have joined but are not approved yet. They are not in a draw made now. */
    pendingPeople,
    seed: drawDetail?.seed ?? null,
    drawnAt: draw?.createdAt ?? null,
    slots: slots.map((s) => ({ slotId: s.id, position: s.position, shareNo: s.shareNo, membershipId: s.membershipId, name: `${s.membership.member.firstName} ${s.membership.member.lastName}`.trim(), paid: paid.has(s.position), mine: viewerUserId !== null && s.membership.member.userId === viewerUserId })),
    history: events.map((e) => ({ id: e.id, type: e.type, reason: e.reason, createdAt: e.createdAt, ...(e.type === 'DRAW' ? {} : { detail: e.detail }) })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Swaps (before the first payout)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface RequestSwapInput {
  associationId: number;
  groupId: number;
  slotAId: number;
  slotBId: number;
  actorUserId: number;
  /** True when the caller holds ajo.manage; a participant may only propose a swap that involves their own slot. */
  actorIsOfficer: boolean;
  reason?: string;
}

export async function requestSwap(input: RequestSwapInput) {
  const result = await prisma.$transaction(async (tx) => {
    const group = await lockGroup(tx, input.associationId, input.groupId);
    if (group.status !== 'OPEN' && group.status !== 'ACTIVE') throw new RuleError('Positions can be swapped while a circle is open or running.', 409, 'INVALID_GROUP_STATE');
    if (input.slotAId === input.slotBId) throw new RuleError('Choose two different slots to swap.', 400, 'INVALID_SWAP');
    if (await anyPayoutPaid(tx, group.id)) throw new RuleError('A payout has already been paid, so positions can no longer be swapped. Ask the admin for an emergency exception instead.', 409, 'USE_EXCEPTION');

    const slots = await tx.ajoPayoutSlot.findMany({ where: { groupId: group.id, id: { in: [input.slotAId, input.slotBId] } }, include: { membership: { select: { id: true, member: { select: { userId: true, firstName: true } } } } } });
    if (slots.length !== 2) throw new RuleError('Those slots are not part of this circle.', 404, 'SLOT_NOT_FOUND');
    const [a, b] = [slots.find((s) => s.id === input.slotAId)!, slots.find((s) => s.id === input.slotBId)!];
    if (a.membershipId === b.membershipId) throw new RuleError('Both slots belong to the same person, so swapping them changes nothing for the circle.', 400, 'SAME_PERSON');
    const held = await lockedPositions(tx, group.id);
    if (held.has(a.position) || held.has(b.position)) throw new RuleError('A payout has been prepared for one of these positions, so it cannot move until that payout is paid or cancelled.', 409, 'SLOT_LOCKED');
    if (!input.actorIsOfficer && a.membership.member.userId !== input.actorUserId && b.membership.member.userId !== input.actorUserId) {
      throw new RuleError('You can only ask to swap your own position.', 403, 'FORBIDDEN');
    }

    const open = await tx.ajoOrderChangeRequest.findFirst({ where: { groupId: group.id, status: 'PENDING', OR: [{ slotAId: { in: [a.id, b.id] } }, { slotBId: { in: [a.id, b.id] } }] } });
    if (open) throw new RuleError('One of these slots already has a swap waiting for the admin.', 409, 'SWAP_PENDING');

    const request = await tx.ajoOrderChangeRequest.create({ data: { associationId: input.associationId, groupId: group.id, slotAId: a.id, slotBId: b.id, reason: input.reason?.trim() || null, requestedBy: input.actorUserId } });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_SWAP_REQUESTED', tableName: 'ajo_order_change_requests', recordId: request.id, newValues: { slotA: a.position, slotB: b.position } });
    return { request, groupName: group.name, counterpartUserIds: [a, b].map((s) => s.membership.member.userId).filter((u): u is number => u !== null && u !== input.actorUserId) };
  });

  await notifyPermissionHolders(input.associationId, 'ajo.approve_payout', { pushType: 'ajo.swap_requested', entityId: result.request.id, title: 'Swap waiting for approval', message: `A position swap in ${result.groupName} needs your decision.` }, input.actorUserId);
  for (const userId of result.counterpartUserIds) await notifyUser(input.associationId, userId, { pushType: 'ajo.swap_requested', entityId: result.request.id, title: 'Someone asked to swap with you', message: `A position swap involving you in ${result.groupName} is waiting for the admin.` });
  return { requestId: result.request.id, status: result.request.status };
}

export interface DecideSwapInput {
  associationId: number;
  requestId: number;
  decision: 'APPROVED' | 'REJECTED';
  actorUserId: number;
  note?: string;
}

/** The admin decides. An approved swap is applied at once and recorded as a SWAP event; a rejected one changes nothing. */
export async function decideSwap(input: DecideSwapInput) {
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.ajoOrderChangeRequest.findFirst({ where: { id: input.requestId, associationId: input.associationId } });
    if (!request) throw new RuleError('That swap request was not found.', 404, 'REQUEST_NOT_FOUND');
    const group = await lockGroup(tx, input.associationId, request.groupId);
    if (request.status !== 'PENDING') throw new RuleError(`This request was already ${request.status.toLowerCase()}.`, 409, 'ALREADY_DECIDED');

    const slots = await tx.ajoPayoutSlot.findMany({ where: { id: { in: [request.slotAId, request.slotBId] } }, include: { membership: { select: { id: true, member: { select: { userId: true } } } } } });
    const a = slots.find((s) => s.id === request.slotAId);
    const b = slots.find((s) => s.id === request.slotBId);
    const decidedAt = new Date();

    if (input.decision === 'REJECTED') {
      await tx.ajoOrderChangeRequest.update({ where: { id: request.id }, data: { status: 'REJECTED', decidedBy: input.actorUserId, decidedAt, decisionNote: input.note?.trim() || null } });
      await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_SWAP_REJECTED', tableName: 'ajo_order_change_requests', recordId: request.id, newValues: { note: input.note ?? null } });
      return { request, groupName: group.name, applied: false, userIds: [request.requestedBy] };
    }

    if (!a || !b) throw new RuleError('One of the slots no longer exists (the order was drawn again). Ask for the swap again.', 409, 'SLOT_NOT_FOUND');
    // The admin judging a swap cannot hold a slot in it.
    const conflicted = [a, b].some((s) => s.membership.member.userId === input.actorUserId);
    if (conflicted) throw new RuleError('You hold one of these positions, so another admin has to decide this swap.', 403, 'CONFLICT_OF_INTEREST');
    if (await anyPayoutPaid(tx, group.id)) throw new RuleError('A payout has been paid since this was requested, so positions can no longer be swapped.', 409, 'USE_EXCEPTION');
    const held = await lockedPositions(tx, group.id);
    if (held.has(a.position) || held.has(b.position)) throw new RuleError('A payout has been prepared for one of these positions since this was requested, so it cannot move.', 409, 'SLOT_LOCKED');

    // The unique (group, position) constraint forbids two slots sharing a position, even for an instant, so park one slot first.
    const [posA, posB] = [a.position, b.position];
    await tx.ajoPayoutSlot.update({ where: { id: a.id }, data: { position: -a.id } });
    await tx.ajoPayoutSlot.update({ where: { id: b.id }, data: { position: posA } });
    await tx.ajoPayoutSlot.update({ where: { id: a.id }, data: { position: posB } });

    const approved = await tx.ajoOrderChangeRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'APPROVED', decidedBy: input.actorUserId, decidedAt, decisionNote: input.note?.trim() || null } });
    if (approved.count !== 1) throw new RuleError('This request was just decided by someone else.', 409, 'ALREADY_DECIDED');
    const event = await tx.ajoPayoutOrderEvent.create({
      data: { associationId: input.associationId, groupId: group.id, type: 'SWAP', detail: { requestId: request.id, a: { slotId: a.id, membershipId: a.membershipId, from: posA, to: posB }, b: { slotId: b.id, membershipId: b.membershipId, from: posB, to: posA } }, reason: request.reason, requestedBy: request.requestedBy, approvedBy: input.actorUserId },
    });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_SWAP_APPROVED', tableName: 'ajo_payout_order_events', recordId: event.id, oldValues: { a: posA, b: posB }, newValues: { a: posB, b: posA } });
    const userIds = [request.requestedBy, ...[a, b].map((s) => s.membership.member.userId)].filter((u): u is number => u !== null);
    return { request, groupName: group.name, applied: true, userIds: [...new Set(userIds)] };
  });

  for (const userId of result.userIds) {
    await notifyUser(input.associationId, userId, { pushType: 'ajo.swap_decided', entityId: result.request.id, title: result.applied ? 'Swap approved' : 'Swap not approved', message: result.applied ? `The position swap in ${result.groupName} was approved.` : `The position swap in ${result.groupName} was not approved${input.note ? `: ${input.note}` : '.'}` });
  }
  return { requestId: result.request.id, status: input.decision, applied: result.applied };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Emergency exception (after the first payout)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface ExceptionInput {
  associationId: number;
  groupId: number;
  slotId: number;
  newPosition: number;
  reason: string;
  /** The admin who decides it, with ajo.approve_payout. */
  actorUserId: number;
}

/** Move one unpaid slot to another unpaid position, with a written reason. Only possible once a payout has been paid; before that, swap. */
export async function emergencyException(input: ExceptionInput) {
  const reason = (input.reason ?? '').trim();
  if (reason.length < MIN_EXCEPTION_REASON) throw new RuleError(`An exception needs a written reason of at least ${MIN_EXCEPTION_REASON} characters. It is shown to the whole circle.`, 400, 'REASON_REQUIRED');

  const result = await prisma.$transaction(async (tx) => {
    const group = await lockGroup(tx, input.associationId, input.groupId);
    if (group.status !== 'ACTIVE') throw new RuleError('Exceptions apply to a running circle.', 409, 'INVALID_GROUP_STATE');
    if (!(await anyPayoutPaid(tx, group.id))) throw new RuleError('No payout has been paid yet, so use an ordinary swap or draw again instead of an exception.', 409, 'EXCEPTION_NOT_NEEDED');

    const slots = await tx.ajoPayoutSlot.findMany({ where: { groupId: group.id }, include: { membership: { select: { id: true, member: { select: { userId: true } } } } } });
    // A position with a payout in progress is held still as well as one already paid.
    const paid = await lockedPositions(tx, group.id);
    let changes;
    try {
      changes = moveWithinUnpaid(slots.map((s) => ({ id: s.id, position: s.position })), paid, input.slotId, input.newPosition);
    } catch (error) {
      throw new RuleError(error instanceof RangeError ? error.message : 'That move is not allowed.', 409, 'EXCEPTION_NOT_ALLOWED');
    }

    // Park every slot that moves on a negative position first, so the unique (group, position) constraint is never broken midway.
    for (const c of changes) await tx.ajoPayoutSlot.update({ where: { id: c.id }, data: { position: -c.id } });
    for (const c of changes) await tx.ajoPayoutSlot.update({ where: { id: c.id }, data: { position: c.to } });

    const moved = slots.find((s) => s.id === input.slotId)!;
    const event = await tx.ajoPayoutOrderEvent.create({
      data: { associationId: input.associationId, groupId: group.id, type: 'EXCEPTION', detail: { slotId: moved.id, membershipId: moved.membershipId, from: moved.position, to: input.newPosition, shifted: changes.map((c) => ({ slotId: c.id, from: c.from, to: c.to })) }, reason, requestedBy: input.actorUserId, approvedBy: input.actorUserId },
    });
    await auditAjo(tx, { associationId: input.associationId, userId: input.actorUserId, action: 'AJO_ORDER_EXCEPTION', tableName: 'ajo_payout_order_events', recordId: event.id, oldValues: { position: moved.position }, newValues: { position: input.newPosition, reason, slotsMoved: changes.length } });
    const touched = new Set(changes.map((c) => c.id));
    const userIds = slots.filter((s) => touched.has(s.id)).map((s) => s.membership.member.userId).filter((u): u is number => u !== null);
    return { eventId: event.id, changes, groupName: group.name, userIds: [...new Set(userIds)] };
  });

  for (const userId of result.userIds) await notifyUser(input.associationId, userId, { pushType: 'ajo.order_exception', entityId: input.groupId, title: 'Payout order changed', message: `The admin changed the payout order in ${result.groupName}: ${reason}` });
  return { eventId: result.eventId, moved: result.changes };
}

export async function listSwapRequests(db: Db, groupId: number, status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED') {
  return db.ajoOrderChangeRequest.findMany({ where: { groupId, ...(status ? { status } : {}) }, orderBy: { id: 'desc' } });
}
