/**
 * Meetings, elections and polls, welfare funds, announcements, notifications and audit entries for an association. These modules have
 * no balances that depend on a service's arithmetic beyond what is computed here (fund balance, vote counts), and those totals are
 * checked again by the invariants at the end of the seed.
 */
import { Ctx, Tenant, activeRoll } from './core';
import type { Counts } from './finance';
import { daysFrom } from './util';

const bump = (c: Counts, key: string, n = 1) => { c[key] = (c[key] ?? 0) + n; };

export async function seedMeetings(ctx: Ctx, t: Tenant): Promise<Counts> {
  const counts: Counts = {};
  if (!t.def.modules.meetings) return counts;
  const { prisma } = ctx;
  const secretary = t.byKey.get('secretary')?.user.id ?? t.adminUserId;
  const roll = activeRoll(t).slice(0, 40);
  const plan: Array<{ title: string; type: 'REGULAR' | 'AGM' | 'EGM' | 'COMMITTEE' | 'SPECIAL'; offset: number; status: 'COMPLETED' | 'SCHEDULED' | 'CANCELLED'; place: string }> = [
    { title: 'Annual General Meeting', type: 'AGM', offset: -300, status: 'COMPLETED', place: 'Community hall' },
    { title: 'Monthly General Meeting', type: 'REGULAR', offset: -200, status: 'COMPLETED', place: 'Community hall' },
    { title: 'Executive Committee Meeting', type: 'COMMITTEE', offset: -120, status: 'COMPLETED', place: 'Chairman residence' },
    { title: 'Extraordinary General Meeting: levy approval', type: 'EGM', offset: -45, status: 'COMPLETED', place: 'Community hall' },
    { title: 'Monthly General Meeting', type: 'REGULAR', offset: 10, status: 'SCHEDULED', place: 'Community hall' },
    { title: 'Special Meeting: end-of-year review', type: 'SPECIAL', offset: 40, status: 'SCHEDULED', place: 'Online (Google Meet)' },
    { title: 'Executive Committee Meeting (postponed indefinitely)', type: 'COMMITTEE', offset: -20, status: 'CANCELLED', place: 'Chairman residence' },
  ];
  for (const [i, p] of plan.entries()) {
    const start = new Date(daysFrom(ctx.today, p.offset).getTime() + 10 * 3_600_000);
    const meeting = await prisma.meeting.create({
      data: {
        associationId: t.association.id, title: p.title, description: 'Attendance is compulsory for all members in good standing.', meetingType: p.type, location: p.place,
        virtualLink: p.place.startsWith('Online') ? 'https://meet.google.com/demo-only-link' : null, startTime: start, endTime: new Date(start.getTime() + 2.5 * 3_600_000), status: p.status,
        quorumRequired: Math.ceil(roll.length / 3), createdBy: secretary, createdAt: daysFrom(start, -14),
        cancelledBy: p.status === 'CANCELLED' ? t.adminUserId : null, cancelledAt: p.status === 'CANCELLED' ? daysFrom(ctx.today, -22) : null, cancellationReason: p.status === 'CANCELLED' ? 'Chairman travelling; to be rescheduled.' : null,
      },
    });
    bump(counts, 'meetings');
    for (const [n, item] of ['Opening prayer and roll call', 'Reading of previous minutes', 'Treasurer report', 'Matters arising', 'Any other business'].entries()) {
      await prisma.meetingAgenda.create({ data: { meetingId: meeting.id, orderNumber: n + 1, title: item, duration: 15 + n * 5, presenter: n === 2 ? 'The Treasurer' : null } });
    }
    if (p.status === 'COMPLETED') {
      const statuses = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'ABSENT', 'APOLOGY'] as const;
      for (const [k, m] of roll.entries()) {
        const status = statuses[(k + i) % statuses.length];
        await prisma.meetingAttendance.create({
          data: { meetingId: meeting.id, memberId: m.id, status, checkInTime: status === 'PRESENT' || status === 'LATE' ? new Date(start.getTime() + (status === 'LATE' ? 25 : 2) * 60_000) : null, apologyReason: status === 'APOLOGY' ? 'Out of town on business' : null, markedBy: secretary, markedAt: start },
        });
      }
      bump(counts, 'attendanceRecords', roll.length);
      const approved = i < 3; // the most recent minutes are still waiting for approval
      await prisma.meetingMinutes.create({
        data: {
          meetingId: meeting.id,
          content: `The meeting was called to order at 10:00 am. Quorum was formed. The minutes of the last meeting were read and adopted. The Treasurer presented the financial report, which was received. Members discussed matters arising and the meeting closed with a vote of thanks.`,
          decisions: '1. Financial report adopted.\n2. Dues remain unchanged for the year.\n3. A committee will follow up on defaulting members.',
          actionItems: '1. Treasurer to circulate statements of account.\n2. Secretary to send reminders to members in arrears.',
          nextMeetingDate: daysFrom(start, 30), recordedBy: secretary, approvedBy: approved ? t.adminUserId : null, approvedAt: approved ? daysFrom(start, 14) : null,
        },
      });
      bump(counts, 'minutes');
    }
  }
  return counts;
}

export async function seedVoting(ctx: Ctx, t: Tenant): Promise<Counts> {
  const counts: Counts = {};
  const { prisma } = ctx;
  const flags = t.def.modules;
  const roll = activeRoll(t);
  const personaIds = new Set(t.accounts.filter((a) => a.role === 'member').map((a) => a.member.id));
  const voters = roll.filter((m) => !personaIds.has(m.id));
  const committee = t.byKey.get('elections')?.user.id ?? t.adminUserId;

  if (flags.elections) {
    const positions = ['Chairperson', 'Secretary', 'Treasurer'];
    // 1. A finished election with published results.
    const done = await prisma.election.create({
      data: {
        associationId: t.association.id, title: 'Executive Committee Election', description: 'Election of the executive committee for the current term.', electionType: 'EXECUTIVE', status: 'RESULTS_PUBLISHED',
        nominationStartDate: daysFrom(ctx.today, -150), nominationEndDate: daysFrom(ctx.today, -135), votingStartDate: daysFrom(ctx.today, -130), votingEndDate: daysFrom(ctx.today, -128),
        eligibleVoterCount: voters.length, createdBy: committee, publishedBy: committee, publishedAt: daysFrom(ctx.today, -127), createdAt: daysFrom(ctx.today, -160),
      },
    });
    let total = 0;
    for (const [pi, title] of positions.entries()) {
      const pos = await prisma.electionPosition.create({ data: { electionId: done.id, title, orderNumber: pi, maxCandidates: 1 } });
      const contenders = [roll[(pi * 2 + 3) % roll.length], roll[(pi * 2 + 4) % roll.length]];
      const candidates = [];
      for (const [ci, m] of contenders.entries()) {
        candidates.push(await prisma.candidate.create({ data: { electionId: done.id, positionId: pos.id, memberId: m.id, status: 'APPROVED', manifesto: 'I will serve with transparency and accountability.', nominatedBy: committee, approvedBy: committee, approvedAt: daysFrom(ctx.today, -134 + ci) } }));
      }
      const tally = candidates.map(() => 0);
      for (const [vi, v] of voters.entries()) {
        const ci = (vi + pi) % 3 === 0 ? 1 : 0; // the first candidate wins
        tally[ci] += 1;
        await prisma.vote.create({ data: { electionId: done.id, positionId: pos.id, candidateId: candidates[ci].id, voterId: v.id, voteHash: `DEMO-${t.def.short}-${done.id}-${pos.id}-${v.id}`, votedAt: daysFrom(ctx.today, -129) } });
        total += 1;
      }
      for (const [ci, c] of candidates.entries()) await prisma.candidate.update({ where: { id: c.id }, data: { voteCount: tally[ci] } });
    }
    await prisma.election.update({ where: { id: done.id }, data: { totalVotesCast: total } });
    bump(counts, 'elections');
    bump(counts, 'votes', total);

    // 2. An election that is open for voting right now, with some votes already cast (not by the demo member logins).
    const open = await prisma.election.create({
      data: {
        associationId: t.association.id, title: 'By-election: Social Secretary', electionType: 'SPECIAL', status: 'VOTING_OPEN',
        nominationStartDate: daysFrom(ctx.today, -20), nominationEndDate: daysFrom(ctx.today, -8), votingStartDate: daysFrom(ctx.today, -2), votingEndDate: daysFrom(ctx.today, 5),
        eligibleVoterCount: voters.length + personaIds.size, createdBy: committee, createdAt: daysFrom(ctx.today, -25),
      },
    });
    const pos = await prisma.electionPosition.create({ data: { electionId: open.id, title: 'Social Secretary', orderNumber: 0 } });
    const cands = [];
    for (const m of [roll[8], roll[9], roll[10]]) cands.push(await prisma.candidate.create({ data: { electionId: open.id, positionId: pos.id, memberId: m.id, status: 'APPROVED', manifesto: 'Fresh ideas for our social life.', nominatedBy: committee, approvedBy: committee, approvedAt: daysFrom(ctx.today, -9) } }));
    const cast = voters.slice(0, Math.floor(voters.length / 2));
    const tally = [0, 0, 0];
    for (const [vi, v] of cast.entries()) {
      const ci = vi % 3;
      tally[ci] += 1;
      await prisma.vote.create({ data: { electionId: open.id, positionId: pos.id, candidateId: cands[ci].id, voterId: v.id, voteHash: `DEMO-${t.def.short}-${open.id}-${pos.id}-${v.id}`, votedAt: daysFrom(ctx.today, -1) } });
    }
    for (const [ci, c] of cands.entries()) await prisma.candidate.update({ where: { id: c.id }, data: { voteCount: tally[ci] } });
    await prisma.election.update({ where: { id: open.id }, data: { totalVotesCast: cast.length } });
    bump(counts, 'elections');
    bump(counts, 'votes', cast.length);

    // 3. One with nominations still open.
    const nominating = await prisma.election.create({
      data: { associationId: t.association.id, title: 'Welfare Committee Election', electionType: 'COMMITTEE', status: 'NOMINATIONS_OPEN', nominationStartDate: daysFrom(ctx.today, -3), nominationEndDate: daysFrom(ctx.today, 12), votingStartDate: daysFrom(ctx.today, 18), votingEndDate: daysFrom(ctx.today, 20), createdBy: committee },
    });
    await prisma.electionPosition.create({ data: { electionId: nominating.id, title: 'Welfare Committee Member', orderNumber: 0, maxCandidates: 3 } });
    bump(counts, 'elections');
  }

  if (flags.polls) {
    const poll = async (title: string, description: string, status: 'ACTIVE' | 'CLOSED', start: number, end: number, options: string[], responders: number) => {
      const p = await prisma.poll.create({ data: { associationId: t.association.id, title, description, pollType: 'SINGLE_CHOICE', status, startDate: daysFrom(ctx.today, start), endDate: daysFrom(ctx.today, end), isAnonymous: true, showResultsBeforeEnd: status === 'CLOSED', createdBy: t.adminUserId, createdAt: daysFrom(ctx.today, start - 1) } });
      const opts = [];
      for (const [i, o] of options.entries()) opts.push(await prisma.pollOption.create({ data: { pollId: p.id, optionText: o, orderNumber: i } }));
      const counts2 = options.map(() => 0);
      for (const [vi, v] of voters.slice(0, responders).entries()) {
        const oi = (vi * 7 + 1) % options.length;
        counts2[oi] += 1;
        await prisma.pollResponse.create({ data: { pollId: p.id, optionId: opts[oi].id, responderId: v.id, responseHash: `DEMO-${t.def.short}-${p.id}-${v.id}`, respondedAt: daysFrom(ctx.today, start + 1) } });
      }
      for (const [oi, o] of opts.entries()) await prisma.pollOption.update({ where: { id: o.id }, data: { voteCount: counts2[oi] } });
      await prisma.poll.update({ where: { id: p.id }, data: { totalResponses: Math.min(responders, voters.length) } });
      bump(counts, 'polls');
      bump(counts, 'pollResponses', Math.min(responders, voters.length));
    };
    await poll('Should monthly meetings move to the last Saturday of the month?', 'Quick poll to find the best day for most members.', 'ACTIVE', -4, 10, ['Yes, last Saturday', 'No, keep the second Saturday', 'No preference'], 12);
    await poll('Preferred venue for the end-of-year party', 'Closed poll; results are visible.', 'CLOSED', -60, -45, ['Community hall', 'Hotel banquet room', 'Open-air arena'], 18);
  }
  return counts;
}

export async function seedWelfare(ctx: Ctx, t: Tenant): Promise<Counts> {
  const counts: Counts = {};
  if (!t.def.modules.welfare) return counts;
  const { prisma } = ctx;
  const treasurer = t.byKey.get('treasurer')?.user.id ?? t.adminUserId;
  const roll = activeRoll(t);
  const funds: Array<{ name: string; type: 'BEREAVEMENT' | 'MEDICAL' | 'EDUCATION'; monthly: number; mandatory: boolean }> = [
    { name: 'Bereavement Support Fund', type: 'BEREAVEMENT', monthly: 1000, mandatory: true },
    { name: 'Medical Emergency Fund', type: 'MEDICAL', monthly: 500, mandatory: false },
    { name: 'Children Education Fund', type: 'EDUCATION', monthly: 0, mandatory: false },
  ];
  let request = 0;
  for (const [fi, f] of funds.entries()) {
    const fund = await prisma.welfareFund.create({
      data: { associationId: t.association.id, name: f.name, description: `${f.name} for members in need`, fundType: f.type, status: 'ACTIVE', monthlyContribution: f.monthly || null, isContributionMandatory: f.mandatory, maxPayout: 200000, createdBy: t.adminUserId, createdAt: daysFrom(ctx.today, -300) },
    });
    bump(counts, 'welfareFunds');
    let confirmed = 0;
    for (const [i, m] of roll.slice(0, 25).entries()) {
      const status = i % 9 === 8 ? 'PENDING' : 'CONFIRMED';
      const amount = [1000, 2000, 5000][(i + fi) % 3];
      await prisma.welfareContribution.create({
        data: { associationId: t.association.id, fundId: fund.id, memberId: m.id, amount, contributionDate: daysFrom(ctx.today, -90 + i * 3), paymentMethod: 'bank_transfer', reference: `DEMO-WEL-${fund.id}-${m.id}`, status, confirmedBy: status === 'CONFIRMED' ? treasurer : null, confirmedAt: status === 'CONFIRMED' ? daysFrom(ctx.today, -89 + i * 3) : null, recordedBy: treasurer },
      });
      if (status === 'CONFIRMED') confirmed += amount;
      bump(counts, 'welfareContributions');
    }
    const payouts: Array<{ status: 'DISBURSED' | 'APPROVED' | 'PENDING' | 'REJECTED'; amount: number; reason: string; who: number }> =
      fi === 0
        ? [
            { status: 'DISBURSED', amount: 50000, reason: 'Loss of an immediate family member', who: 6 },
            { status: 'PENDING', amount: 50000, reason: 'Loss of a spouse', who: 7 },
          ]
        : fi === 1
          ? [
              { status: 'APPROVED', amount: 40000, reason: 'Hospital bill after a road accident', who: 9 },
              { status: 'REJECTED', amount: 500000, reason: 'Elective cosmetic procedure', who: 10 },
            ]
          : [];
    for (const p of payouts) {
      request += 1;
      await prisma.welfarePayoutRequest.create({
        data: {
          associationId: t.association.id, fundId: fund.id, memberId: roll[p.who % roll.length].id, requestNumber: `DEMO-WP-${t.def.short.toUpperCase()}-${String(request).padStart(4, '0')}`,
          payoutType: f.type === 'BEREAVEMENT' ? 'BEREAVEMENT' : f.type === 'MEDICAL' ? 'MEDICAL' : 'EDUCATION', amount: p.amount, reason: p.reason, status: p.status, requestedAt: daysFrom(ctx.today, -40),
          reviewedBy: p.status !== 'PENDING' ? t.adminUserId : null, reviewedAt: p.status !== 'PENDING' ? daysFrom(ctx.today, -38) : null,
          approvedBy: p.status === 'APPROVED' || p.status === 'DISBURSED' ? t.adminUserId : null, approvedAt: p.status === 'APPROVED' || p.status === 'DISBURSED' ? daysFrom(ctx.today, -36) : null, approvedAmount: p.status === 'APPROVED' || p.status === 'DISBURSED' ? p.amount : null,
          rejectionReason: p.status === 'REJECTED' ? 'The request is outside the fund rules (not an emergency).' : null,
          disbursedBy: p.status === 'DISBURSED' ? treasurer : null, disbursedAt: p.status === 'DISBURSED' ? daysFrom(ctx.today, -34) : null, disbursementMethod: p.status === 'DISBURSED' ? 'bank_transfer' : null, disbursementReference: p.status === 'DISBURSED' ? `DEMO-WP-PAY-${request}` : null,
        },
      });
      if (p.status === 'DISBURSED') confirmed -= p.amount;
      bump(counts, 'welfarePayouts');
    }
    await prisma.welfareFund.update({ where: { id: fund.id }, data: { currentBalance: confirmed } });
  }
  return counts;
}

export async function seedMessages(ctx: Ctx, t: Tenant): Promise<Counts> {
  const counts: Counts = {};
  const { prisma } = ctx;
  const a = t.association.id;
  if (t.def.modules.announcements) {
    const items: Array<[string, string, string]> = [
      ['Welcome to the new SocietyLedger portal', 'All dues, levies and statements are now available online and in the mobile app.', 'info'],
      ['Monthly dues reminder', 'Please clear any outstanding dues before the next general meeting. Contact the treasurer for your statement.', 'important'],
      ['Development levy is open', 'The development levy is now open for payment. The deadline is in one month.', 'important'],
      ['Planned water outage on Saturday', 'There will be no water supply from 8 am to 2 pm on Saturday while the pump is repaired.', 'urgent'],
      ['Thank you to our donors', 'Thank you to everyone who donated to the fundraising campaign. Receipts have been issued.', 'info'],
      ['General meeting next week', 'The next monthly general meeting holds next week. Quorum is required for the vote.', 'info'],
    ];
    for (const [i, [title, message, priority]] of items.entries()) {
      await prisma.announcement.create({
        data: { associationId: a, title, message, priority, audience: 'ALL', status: 'COMPLETED', memberCount: t.roll.length, inAppCount: t.accounts.length, noLoginCount: Math.max(0, t.roll.length - t.accounts.length), createdBy: t.adminUserId, createdAt: daysFrom(ctx.today, -50 + i * 9), completedAt: daysFrom(ctx.today, -50 + i * 9) },
      });
      bump(counts, 'announcements');
    }
  }
  // Notifications for each sign-in: a few read, a few unread.
  const lines = [
    ['Payment received', 'We received your payment. Thank you.', 'payment_received'],
    ['Dues reminder', 'Your monthly dues are coming up. Please pay before the due date.', 'payment_due'],
    ['New announcement', 'A new announcement was posted by the administrator.', 'announcement'],
    ['Meeting reminder', 'A general meeting holds soon. Please plan to attend.', 'system'],
    ['Welcome', 'Welcome to your association on SocietyLedger.', 'system'],
  ];
  for (const acct of t.accounts) {
    for (const [i, [title, message, type]] of lines.entries()) {
      await prisma.notification.create({ data: { associationId: a, userId: acct.user.id, title, message, type, isRead: i >= 3, createdAt: daysFrom(ctx.today, -i * 4) } });
      bump(counts, 'notifications');
    }
  }
  // A short admin history in the audit log (the services write their own entries for expenses, Ajo, etc.).
  const events: Array<[string, string, number]> = [
    ['MEMBER_CREATED', 'members', 5], ['MEMBER_UPDATED', 'members', 12], ['SETTINGS_UPDATED', 'settings', 30], ['ROLE_ASSIGNED', 'user_roles', 45], ['PAYMENT_CONFIRMED', 'payments', 60], ['USER_APPROVED', 'user_approvals', 90],
  ];
  for (const [action, tableName, ago] of events) {
    await prisma.auditLog.create({ data: { associationId: a, userId: t.adminUserId, action, tableName, recordId: t.roll[1]?.id ?? null, newValues: { demo: true }, createdAt: daysFrom(ctx.today, -ago) } });
    bump(counts, 'auditEntries');
  }
  return counts;
}
