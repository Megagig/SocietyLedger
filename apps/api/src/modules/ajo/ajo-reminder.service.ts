/**
 * Reminders and the officers' daily digest (T6.1).
 *
 * "A job run twice sends one reminder" is a database fact: every reminded item is a row in `ajo_reminders` with a unique key, written
 * BEFORE anything is sent. A second run, or a second API server running the same job, finds the row and sends nothing.
 *
 * People with a login are reminded in-app, by push and by email, which costs nothing. People with no login are reminded by SMS, which costs
 * the group a credit. A reminder that arrives late is worse than none, so when credits run out the SMS reminders are skipped (not queued)
 * and the officers are told once. Receipts keep priority: reminders never spend credits that a receipt needs, because they are skipped first.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { verificationState } from './ajo-dispute.service';
import { messageMember, type MessageResult } from './ajo-messenger';
import { composeDigest, composeReminder, planReminders, type ReminderLine } from './ajo-risk';
import { businessDay } from './ajo-schedule';
import { notifyPermissionHolders } from './ajo-support';
import type { RunGroup } from './ajo-latefee.service';

/** Reminders go out from this hour of the group's own morning. */
export const REMINDER_HOUR = 8;

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

function localHour(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  return Number(parts.find((p) => p.type === 'hour')?.value);
}

async function remember(data: Prisma.AjoReminderUncheckedCreateInput): Promise<number | null> {
  try {
    return (await prisma.ajoReminder.create({ data })).id;
  } catch (error) {
    if (isUnique(error)) return null; // already sent (by an earlier run or another server)
    throw error;
  }
}

export interface ReminderRun {
  reminded: number;
  skippedNoCredits: number;
  digests: number;
}

export async function runReminders(now: Date, groups: RunGroup[], deps: { send?: Parameters<typeof messageMember>[0]['send'] } = {}): Promise<ReminderRun> {
  const run: ReminderRun = { reminded: 0, skippedNoCredits: 0, digests: 0 };
  const alerted = new Set<number>();

  for (const g of groups) {
    if (localHour(now, g.timezone) < REMINDER_HOUR) continue;
    const today = businessDay(now, g.timezone, g.cutoffTime);
    const version = await prisma.ajoGroupRuleVersion.findFirst({ where: { groupId: g.id, effectiveFrom: { lte: now } }, orderBy: { version: 'desc' } });
    if (!version || !version.remindersEnabled) continue;
    const group = await prisma.ajoGroup.findUniqueOrThrow({ where: { id: g.id }, select: { frequency: true } });
    const hasLateFee = version.lateFeeType !== 'NONE' && version.lateFeeValue > 0n;
    const oneDay = 24 * 60 * 60 * 1000;

    const people = await prisma.ajoMembership.findMany({
      where: { groupId: g.id, status: 'ACTIVE' },
      select: { id: true, member: { select: { id: true, userId: true, firstName: true, lastName: true, phone: true } }, installments: { where: { status: { not: 'WAIVED' }, dueDate: { gte: new Date(today.getTime() - 40 * oneDay), lte: new Date(today.getTime() + oneDay) } }, select: { id: true, dueDate: true, amountKobo: true, paidKobo: true } } },
    });

    const overdueForDigest: Array<{ name: string; overdueKobo: bigint }> = [];
    for (const p of people) {
      const open = p.installments.map((i) => ({ id: i.id, dueDate: i.dueDate, remainingKobo: i.amountKobo - i.paidKobo }));
      const name = `${p.member.firstName} ${p.member.lastName}`.trim();
      const overdueKobo = open.filter((i) => i.remainingKobo > 0n && i.dueDate.getTime() < today.getTime()).reduce((s, i) => s + i.remainingKobo, 0n);
      const check = await verificationState(prisma, p.id);
      if (overdueKobo > 0n && !check.pending) overdueForDigest.push({ name, overdueKobo });

      let planned = planReminders({ today, frequency: group.frequency, graceDays: version.graceDays, hasLateFee, membershipId: p.id, installments: open });
      // While a payment of theirs is being verified, or a dispute is open, they are not chased for being late.
      if (check.pending) planned = planned.filter((r) => r.kind === 'UPCOMING');

      const fresh: Array<{ id: number; plan: (typeof planned)[number] }> = [];
      for (const plan of planned) {
        const id = await remember({ associationId: g.associationId, membershipId: p.id, installmentId: plan.installmentIds.length === 1 ? plan.installmentIds[0] : null, kind: plan.kind, dedupeKey: plan.dedupeKey, state: 'SENT' });
        if (id !== null) fresh.push({ id, plan });
      }
      if (!fresh.length) continue;

      const byId = new Map(open.map((i) => [i.id, i]));
      const lines: ReminderLine[] = fresh.flatMap(({ plan }) => plan.installmentIds.map((id) => ({ kind: plan.kind, dueDate: (byId.get(id) as (typeof open)[number]).dueDate, remainingKobo: (byId.get(id) as (typeof open)[number]).remainingKobo })));
      const { title, message } = composeReminder({ groupName: g.name, lines });
      const result: MessageResult = await messageMember({ associationId: g.associationId, member: p.member, title, message, pushType: 'ajo.reminder', kind: 'payment_due', sms: true, send: deps.send });
      await prisma.ajoReminder.updateMany({ where: { id: { in: fresh.map((f) => f.id) } }, data: { state: result.delivered ? 'SENT' : 'SKIPPED', message, channels: { channel: result.channel, ...(result.reason ? { reason: result.reason } : {}) } } });
      if (result.delivered) run.reminded++;
      if (result.reason === 'NO_SMS_CREDITS') {
        run.skippedNoCredits++;
        if (!alerted.has(g.associationId)) {
          alerted.add(g.associationId);
          const key = `skipalert:${g.associationId}:${today.toISOString().slice(0, 10)}`;
          if ((await remember({ associationId: g.associationId, kind: 'DIGEST', dedupeKey: key, state: 'SENT', message: 'Reminders were skipped because the SMS credits ran out.' })) !== null) {
            await notifyPermissionHolders(g.associationId, 'ajo.manage', { pushType: 'ajo.reminders_skipped', title: 'Reminders were skipped', message: 'Some contributors could not be sent a reminder because the SMS credits ran out. Reminders that are not sent on time are not sent late. Buy credits to carry on.' });
          }
        }
      }
    }

    if (overdueForDigest.length) {
      const key = `digest:g${g.id}:${today.toISOString().slice(0, 10)}`;
      const { title, message } = composeDigest({ groupName: g.name, people: overdueForDigest });
      if ((await remember({ associationId: g.associationId, kind: 'DIGEST', dedupeKey: key, state: 'SENT', message })) !== null) {
        await notifyPermissionHolders(g.associationId, 'ajo.manage', { pushType: 'ajo.overdue_digest', title, message });
        run.digests++;
      }
    }
  }
  return run;
}
