/**
 * Thrift (Ajo): rotating circles and collector thrift, driven through the real Ajo services (so contributions, ledger entries, receipts,
 * schedules, late fees, payouts and cycles are exactly what the app produces). Dates are offsets from the day the seed runs.
 *
 * The services stamp the real clock on some rows (ledger entries, contributions, receipts). After each step those rows are moved to
 * the fixture time, as demo-ajo.seed.ts does, so history reads correctly.
 */
import { Member } from '@prisma/client';
import { grantAddonManually } from '../../../src/services/billing/lifecycle.service';
import * as groups from '../../../src/modules/ajo/ajo-group.service';
import * as members from '../../../src/modules/ajo/ajo-membership.service';
import * as consent from '../../../src/modules/ajo/ajo-consent.service';
import * as order from '../../../src/modules/ajo/ajo-order.service';
import * as contrib from '../../../src/modules/ajo/ajo-contribution.service';
import * as payouts from '../../../src/modules/ajo/ajo-payout.service';
import * as collectors from '../../../src/modules/ajo/ajo-collector.service';
import * as handovers from '../../../src/modules/ajo/ajo-handover.service';
import * as cycles from '../../../src/modules/ajo/ajo-cycle.service';
import * as lateFees from '../../../src/modules/ajo/ajo-latefee.service';
import * as accounts from '../../../src/modules/ajo/ajo-payout-account.service';
import { runAjoDailyJobs } from '../../../src/modules/ajo/ajo-risk-cycle';
import { personName, phoneFor, DAY_MS, daysFrom, isoDay } from './util';
import { Ctx, Tenant } from './core';
import type { Counts } from './finance';
import type { PotDef, ThriftDef } from './config';

const bump = (c: Counts, key: string, n = 1) => { c[key] = (c[key] ?? 0) + n; };
const mark = { ledger: 0, contribution: 0, payout: 0, receipt: 0 };

async function maxIds(ctx: Ctx) {
  const { prisma } = ctx;
  const [l, c, p, r] = await Promise.all([
    prisma.ajoLedgerEntry.aggregate({ _max: { id: true } }), prisma.ajoContribution.aggregate({ _max: { id: true } }),
    prisma.ajoPayout.aggregate({ _max: { id: true } }), prisma.ajoReceipt.aggregate({ _max: { id: true } }),
  ]);
  return { ledger: l._max.id ?? 0, contribution: c._max.id ?? 0, payout: p._max.id ?? 0, receipt: r._max.id ?? 0 };
}
/** Move everything the last step wrote to the time it is supposed to have happened. */
async function stamp(ctx: Ctx, when: Date) {
  const { prisma } = ctx;
  await prisma.ajoLedgerEntry.updateMany({ where: { id: { gt: mark.ledger } }, data: { createdAt: when } });
  await prisma.ajoContribution.updateMany({ where: { id: { gt: mark.contribution } }, data: { createdAt: when } });
  await prisma.ajoPayout.updateMany({ where: { id: { gt: mark.payout } }, data: { preparedAt: when } });
  await prisma.ajoReceipt.updateMany({ where: { id: { gt: mark.receipt } }, data: { createdAt: when } });
  Object.assign(mark, await maxIds(ctx));
}

// A real 1x1 PNG with a few unique bytes after it, so no two proofs look like the same slip to the duplicate check.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let proofCounter = 0;
const proof = () => ({ buffer: Buffer.concat([PNG, Buffer.from(`demo-slip-${++proofCounter}-${Date.now()}`)]), mimeType: 'image/png' });
const at = (d: Date, hh: number, mm = 0) => new Date(d.getTime() + hh * 3_600_000 + mm * 60_000);

/** Ajo is an add-on, for associations and standalone thrift groups alike (a thrift group base plan allows no contributors by itself). */
export async function ensureAjoAccess(ctx: Ctx, t: Tenant) {
  const have = await ctx.prisma.tenantAddon.findFirst({ where: { associationId: t.association.id, status: 'ACTIVE', addonVersion: { addon: { family: 'ajo' } } } });
  if (have) return;
  const addon = await ctx.prisma.addon.findUnique({ where: { code: 'ajo-business' } });
  if (!addon) throw new Error('The "ajo-business" add-on does not exist. Run prisma/seeds/ajo-addons.seed.ts first.');
  await grantAddonManually({ associationId: t.association.id, addonId: addon.id, reason: 'Demo tenant', actor: { id: t.adminUserId, role: 'SUPER_ADMIN' } as never });
}

/** People for a circle: the tenant's own members first, then new member records (a standalone group starts with only its logins). */
async function participants(ctx: Ctx, t: Tenant, count: number, preferKeys: string[], skip: Set<number>): Promise<Member[]> {
  const out: Member[] = [];
  for (const key of preferKeys) {
    const a = t.byKey.get(key);
    if (a && !skip.has(a.member.id) && out.length < count) out.push(a.member);
  }
  const taken = new Set(out.map((m) => m.id));
  for (const m of t.roll) {
    if (out.length >= count) break;
    const blocked = t.accounts.some((a) => a.member.id === m.id && (a.role !== 'member' || ['pending', 'suspended', 'inactive'].includes(a.situation)));
    if (m.status !== 'active' || taken.has(m.id) || skip.has(m.id) || blocked) continue;
    out.push(m);
    taken.add(m.id);
  }
  const names = new Set<string>(t.roll.map((m) => `${m.firstName} ${m.lastName}`));
  while (out.length < count) {
    const memberNo = (await ctx.prisma.member.count({ where: { associationId: t.association.id } })) + 1;
    const name = personName(ctx.rng, names);
    const m = await ctx.prisma.member.create({
      data: { associationId: t.association.id, memberId: `MEM${String(memberNo).padStart(4, '0')}`, ...name, phone: phoneFor(ctx.rng), country: 'Nigeria', status: 'active', joinDate: daysFrom(ctx.today, -90), gender: ctx.rng.chance(0.5) ? 'male' : 'female', loginStatus: 'no_login' },
    });
    t.roll.push(m);
    out.push(m);
  }
  return out;
}

async function verifiedWithAccount(ctx: Ctx, t: Tenant, list: Member[], when: Date) {
  for (const [i, mem] of list.entries()) {
    if (await ctx.prisma.ajoPayoutAccount.findFirst({ where: { memberId: mem.id } })) continue; // already set up for an earlier circle
    await accounts.setPayoutAccount({ associationId: t.association.id, memberId: mem.id, bankName: ['GTBank', 'Access Bank', 'First Bank', 'Zenith Bank', 'UBA'][i % 5], accountNumber: `02${String(30000000 + mem.id * 1117 + i).slice(0, 8)}`, accountName: `${mem.firstName} ${mem.lastName}`.toUpperCase().slice(0, 60), actorUserId: t.adminUserId, now: when } as never);
    const has = await ctx.prisma.ajoVerification.findFirst({ where: { associationId: t.association.id, memberId: mem.id } });
    const data = { submittedName: `${mem.firstName} ${mem.lastName}`, submittedPhone: mem.phone, submittedAddress: mem.address ?? '12 Market Road', submittedAccountName: `${mem.firstName} ${mem.lastName}`.toUpperCase(), status: 'VERIFIED', nameMatchesAccount: true, phoneConfirmed: true, addressFilled: true, reviewedBy: t.adminUserId, reviewedAt: when };
    if (has) await ctx.prisma.ajoVerification.update({ where: { id: has.id }, data: data as never });
    else await ctx.prisma.ajoVerification.create({ data: { associationId: t.association.id, memberId: mem.id, createdAt: when, ...data } as never });
  }
}

function mustBeActive(outcome: { status: string; unmet: string[]; blockedByLimit: { message: string } | null; waitingForGroupToOpen?: boolean }, group: string) {
  if (outcome.status === 'ACTIVE') return;
  throw new Error(group + ': a member could not be activated (' + (outcome.blockedByLimit?.message ?? outcome.unmet.join(', ') ?? 'unknown') + ')');
}

function managerOf(t: Tenant): number {
  return (t.byKey.get('ajo-officer') ?? t.byKey.get('officer') ?? t.byKey.get('admin'))!.user.id;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Rotating circles
// ---------------------------------------------------------------------------------------------------------------------------------
export async function seedPot(ctx: Ctx, t: Tenant, def: PotDef, skip: Set<number> = new Set()): Promise<Counts> {
  const counts: Counts = {};
  const A = t.association.id;
  const manager = managerOf(t);
  const admin = t.adminUserId;
  const people = await participants(ctx, t, def.members, ['member', 'dual', 'member-late', 'member-paid'], skip);
  const N = people.length;
  Object.assign(mark, await maxIds(ctx));

  // Timeline by state. `due(r)` is the day round r is due; weekly.
  const inProgress = def.state === 'in_progress';
  const completed = def.state === 'completed';
  const currentRound = inProgress ? Math.min(4, N - 1) : N;
  const R1 = completed ? daysFrom(ctx.today, -(7 * N + 14)) : inProgress ? daysFrom(ctx.today, -(7 * (currentRound - 1) + 4)) : daysFrom(ctx.today, 14);
  const due = (r: number) => daysFrom(R1, 7 * (r - 1));
  const created = daysFrom(R1, -(inProgress || completed ? 16 : 7));

  const pot = await groups.createGroup({
    associationId: A, actorUserId: manager, now: created,
    bank: { bankName: def.bank, accountNumber: '0123456789', accountName: def.name.toUpperCase().replace(/[^A-Z ]/g, '').slice(0, 40) },
    fields: { name: def.name, model: 'ROTATING_POT', frequency: 'WEEKLY', contributionKobo: def.contributionKobo, startDate: isoDay(R1), maxParticipants: N, maxSharesPerMember: 1, orderMethod: 'ADMIN_SET' } as never,
    rules: { lateFeeType: 'FIXED', lateFeeValue: 50_000, lateFeeCapKobo: 100_000, graceDays: 3, guarantorPolicy: 'OPTIONAL', defaultProcedure: 'CASE_AND_PLAN', remindersEnabled: true, memberVisibility: 'FULL', nameDisplay: 'FIRST_INITIAL' },
  } as never);
  bump(counts, 'ajoCircles');
  await groups.openGroup({ associationId: A, groupId: pot.id, actorUserId: manager, now: at(created, 1) });

  const membership = new Map<number, number>();
  for (const [i, mem] of people.entries()) {
    const when = at(daysFrom(created, 1 + (i % 4)), 10);
    const m = await members.addMember({ associationId: A, groupId: pot.id, memberId: mem.id, actorUserId: manager } as never);
    membership.set(mem.id, m.id);
    const selfLogin = mem.userId && t.accounts.some((a) => a.user.id === mem.userId) ? mem.userId : null;
    await consent.acceptRules({ associationId: A, membershipId: m.id, actorUserId: selfLogin ?? manager, actorIsOfficer: selfLogin === null, note: selfLogin === null ? 'Read aloud at the meeting and agreed in person.' : undefined, now: when } as never);
    const approved = await members.approveMembership({ associationId: A, membershipId: m.id, actorUserId: admin, now: when } as never);
    mustBeActive(approved, def.name);
    bump(counts, 'ajoMemberships');
  }
  await verifiedWithAccount(ctx, t, people, at(daysFrom(created, 6), 11));

  if (def.state === 'not_started') return counts; // open, people approved, no draw and no start yet

  // Payout order: set by hand. The persona members are placed late so they have not yet been paid, and the person who is late in the
  // current round is never a recipient of an early round.
  const lateMember = t.byKey.get('member-late')?.member.id;
  const dualMember = t.byKey.get('dual')?.member.id;
  const sorted = [...people].sort((x, y) => (x.id === lateMember ? 1 : 0) - (y.id === lateMember ? 1 : 0) || ((x.id === dualMember ? 1 : 0) - (y.id === dualMember ? 1 : 0)));
  const wanted = sorted.map((p) => p.id);
  await order.setOrderByAdmin({ associationId: A, groupId: pot.id, actorUserId: admin, order: wanted.map((id) => ({ membershipId: membership.get(id)!, shareNo: 1 })), reason: 'Order agreed by the members at the first meeting, by need and by trust.', now: at(daysFrom(R1, -2), 10) } as never);
  await groups.startGroup({ associationId: A, groupId: pot.id, actorUserId: manager, now: at(daysFrom(R1, -1), 9) });
  await stamp(ctx, at(daysFrom(R1, -1), 9));

  // Contributions round by round; payouts follow rounds that are complete.
  const rounds = completed ? N : currentRound;
  for (let r = 1; r <= rounds; r += 1) {
    const isCurrent = inProgress && r === currentRound;
    for (const [i, mem] of people.entries()) {
      const skipPayment = isCurrent && (mem.id === lateMember || i === N - 1); // two people have not paid the round in progress
      if (skipPayment) continue;
      const reportedAt = at(due(r), 9, 30 + i);
      const reported = await contrib.reportTransfer({
        associationId: A, groupId: pot.id, membershipId: membership.get(mem.id)!, amountKobo: BigInt(def.contributionKobo), idempotencyKey: `demo-${A}-${pot.id}-${mem.id}-${r}`,
        actorUserId: manager, actorCanManage: true, proof: proof(), now: reportedAt, paidOn: due(r),
      } as never);
      await stamp(ctx, reportedAt);
      const waiting = isCurrent && i === N - 2; // one transfer reported but not yet confirmed
      if (!waiting) {
        const confirmedAt = at(due(r), 14);
        await contrib.confirmTransfer({ associationId: A, contributionId: reported.contribution.id, actorUserId: admin, now: confirmedAt });
        await stamp(ctx, confirmedAt);
      }
      bump(counts, 'ajoContributions');
    }
    if (!isCurrent) {
      const recipient = wanted[r - 1];
      const day = at(daysFrom(due(r), 1), 10);
      const prepared = await payouts.preparePayout({ associationId: A, groupId: pot.id, round: r, membershipId: membership.get(recipient)!, actorUserId: manager, now: day } as never);
      await stamp(ctx, day);
      await payouts.approvePayout({ associationId: A, payoutId: prepared.payout.id, actorUserId: admin, confirmSelfApproval: manager === admin, now: at(day, 1) } as never);
      await payouts.recordPayoutPaid({ associationId: A, payoutId: prepared.payout.id, actorUserId: manager, reference: `DEMO-PAYOUT-${A}-${pot.id}-${r}`, now: at(day, 2) } as never);
      await stamp(ctx, at(day, 2));
      bump(counts, 'ajoPayouts');
    }
  }
  if (completed) {
    await payouts.completeGroup({ associationId: A, groupId: pot.id, actorUserId: admin, now: ctx.today });
  } else {
    const run = [{ id: pot.id, associationId: A, timezone: 'Africa/Lagos', cutoffTime: '18:00', name: def.name }];
    const now = new Date();
    await lateFees.markOverdue(now, run);
    await lateFees.assessLateFees(now, run);
    await lateFees.noticeLateFees(now, run);
  }
  return counts;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Collector thrift
// ---------------------------------------------------------------------------------------------------------------------------------
export async function seedThrift(ctx: Ctx, t: Tenant, def: ThriftDef): Promise<Counts> {
  const counts: Counts = {};
  const A = t.association.id;
  const manager = managerOf(t);
  const admin = t.adminUserId;
  const collectorAccount = t.byKey.get('ajo-collector') ?? t.byKey.get('collector');
  if (!collectorAccount) throw new Error(`${t.def.short}: a collector persona is required for collector thrift.`);
  const collector = collectorAccount.user.id;
  const preferred = ['saver', 'saver-arrears', 'member', 'member-arrears'];
  const savers = await participants(ctx, t, def.savers, preferred, new Set(t.accounts.filter((a) => a.role !== 'member').map((a) => a.member.id)));
  const arrearsId = (t.byKey.get('saver-arrears') ?? t.byKey.get('member-arrears'))?.member.id;
  Object.assign(mark, await maxIds(ctx));

  const S = daysFrom(ctx.today, -def.days); // first collection day
  const thrift = await groups.createGroup({
    associationId: A, actorUserId: manager, now: daysFrom(S, -9),
    bank: { bankName: def.bank, accountNumber: '0987654321', accountName: def.name.toUpperCase().replace(/[^A-Z ]/g, '').slice(0, 40) },
    fields: { name: def.name, model: 'COLLECTOR_THRIFT', frequency: 'DAILY', contributionKobo: def.dailyKobo, startDate: isoDay(S), cycleLength: def.cycleLength, maxParticipants: Math.max(30, savers.length), collectorFeeType: 'DAYS', collectorFeeValue: 1 } as never,
    rules: { lateFeeType: 'NONE', graceDays: 1, guarantorPolicy: 'OPTIONAL', remindersEnabled: true, memberVisibility: 'OFF' },
  } as never);
  bump(counts, 'ajoCircles');
  await groups.openGroup({ associationId: A, groupId: thrift.id, actorUserId: manager, now: at(daysFrom(S, -9), 1) });

  const membership = new Map<number, number>();
  const amountOf = (i: number) => BigInt(def.dailyKobo) * (i % 4 === 3 ? 2n : 1n);
  for (const [i, mem] of savers.entries()) {
    const m = await members.addMember({ associationId: A, groupId: thrift.id, memberId: mem.id, actorUserId: manager } as never);
    membership.set(mem.id, m.id);
    await consent.acceptRules({ associationId: A, membershipId: m.id, actorUserId: manager, actorIsOfficer: true, note: 'Read aloud on the first collection round and agreed.', now: at(daysFrom(S, -6), 10) } as never);
    mustBeActive(await members.approveMembership({ associationId: A, membershipId: m.id, actorUserId: admin, now: at(daysFrom(S, -6), 11) } as never), def.name);
    if (amountOf(i) !== BigInt(def.dailyKobo)) await cycles.setSaverAmount({ associationId: A, membershipId: m.id, amountKobo: amountOf(i), actorUserId: manager, now: at(daysFrom(S, -5), 10) } as never);
    await collectors.assignCollector({ associationId: A, membershipId: m.id, collectorUserId: collector, actorUserId: manager, dailyTargetKobo: amountOf(i), startsOn: S, now: at(daysFrom(S, -4), 10) } as never);
    bump(counts, 'ajoMemberships');
  }
  await verifiedWithAccount(ctx, t, savers, at(daysFrom(S, -3), 12));
  await groups.startGroup({ associationId: A, groupId: thrift.id, actorUserId: manager, now: at(daysFrom(S, -1), 9) });
  await stamp(ctx, at(daysFrom(S, -1), 9));

  const withdrawer = savers.find((s) => s.id !== arrearsId && !t.accounts.some((a) => a.member.id === s.id)) ?? savers[savers.length - 1];
  const left = new Set<number>();
  let carry = 0n;
  for (let n = 0; n < def.days; n += 1) {
    const day = daysFrom(S, n);
    const cashAt = at(day, 10, 30);
    let total = 0n;
    for (const [i, mem] of savers.entries()) {
      if (left.has(mem.id)) continue;
      const missing = mem.id === arrearsId && n >= def.days - 14 && n < def.days - 1; // the arrears saver has stopped for two weeks
      if (missing) continue;
      if (mem.id !== arrearsId && i % 6 === 5 && n % 9 === 4) continue; // an occasional missed day, so history is not perfectly flat
      await contrib.recordCash({ associationId: A, groupId: thrift.id, membershipId: membership.get(mem.id)!, amountKobo: amountOf(i), idempotencyKey: `demo-cash-${A}-${mem.id}-${n}`, actorUserId: collector, actorCanManage: false, now: cashAt });
      total += amountOf(i);
      bump(counts, 'ajoContributions');
    }
    await stamp(ctx, cashAt);
    if (day.getTime() >= ctx.today.getTime() - DAY_MS) continue; // the last day or two are still with the collector
    const handAt = at(day, 17, 30);
    const handed = await handovers.createHandover({ associationId: A, groupId: thrift.id, collectorUserId: collector, handedOverKobo: total + carry, idempotencyKey: `demo-hand-${A}-${n}`, forDate: day, now: handAt } as never);
    const inHandover = await prisma_ids(ctx, handed.handoverId);
    await handovers.reconcileHandover({ associationId: A, handoverId: handed.handoverId, actorUserId: manager, countedKobo: total + carry, receivedContributionIds: inHandover, note: 'Counted. Correct.', now: at(daysFrom(day, 1), 9) } as never);
    await stamp(ctx, at(daysFrom(day, 1), 9));
    carry = 0n;

    // End of a cycle: everybody continues except one saver in the first cycle, who withdraws and is paid (less the collector's fee).
    const g = await ctx.prisma.ajoGroup.findUniqueOrThrow({ where: { id: thrift.id } });
    if (g.endsOn && isoDay(g.endsOn) === isoDay(day) && n < def.days - 2) {
      const decideAt = at(day, 20);
      for (const [i, mem] of savers.entries()) {
        if (left.has(mem.id)) continue;
        const withdraws = g.cycleNo === 1 && mem.id === withdrawer.id;
        await cycles.decideCycleEnd({ associationId: A, membershipId: membership.get(mem.id)!, choice: withdraws ? 'WITHDRAW' : 'CONTINUE', nextAmountKobo: withdraws ? undefined : amountOf(i), actorUserId: manager, viaOfficer: true, now: decideAt } as never);
      }
      if (g.cycleNo === 1) {
        const payAt = at(daysFrom(day, 1), 10);
        const prepared = await payouts.preparePayout({ associationId: A, groupId: thrift.id, membershipId: membership.get(withdrawer.id)!, actorUserId: manager, now: payAt } as never);
        await stamp(ctx, payAt);
        await payouts.approvePayout({ associationId: A, payoutId: prepared.payout.id, actorUserId: admin, confirmSelfApproval: manager === admin, now: at(payAt, 1) } as never);
        await payouts.recordPayoutPaid({ associationId: A, payoutId: prepared.payout.id, actorUserId: manager, reference: `DEMO-WITHDRAW-${A}-${thrift.id}`, now: at(payAt, 2) } as never);
        await stamp(ctx, at(payAt, 2));
        bump(counts, 'ajoPayouts');
        left.add(withdrawer.id);
      }
      await cycles.startNextCycle({ associationId: A, groupId: thrift.id, actorUserId: manager, now: at(daysFrom(day, 1), 11) });
      await stamp(ctx, at(daysFrom(day, 1), 11));
      bump(counts, 'ajoCycles');
    }
  }
  try {
    const result = await runAjoDailyJobs(new Date(), { groupIds: [thrift.id] });
    if (result.errors.length) ctx.log(`   daily jobs reported: ${result.errors.join('; ').slice(0, 200)}`);
  } catch (error) {
    ctx.log(`   daily jobs skipped: ${(error as Error).message}`);
  }
  return counts;
}

async function prisma_ids(ctx: Ctx, handoverId: number): Promise<number[]> {
  const rows = await ctx.prisma.ajoContribution.findMany({ where: { handoverId, status: 'CASH_RECEIVED' }, select: { id: true } });
  return rows.map((r) => r.id);
}
