/**
 * Demo Ajo Seed: the Thrift (Ajo) data behind the docs screenshots (T11).
 *
 * Adds a believable, entirely fictional Ajo setup to the `demo` association ("Umuoji Cooperative Society") that demo-association.seed.ts
 * made: a rotating pot of ten people partway through its rounds, and a collector-thrift group with a collector, daily cash and handovers.
 * Everything goes through the real Ajo services (so the ledger, receipts and statuses are exactly what the app produces); only a few
 * display-only extras (payout order, verification, one dispute) are written directly.
 *
 * NEVER run this against production. Local/staging only. Every outgoing message sender is silenced (see _demo-stubs.ts), because this
 * machine has real email credentials and the demo addresses are fictional.
 *
 *   pnpm -F @societyledger/api exec tsx prisma/seeds/demo-ajo.seed.ts            # seed
 *   pnpm -F @societyledger/api exec tsx prisma/seeds/demo-ajo.seed.ts --reset    # remove the demo Ajo data, then seed again
 *
 * Run demo-association.seed.ts first. Dates are fixed (2026) so the story is the same each time; statuses such as "overdue" are worked
 * out against the real clock when a screen is opened, so capture the screenshots the same day you seed.
 */
import './_demo-stubs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

import prisma from '../../src/lib/prisma';
import { grantAddonManually } from '../../src/services/billing/lifecycle.service';
import * as groups from '../../src/modules/ajo/ajo-group.service';
import * as members from '../../src/modules/ajo/ajo-membership.service';
import * as consent from '../../src/modules/ajo/ajo-consent.service';
import * as order from '../../src/modules/ajo/ajo-order.service';
import * as contrib from '../../src/modules/ajo/ajo-contribution.service';
import * as payouts from '../../src/modules/ajo/ajo-payout.service';
import * as collectors from '../../src/modules/ajo/ajo-collector.service';
import * as handovers from '../../src/modules/ajo/ajo-handover.service';
import * as cycles from '../../src/modules/ajo/ajo-cycle.service';
import * as lateFees from '../../src/modules/ajo/ajo-latefee.service';
import * as defaults from '../../src/modules/ajo/ajo-default.service';
import * as disputes from '../../src/modules/ajo/ajo-dispute.service';
import * as accounts from '../../src/modules/ajo/ajo-payout-account.service';
import { runAjoDailyJobs } from '../../src/modules/ajo/ajo-risk-cycle';

const A = 2; // the demo association
const PASSWORD = 'password123';
const POT_NAME = 'Umuoji Market Women Ajo';
const THRIFT_NAME = 'Umuoji Daily Savers';
const MIN = 500_000n; // ₦5,000.00 a round
const at = (iso: string) => new Date(iso);
const DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const log = (msg: string) => console.log(`  ${msg}`);

// A real 1x1 PNG, with a few unique bytes after it so no two proofs look like the same slip to the duplicate check.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let proofCounter = 0;
const proof = () => ({ buffer: Buffer.concat([PNG, Buffer.from(`demo-slip-${++proofCounter}`)]), mimeType: 'image/png' });

// ---------------------------------------------------------------------------------------------------------------------------------
// Keeping fixture times honest: the ledger and receipts stamp the real clock, so each step re-stamps what it just wrote.
// ---------------------------------------------------------------------------------------------------------------------------------
const mark = { ledger: 0, contribution: 0, payout: 0, receipt: 0 };
async function maxIds() {
  const [l, c, p, r] = await Promise.all([
    prisma.ajoLedgerEntry.aggregate({ _max: { id: true } }),
    prisma.ajoContribution.aggregate({ _max: { id: true } }),
    prisma.ajoPayout.aggregate({ _max: { id: true } }),
    prisma.ajoReceipt.aggregate({ _max: { id: true } }),
  ]);
  return { ledger: l._max.id ?? 0, contribution: c._max.id ?? 0, payout: p._max.id ?? 0, receipt: r._max.id ?? 0 };
}
async function stamp(when: Date) {
  await prisma.ajoLedgerEntry.updateMany({ where: { id: { gt: mark.ledger } }, data: { createdAt: when } });
  await prisma.ajoContribution.updateMany({ where: { id: { gt: mark.contribution } }, data: { createdAt: when } });
  await prisma.ajoPayout.updateMany({ where: { id: { gt: mark.payout } }, data: { preparedAt: when } });
  await prisma.ajoReceipt.updateMany({ where: { id: { gt: mark.receipt } }, data: { createdAt: when } });
  Object.assign(mark, await maxIds());
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------------------------------------------------------------
const TABLES = [
  'ajo_contribution_allocations', 'ajo_receipts', 'ajo_disputes', 'ajo_case_events', 'ajo_repayment_plans', 'ajo_default_cases',
  'ajo_late_fee_assessments', 'ajo_ledger_entries', 'ajo_payouts', 'ajo_contributions', 'ajo_cash_handovers', 'ajo_collector_assignments',
  'ajo_installments', 'ajo_membership_cycles', 'ajo_payout_slots', 'ajo_order_change_requests', 'ajo_payout_order_events', 'ajo_guarantor_invites',
  'ajo_trust_snapshots', 'ajo_rule_acceptances', 'ajo_reminders', 'ajo_circle_notices', 'ajo_statement_codes', 'ajo_levy_assessments',
];
async function reset() {
  console.log('Removing the demo Ajo data...');
  const groupIds = (await prisma.ajoGroup.findMany({ where: { associationId: A }, select: { id: true } })).map((g) => g.id);
  for (const table of TABLES) {
    try {
      const n = await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE association_id = ${A}`);
      if (n) log(`${table}: ${n}`);
    } catch (e) {
      // A table without an association_id column is cleared through its group instead.
      try {
        if (groupIds.length) await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE group_id IN (${groupIds.join(',')})`);
      } catch {
        log(`${table}: skipped (${(e as Error).message.split('\n').pop()?.slice(0, 80)})`);
      }
    }
  }
  await prisma.ajoMembership.deleteMany({ where: { associationId: A } });
  await prisma.ajoGroupRuleVersion.deleteMany({ where: { associationId: A } });
  await prisma.ajoGroup.deleteMany({ where: { associationId: A } });
  await prisma.ajoGuarantorAgreement.deleteMany({ where: { associationId: A } });
  await prisma.ajoVerification.deleteMany({ where: { associationId: A } });
  await prisma.ajoPayoutAccount.deleteMany({ where: { associationId: A } });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------------------------------------------------
async function ensureLogin(email: string, first: string, last: string, roleName: string, phone: string) {
  let user = await prisma.user.findFirst({ where: { associationId: A, email } });
  if (!user) user = await prisma.user.create({ data: { associationId: A, email, passwordHash: await bcrypt.hash(PASSWORD, 10), isActive: true, emailVerified: true } as never });
  let member = await prisma.member.findFirst({ where: { associationId: A, userId: user.id } });
  if (!member) member = await prisma.member.create({ data: { associationId: A, userId: user.id, memberId: `DEMO-${email.split('@')[0].toUpperCase()}`, firstName: first, lastName: last, status: 'active', phone } });
  const role = await prisma.role.findFirstOrThrow({ where: { associationId: A, name: roleName } });
  const has = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, associationId: A } });
  if (!has) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, associationId: A } });
  return { user, member };
}

// ---------------------------------------------------------------------------------------------------------------------------------
/** A login for one of the collector-thrift savers (Chukwuemeka Mohammed, member 11), so the saver's own screens can be shown. */
async function ensureSaverLogin() {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: 11 } });
  if (member.userId) return;
  const user = await prisma.user.create({ data: { associationId: A, email: 'saver@demo.com', passwordHash: await bcrypt.hash(PASSWORD, 10), isActive: true, emailVerified: true } as never });
  await prisma.member.update({ where: { id: 11 }, data: { userId: user.id } });
  const role = await prisma.role.findFirstOrThrow({ where: { associationId: A, name: 'member' } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, associationId: A } });
  log('saver@demo.com created for Chukwuemeka Mohammed');
}

async function main() {
  const wantReset = process.argv.includes('--reset');
  if (wantReset) await reset();
  if (await prisma.ajoGroup.findFirst({ where: { associationId: A, name: POT_NAME } })) {
    await ensureSaverLogin();
    console.log('The demo Ajo data is already there. Run with --reset to build it again.');
    return;
  }
  const assoc = await prisma.association.findUnique({ where: { id: A } });
  if (!assoc || assoc.subdomain !== 'demo') throw new Error('The demo association (id 2) was not found. Run demo-association.seed.ts first.');
  Object.assign(mark, await maxIds());

  // ---- 1. Billing: the demo subscription had run out, and the demo tenant needs the Business tier so every report is open.
  console.log('1. Billing');
  const sub = await prisma.subscription.findFirst({ where: { associationId: A }, orderBy: { id: 'desc' } });
  if (!sub) throw new Error('The demo association has no subscription.');
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE', currentPeriodEnd: at('2027-10-31T00:00:00Z') } as never });
  const superAdmin = await prisma.user.findFirstOrThrow({ where: { platformRole: 'SUPER_ADMIN' }, orderBy: { id: 'asc' }, select: { id: true } });
  const business = await prisma.addon.findUniqueOrThrow({ where: { code: 'ajo-business' } });
  const holds = await prisma.tenantAddon.findFirst({ where: { associationId: A, status: 'ACTIVE', addonVersion: { addon: { family: 'ajo' } } } });
  if (!holds) {
    await grantAddonManually({ associationId: A, addonId: business.id, reason: 'Demo data for the documentation screenshots', actor: { id: superAdmin.id, role: 'SUPER_ADMIN' } });
    log('Ajo Business granted');
  }

  // ---- 2. People
  console.log('2. People');
  const adaeze = { user: await prisma.user.findFirstOrThrow({ where: { associationId: A, email: 'admin@demo.com' } }), member: await prisma.member.findFirstOrThrow({ where: { id: 1 } }) };
  const tunde = { user: await prisma.user.findFirstOrThrow({ where: { associationId: A, email: 'treasurer@demo.com' } }), member: await prisma.member.findFirstOrThrow({ where: { id: 2 } }) };
  const ngozi = { user: await prisma.user.findFirstOrThrow({ where: { associationId: A, email: 'member@demo.com' } }), member: await prisma.member.findFirstOrThrow({ where: { id: 3 } }) };
  const funke = await ensureLogin('officer@demo.com', 'Funke', 'Adeyemi', 'ajo_officer', '08035550101');
  const ibrahim = await ensureLogin('collector@demo.com', 'Ibrahim', 'Musa', 'ajo_collector', '08035550102');
  // Phone numbers for everyone in the circles, so reminders and the phone screens have something to show.
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  for (const id of ids) await prisma.member.update({ where: { id }, data: { phone: `0803555${String(200 + id).padStart(4, '0')}` } });
  const M = (id: number) => id; // a readable name for "member id"

  // ---- 3. The rotating pot
  console.log('3. The rotating pot');
  const pot = await groups.createGroup({
    associationId: A,
    actorUserId: funke.user.id,
    now: at('2026-08-20T09:00:00Z'),
    bank: { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'UMUOJI MARKET WOMEN AJO' },
    fields: { name: POT_NAME, model: 'ROTATING_POT', frequency: 'WEEKLY', contributionKobo: Number(MIN), startDate: '2026-09-04', maxParticipants: 10, maxSharesPerMember: 1 } as never,
    rules: { lateFeeType: 'FIXED', lateFeeValue: 50_000, lateFeeCapKobo: 100_000, graceDays: 3, guarantorPolicy: 'OPTIONAL', defaultProcedure: 'CASE_AND_PLAN', remindersEnabled: true, memberVisibility: 'FULL', nameDisplay: 'FIRST_INITIAL' },
  } as never);
  await groups.openGroup({ associationId: A, groupId: pot.id, actorUserId: funke.user.id, now: at('2026-08-20T09:30:00Z') });

  const potPeople = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(M);
  const potMembership = new Map<number, number>();
  for (const [i, memberId] of potPeople.entries()) {
    const when = at(`2026-08-2${1 + (i % 5)}T10:00:00Z`);
    const m = await members.addMember({ associationId: A, groupId: pot.id, memberId, actorUserId: funke.user.id } as never);
    potMembership.set(memberId, m.id);
    const login = memberId === 1 ? adaeze.user.id : memberId === 2 ? tunde.user.id : memberId === 3 ? ngozi.user.id : null;
    await consent.acceptRules({ associationId: A, membershipId: m.id, actorUserId: login ?? funke.user.id, actorIsOfficer: login === null, note: login === null ? 'Read aloud at the market meeting and agreed in person.' : undefined, now: when } as never);
    await members.approveMembership({ associationId: A, membershipId: m.id, actorUserId: funke.user.id === (login ?? -1) ? adaeze.user.id : funke.user.id, now: when } as never);
  }
  log(`${potMembership.size} people approved`);

  // Payout accounts and SocietyLedger verification, so payouts can be prepared.
  const bankFor = (id: number) => ['GTBank', 'Access Bank', 'First Bank', 'Zenith Bank', 'UBA'][id % 5];
  for (const memberId of potPeople) {
    const mem = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    await accounts.setPayoutAccount({ associationId: A, memberId, bankName: bankFor(memberId), accountNumber: `02${String(30000000 + memberId * 1117).slice(0, 8)}`, accountName: `${mem.firstName} ${mem.lastName}`.toUpperCase(), actorUserId: funke.user.id, now: at('2026-08-27T10:00:00Z') });
  }
  const verified = [4, 6, 2, 3, 5, 7, 1, 8]; // everyone but the last two, who are still waiting for SocietyLedger's check
  for (const memberId of potPeople) {
    const mem = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
    const has = await prisma.ajoVerification.findFirst({ where: { associationId: A, memberId } });
    const base = { submittedName: `${mem.firstName} ${mem.lastName}`, submittedPhone: mem.phone, submittedAddress: `${12 + memberId} Market Road, Umuoji`, submittedAccountName: `${mem.firstName} ${mem.lastName}`.toUpperCase() };
    const done = verified.includes(memberId) ? { status: 'VERIFIED', nameMatchesAccount: true, phoneConfirmed: true, addressFilled: true, reviewedBy: superAdmin.id, reviewedAt: at('2026-08-31T11:00:00Z') } : { status: 'PENDING' };
    if (has) await prisma.ajoVerification.update({ where: { id: has.id }, data: { ...base, ...done } as never });
    else await prisma.ajoVerification.create({ data: { associationId: A, memberId, createdAt: at('2026-08-28T09:00:00Z'), ...base, ...done } as never });
  }

  // A guarantor on file for two people.
  for (const memberId of [4, 9]) {
    await consent.recordGuarantorConsent({ associationId: A, membershipId: potMembership.get(memberId)!, actorUserId: funke.user.id, name: memberId === 4 ? 'Mrs Ifeoma Suleiman' : 'Mr Segun Agbaje', phone: memberId === 4 ? '08035550142' : '08035550143', relationship: memberId === 4 ? 'Sister' : 'Brother', note: 'The wording was read to the guarantor by phone and they agreed.', now: at('2026-08-29T12:00:00Z') } as never).catch((e: Error) => log(`guarantor skipped: ${e.message}`));
  }

  // The draw, then the order the story needs. The draw is random and cannot be seeded, so after it the slots are set to a fixed order
  // (the recorded draw event is updated to match, so the order page and its history agree).
  await order.runDraw({ associationId: A, groupId: pot.id, actorUserId: funke.user.id, now: at('2026-09-02T10:00:00Z') });
  await prisma.ajoPayoutOrderEvent.updateMany({ where: { groupId: pot.id, type: 'DRAW' }, data: { createdAt: at('2026-09-02T10:00:00Z') } });
  const wanted = [4, 6, 2, 3, 5, 7, 1, 8, 9, 10]; // position 1..10
  await prisma.ajoPayoutSlot.deleteMany({ where: { groupId: pot.id } });
  for (const [i, memberId] of wanted.entries()) await prisma.ajoPayoutSlot.create({ data: { associationId: A, groupId: pot.id, membershipId: potMembership.get(memberId)!, shareNo: 1, position: i + 1 } });
  const drawEvent = await prisma.ajoPayoutOrderEvent.findFirstOrThrow({ where: { groupId: pot.id, type: 'DRAW' }, orderBy: { id: 'desc' } });
  await prisma.ajoPayoutOrderEvent.update({ where: { id: drawEvent.id }, data: { detail: { ...(drawEvent.detail as object), positions: wanted.map((memberId, i) => ({ membershipId: potMembership.get(memberId)!, position: i + 1 })) } } });
  await groups.startGroup({ associationId: A, groupId: pot.id, actorUserId: funke.user.id, now: at('2026-09-03T09:00:00Z') });
  log('draw recorded and the group started');
  await stamp(at('2026-09-03T09:00:00Z'));

  // Payments: rounds 1 to 9, one a week from 4 September. Chidinma (4) stops paying after round 6; Emeka (5) pays round 8 two days late;
  // on round 9 (due today) two payments are reported but not yet confirmed, and one person has a query.
  const ROUND_ONE = '2026-09-04';
  const due = (r: number) => addDays(ROUND_ONE, 7 * (r - 1));
  const confirmerFor = (memberId: number) => (memberId === 1 ? tunde.user.id : adaeze.user.id);
  let paid = 0;
  for (let r = 1; r <= 9; r += 1) {
    for (const memberId of potPeople) {
      if (memberId === 4 && r >= 7) continue; // stops paying
      if (memberId === 9 && r === 9) continue; // has a query instead
      const day = memberId === 5 && r === 8 ? addDays(due(r), 2) : due(r);
      const reportedAt = at(`${day}T0${r === 9 ? 6 : 9}:30:00Z`);
      const own = r === 9 && memberId === 3; // Ngozi reports her own round-9 payment from her phone
      const reported = await contrib.reportTransfer({
        associationId: A, groupId: pot.id, membershipId: potMembership.get(memberId)!, amountKobo: MIN, idempotencyKey: `demo-pot-${memberId}-${r}`,
        actorUserId: own ? ngozi.user.id : funke.user.id, actorCanManage: !own, proof: proof(), now: reportedAt,
        ...(own ? {} : { paidOn: at(day + 'T00:00:00Z') }),
      } as never);
      await stamp(reportedAt);
      const waiting = r === 9 && (memberId === 10 || memberId === 6); // Amina's and Folake's round-9 transfers wait for an officer
      if (!waiting) {
        const confirmedAt = new Date(reportedAt.getTime() + 4 * 3_600_000);
        await contrib.confirmTransfer({ associationId: A, contributionId: reported.contribution.id, actorUserId: confirmerFor(memberId), now: confirmedAt });
        await stamp(confirmedAt);
      }
      paid += 1;
    }
    // Payouts follow their round, in the drawn order (a round cannot be prepared until the one before it is recorded as paid):
    // 1 to 3 are paid out and 4 is approved and waiting to be recorded.
    if (r <= 4) {
      const recipient = wanted[r - 1];
      const day = at(`${addDays(due(r), 1)}T10:00:00Z`);
      const prepared = await payouts.preparePayout({ associationId: A, groupId: pot.id, round: r, membershipId: potMembership.get(recipient)!, actorUserId: funke.user.id, now: day } as never);
      await stamp(day);
      if (r <= 4) {
        await payouts.approvePayout({ associationId: A, payoutId: prepared.payout.id, actorUserId: adaeze.user.id, now: new Date(day.getTime() + 3_600_000) } as never);
      }
      if (r <= 3) {
        await payouts.recordPayoutPaid({ associationId: A, payoutId: prepared.payout.id, actorUserId: funke.user.id, reference: `GTB-DEMO-00${r}-7731`, now: new Date(day.getTime() + 2 * 3_600_000) } as never);
        await stamp(new Date(day.getTime() + 2 * 3_600_000));
      }
    }
  }
  log(`${paid} payments recorded`);

  // Late fees, the default case and the dispute, worked out the way the daily jobs do it, against the real clock.
  const now = new Date();
  const run = [{ id: pot.id, associationId: A, timezone: 'Africa/Lagos', cutoffTime: '18:00', name: POT_NAME }];
  await lateFees.markOverdue(now, run);
  await lateFees.assessLateFees(now, run);
  await lateFees.noticeLateFees(now, run);
  const opened = await defaults.detectDefaults(now, run);
  log(`late fees assessed; ${opened} default case(s) opened`);
  const theCase = await prisma.ajoDefaultCase.findFirst({ where: { groupId: pot.id }, orderBy: { id: 'desc' } });
  if (theCase) {
    const plan = await defaults.proposePlan({ associationId: A, caseId: theCase.id, actorUserId: funke.user.id, periods: 2, now } as never);
    await defaults.agreePlan({ associationId: A, planId: plan.planId, actorUserId: funke.user.id, actorCanManage: true, note: 'Agreed in person at the market meeting.', now } as never).catch((e: Error) => log(`plan not agreed: ${e.message}`));
  }
  const queryInstallment = await prisma.ajoInstallment.findFirstOrThrow({ where: { membershipId: potMembership.get(9)!, dueDate: at(`${due(9)}T00:00:00Z`) } });
  await disputes.raiseDispute({ associationId: A, membershipId: potMembership.get(9)!, installmentId: queryInstallment.id, claim: 'I sent ₦5,000.00 on Thursday evening and attached the slip. It still shows as not paid.', actorUserId: funke.user.id, actorCanManage: true, now } as never);

  // ---- 4. The collector-thrift group
  console.log('4. The collector-thrift group');
  const thrift = await groups.createGroup({
    associationId: A, actorUserId: funke.user.id, now: at('2026-10-10T09:00:00Z'),
    bank: { bankName: 'Access Bank', accountNumber: '0987654321', accountName: 'UMUOJI DAILY SAVERS' },
    fields: { name: THRIFT_NAME, model: 'COLLECTOR_THRIFT', frequency: 'DAILY', contributionKobo: 100_000, startDate: '2026-10-19', cycleLength: 30, maxParticipants: 30, collectorFeeType: 'DAYS', collectorFeeValue: 1 } as never,
    rules: { lateFeeType: 'NONE', graceDays: 1, guarantorPolicy: 'OPTIONAL', remindersEnabled: true, memberVisibility: 'OFF' },
  } as never);
  await groups.openGroup({ associationId: A, groupId: thrift.id, actorUserId: funke.user.id, now: at('2026-10-10T09:30:00Z') });
  const savers = [11, 12, 13, 14, 15];
  const saverMembership = new Map<number, number>();
  for (const memberId of savers) {
    const m = await members.addMember({ associationId: A, groupId: thrift.id, memberId, actorUserId: funke.user.id } as never);
    saverMembership.set(memberId, m.id);
    await consent.acceptRules({ associationId: A, membershipId: m.id, actorUserId: funke.user.id, actorIsOfficer: true, note: 'Read aloud on the first collection round and agreed.', now: at('2026-10-12T10:00:00Z') } as never);
    await members.approveMembership({ associationId: A, membershipId: m.id, actorUserId: adaeze.user.id, now: at('2026-10-12T11:00:00Z') } as never);
  }
  // One more person added but not yet approved, so the approvals screen has something waiting.
  await members.addMember({ associationId: A, groupId: thrift.id, memberId: 16, actorUserId: funke.user.id } as never);
  const amountOf = (memberId: number) => (memberId === 13 || memberId === 15 ? 200_000n : 100_000n);
  for (const memberId of savers) {
    if (amountOf(memberId) !== 100_000n) await cycles.setSaverAmount({ associationId: A, membershipId: saverMembership.get(memberId)!, amountKobo: amountOf(memberId), actorUserId: funke.user.id, now: at('2026-10-14T10:00:00Z') } as never);
    await collectors.assignCollector({ associationId: A, membershipId: saverMembership.get(memberId)!, collectorUserId: ibrahim.user.id, actorUserId: funke.user.id, dailyTargetKobo: amountOf(memberId), startsOn: at('2026-10-19T00:00:00Z'), now: at('2026-10-15T10:00:00Z') } as never);
  }
  await groups.startGroup({ associationId: A, groupId: thrift.id, actorUserId: funke.user.id, now: at('2026-10-18T09:00:00Z') });
  await stamp(at('2026-10-18T09:00:00Z'));

  // Cash, day by day from 19 October to today. Nkechi (14) misses 24 and 25 October; Abdullahi (13) misses 27 October.
  const missed = (memberId: number, day: string) => (memberId === 14 && (day === '2026-10-24' || day === '2026-10-25')) || (memberId === 13 && day === '2026-10-27');
  const today = new Date().toISOString().slice(0, 10);
  let carry = 0n; // cash left behind one evening, handed in with the next day's
  for (let n = 0; n < 12; n += 1) {
    const day = addDays('2026-10-19', n);
    const cashAt = at(`${day}T10:30:00Z`);
    let total = 0n;
    for (const memberId of savers) {
      if (missed(memberId, day)) continue;
      await contrib.recordCash({ associationId: A, groupId: thrift.id, membershipId: saverMembership.get(memberId)!, amountKobo: amountOf(memberId), idempotencyKey: `demo-cash-${memberId}-${day}`, actorUserId: ibrahim.user.id, actorCanManage: false, now: cashAt });
      total += amountOf(memberId);
    }
    await stamp(cashAt);
    if (day >= today) continue; // today's cash is still with the collector
    const handAt = at(`${day}T17:30:00Z`);
    // One evening the collector does not hand in one saver's ₦1,000.00 (Chukwuemeka's). The officer counts what was handed in and leaves that payment unticked.
    const short = day === '2026-10-23' ? 100_000n : 0n;
    const handed = await handovers.createHandover({ associationId: A, groupId: thrift.id, collectorUserId: ibrahim.user.id, handedOverKobo: total + carry - short, idempotencyKey: `demo-hand-${day}`, note: short ? "Chukwuemeka's ₦1,000.00 is still with me. I will bring it in the morning." : undefined, forDate: at(`${day}T00:00:00Z`), now: handAt } as never);
    if (day <= '2026-10-28') {
      const inHandover = await prisma.ajoContribution.findMany({ where: { handoverId: handed.handoverId, status: 'CASH_RECEIVED' }, select: { id: true, membershipId: true } });
      const received = inHandover.filter((c) => !(short > 0n && c.membershipId === saverMembership.get(11))).map((c) => c.id);
      await handovers.reconcileHandover({ associationId: A, handoverId: handed.handoverId, actorUserId: funke.user.id, countedKobo: total + carry - short, receivedContributionIds: received, note: short ? "Counted at the office. Chukwuemeka's ₦1,000.00 was not in the bag, as the collector said. It is to come the next morning." : 'Counted. Correct.', now: at(`${addDays(day, 1)}T09:00:00Z`) } as never);
    }
    carry = short;
    await stamp(at(`${addDays(day, 1)}T09:00:00Z`));
  }
  log('daily cash and handovers recorded');

  // ---- 5. The daily jobs: trust scores and circle notices (their messages are silenced).
  console.log('5. Daily jobs');
  try {
    log(JSON.stringify(await runAjoDailyJobs(new Date(), { groupIds: [pot.id, thrift.id] })));
  } catch (e) {
    log(`daily jobs skipped: ${(e as Error).message}`);
  }

  await ensureSaverLogin();
  console.log('Done. Logins (password123): admin@demo.com (admin), officer@demo.com (Ajo officer), collector@demo.com (collector), member@demo.com (Ngozi, in the pot), saver@demo.com (Chukwuemeka, a collector-thrift saver), treasurer@demo.com (Tunde, in the pot).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
