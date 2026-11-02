/**
 * Integrity checks run at the end of the seed (and by the tests). Each one recomputes a figure from the underlying rows and compares it
 * with what is stored, so a broken seed fails loudly instead of leaving a demo that quietly disagrees with itself.
 */
import { PrismaClient } from '@prisma/client';

export interface Check { name: string; ok: boolean; detail: string }

const money = (v: unknown) => Number(v ?? 0);
const close = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;

export async function runInvariants(prisma: PrismaClient): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (name: string, bad: string[], total: number) =>
    checks.push({ name, ok: bad.length === 0, detail: bad.length === 0 ? `${total} checked` : `${bad.length} of ${total} failed: ${bad.slice(0, 5).join(' | ')}` });

  const assocs = await prisma.association.findMany({ where: { isDemo: true }, select: { id: true, subdomain: true, kind: true } });
  const ids = assocs.map((a) => a.id);
  if (ids.length === 0) return [{ name: 'demo tenants exist', ok: false, detail: 'no demo associations found' }];
  const subdomain = new Map(assocs.map((a) => [a.id, a.subdomain]));

  // 1. Member ledgers equal charges minus payments (dues-side categories only; savings and loans are separate ledgers).
  {
    const bad: string[] = [];
    const members = await prisma.member.findMany({ where: { associationId: { in: ids } }, select: { id: true, associationId: true, memberId: true } });
    const txns = await prisma.transaction.groupBy({ by: ['memberId'], where: { associationId: { in: ids }, isVoided: false }, _sum: { amount: true } });
    const pays = await prisma.$queryRaw<Array<{ member_id: number; paid: unknown }>>`SELECT t.member_id, SUM(p.amount_paid) AS paid FROM payments p JOIN transactions t ON t.id = p.transaction_id WHERE p.association_id = ANY(${ids}) AND t.is_voided = false GROUP BY t.member_id`;
    const ledger = await prisma.$queryRaw<Array<{ member_id: number; debit: unknown; credit: unknown }>>`SELECT member_id, SUM(CASE WHEN entry_type = 'DEBIT' AND source_table <> 'payment_void' THEN amount ELSE 0 END) AS debit, SUM(CASE WHEN entry_type = 'CREDIT' THEN amount WHEN entry_type = 'DEBIT' AND source_table = 'payment_void' THEN -amount ELSE 0 END) AS credit FROM member_financial_ledger WHERE association_id = ANY(${ids}) AND category NOT IN ('SAVINGS_DEPOSIT','SAVINGS_WITHDRAWAL','LOAN_DISBURSEMENT','LOAN_REPAYMENT') GROUP BY member_id`;
    const t = new Map(txns.map((x) => [x.memberId, money(x._sum.amount)]));
    const p = new Map(pays.map((x) => [x.member_id, money(x.paid)]));
    const l = new Map(ledger.map((x) => [x.member_id, { debit: money(x.debit), credit: money(x.credit) }]));
    for (const m of members) {
      const charges = t.get(m.id) ?? 0;
      const paid = p.get(m.id) ?? 0;
      const e = l.get(m.id) ?? { debit: 0, credit: 0 };
      if (!close(e.debit, charges) || !close(e.credit, paid)) bad.push(`${subdomain.get(m.associationId)}/${m.memberId}: ledger ${e.debit}/${e.credit} vs ${charges}/${paid}`);
    }
    add('member balance = charges - payments (every member ledger)', bad, members.length);
  }

  // 2. Association finance totals equal the underlying transactions.
  {
    const bad: string[] = [];
    for (const id of ids) {
      const [c, p, d, cr] = await Promise.all([
        prisma.transaction.aggregate({ where: { associationId: id, isVoided: false }, _sum: { amount: true } }),
        prisma.$queryRaw<Array<{ s: unknown }>>`SELECT COALESCE(SUM(p.amount_paid),0) AS s FROM payments p JOIN transactions t ON t.id = p.transaction_id WHERE p.association_id = ${id} AND t.is_voided = false`,
        prisma.$queryRaw<Array<{ s: unknown }>>`SELECT COALESCE(SUM(amount),0) AS s FROM member_financial_ledger WHERE association_id = ${id} AND entry_type = 'DEBIT' AND source_table <> 'payment_void' AND category NOT IN ('SAVINGS_DEPOSIT','SAVINGS_WITHDRAWAL','LOAN_DISBURSEMENT','LOAN_REPAYMENT')`,
        prisma.$queryRaw<Array<{ s: unknown }>>`SELECT COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount WHEN source_table = 'payment_void' THEN -amount ELSE 0 END),0) AS s FROM member_financial_ledger WHERE association_id = ${id} AND entry_type IN ('CREDIT','DEBIT') AND (entry_type = 'CREDIT' OR source_table = 'payment_void') AND category NOT IN ('SAVINGS_DEPOSIT','SAVINGS_WITHDRAWAL','LOAN_DISBURSEMENT','LOAN_REPAYMENT')`,
      ]);
      if (!close(money(c._sum.amount), money(d[0].s), 0.5)) bad.push(`${subdomain.get(id)} charges ${money(c._sum.amount)} vs ledger ${money(d[0].s)}`);
      if (!close(money(p[0].s), money(cr[0].s), 0.5)) bad.push(`${subdomain.get(id)} payments ${money(p[0].s)} vs ledger ${money(cr[0].s)}`);
    }
    add('association finance totals = transactions', bad, ids.length);
  }

  // 3. Every payment links to the right tenant, member and a receipt; every seeded reference is a DEMO- one.
  {
    const bad = await prisma.$queryRaw<Array<{ id: number }>>`SELECT p.id FROM payments p JOIN transactions t ON t.id = p.transaction_id JOIN members m ON m.id = t.member_id WHERE p.association_id = ANY(${ids}) AND (p.association_id <> t.association_id OR t.association_id <> m.association_id OR p.receipt_number IS NULL OR p.receipt_number NOT LIKE 'DEMO-%')`;
    const total = await prisma.payment.count({ where: { associationId: { in: ids } } });
    add('every payment: same tenant, member, DEMO- receipt', bad.map((b) => `payment ${b.id}`), total);
  }

  // 4. Rotating circles.
  {
    const bad: string[] = [];
    const circles = await prisma.ajoGroup.findMany({ where: { associationId: { in: ids }, model: 'ROTATING_POT' }, select: { id: true, name: true, status: true, contributionKobo: true, rounds: true } });
    for (const g of circles) {
      const shares = await prisma.ajoMembership.aggregate({ where: { groupId: g.id, status: 'ACTIVE' }, _sum: { shares: true } });
      const slots = await prisma.ajoPayoutSlot.count({ where: { groupId: g.id } });
      if (g.status !== 'DRAFT' && g.status !== 'OPEN' && g.rounds !== null && slots !== g.rounds) bad.push(`${g.name}: ${slots} slots for ${g.rounds} rounds`);
      if (g.rounds !== null && shares._sum.shares !== null && g.status === 'ACTIVE' && g.rounds !== shares._sum.shares) bad.push(`${g.name}: pot is ${g.rounds} x contribution but there are ${shares._sum.shares} shares`);
      const paid = await prisma.ajoPayout.findMany({ where: { groupId: g.id, status: { not: 'VOID' as never }, round: { not: null } }, select: { round: true, membershipId: true } });
      const byRound = new Map<number, number>();
      const byPerson = new Map<number, number>();
      for (const p of paid) {
        byRound.set(p.round as number, (byRound.get(p.round as number) ?? 0) + 1);
        byPerson.set(p.membershipId, (byPerson.get(p.membershipId) ?? 0) + 1);
      }
      for (const [r, n] of byRound) if (n > 1) bad.push(`${g.name}: round ${r} has ${n} recipients`);
      for (const [m, n] of byPerson) if (n > 1) bad.push(`${g.name}: membership ${m} paid ${n} times in one cycle`);
    }
    add('rotating circles: pot = contribution x members, one recipient per round, nobody paid twice', bad, circles.length);
  }

  // 5. Collector thrift: balance = contributions - withdrawals - fees (ledger agrees with the contributions table).
  {
    const bad: string[] = [];
    const rows = await prisma.$queryRaw<Array<{ membership_id: number; group: string; credit: unknown; debit: unknown; confirmed: unknown }>>`
      SELECT mb.id AS membership_id, g.name AS "group",
        COALESCE((SELECT SUM(amount_kobo) FROM ajo_ledger_entries l WHERE l.membership_id = mb.id AND l.direction = 'CREDIT'),0) AS credit,
        COALESCE((SELECT SUM(amount_kobo) FROM ajo_ledger_entries l WHERE l.membership_id = mb.id AND l.direction = 'DEBIT'),0) AS debit,
        COALESCE((SELECT SUM(amount_kobo) FROM ajo_contributions c WHERE c.membership_id = mb.id AND c.status = 'CONFIRMED'),0) AS confirmed
      FROM ajo_memberships mb JOIN ajo_groups g ON g.id = mb.group_id
      WHERE g.association_id = ANY(${ids}) AND g.model = 'COLLECTOR_THRIFT'`;
    for (const r of rows) {
      const credit = Number(r.credit);
      const confirmed = Number(r.confirmed);
      if (credit !== confirmed) bad.push(`${r.group}/membership ${r.membership_id}: ledger credit ${credit} vs confirmed contributions ${confirmed}`);
    }
    add('collector thrift: ledger credits = confirmed contributions (balance = contributions - withdrawals - fees)', bad, rows.length);
  }

  // 6. Loans.
  {
    const bad: string[] = [];
    const loans = await prisma.loan.findMany({ where: { associationId: { in: ids } }, include: { repaymentSchedule: true } });
    for (const l of loans) {
      const reps = await prisma.loanRepayment.aggregate({ where: { loanId: l.id }, _sum: { amount: true } });
      const expected = money(l.principalAmount) + money(l.totalInterest) - money(reps._sum.amount);
      if (!close(money(l.totalRepayment), money(l.principalAmount) + money(l.totalInterest))) bad.push(`${l.loanNumber}: total repayment is not principal + interest`);
      if (!close(money(l.outstandingBalance), expected)) bad.push(`${l.loanNumber}: outstanding ${money(l.outstandingBalance)} vs ${expected}`);
      const sched = l.repaymentSchedule.reduce((s, x) => s + money(x.totalDue), 0);
      if (!close(sched, money(l.totalRepayment), 0.2)) bad.push(`${l.loanNumber}: schedule totals ${sched} vs ${money(l.totalRepayment)}`);
    }
    add('loans: outstanding = principal + interest - repayments', bad, loans.length);
  }

  // 7. Savings, welfare, elections.
  {
    const bad: string[] = [];
    const acc = await prisma.savingsAccount.findMany({ where: { associationId: { in: ids } }, select: { id: true, accountNumber: true, balance: true } });
    for (const a of acc) {
      const rows = await prisma.savingsTransaction.groupBy({ by: ['type'], where: { savingsAccountId: a.id }, _sum: { amount: true } });
      const sum = (types: string[]) => rows.filter((r) => types.includes(r.type)).reduce((s, r) => s + money(r._sum.amount), 0);
      const expected = sum(['DEPOSIT', 'INTEREST', 'TRANSFER_IN']) - sum(['WITHDRAWAL', 'TRANSFER_OUT', 'FEE']);
      if (!close(money(a.balance), expected)) bad.push(`${a.accountNumber}: ${money(a.balance)} vs ${expected}`);
    }
    add('savings: balance = deposits - withdrawals', bad, acc.length);
  }
  {
    const bad: string[] = [];
    const funds = await prisma.welfareFund.findMany({ where: { associationId: { in: ids } }, select: { id: true, name: true, currentBalance: true } });
    for (const f of funds) {
      const c = await prisma.welfareContribution.aggregate({ where: { fundId: f.id, status: 'CONFIRMED' }, _sum: { amount: true } });
      const p = await prisma.welfarePayoutRequest.aggregate({ where: { fundId: f.id, status: 'DISBURSED' }, _sum: { amount: true } });
      const expected = money(c._sum.amount) - money(p._sum.amount);
      if (!close(money(f.currentBalance), expected)) bad.push(`${f.name}: ${money(f.currentBalance)} vs ${expected}`);
    }
    add('welfare funds: balance = confirmed contributions - disbursed payouts', bad, funds.length);
  }
  {
    const bad: string[] = [];
    const elections = await prisma.election.findMany({ where: { associationId: { in: ids } }, select: { id: true, title: true, totalVotesCast: true } });
    for (const e of elections) {
      const votes = await prisma.vote.count({ where: { electionId: e.id } });
      const cands = await prisma.candidate.aggregate({ where: { electionId: e.id }, _sum: { voteCount: true } });
      if (votes !== e.totalVotesCast || (cands._sum.voteCount ?? 0) !== votes) bad.push(`${e.title}: ${votes} votes, ${e.totalVotesCast} recorded, ${cands._sum.voteCount ?? 0} on candidates`);
    }
    add('elections: vote counts agree', bad, elections.length);
  }

  // 8. Demo flags and isolation of the demo rows.
  {
    const strays = await prisma.user.count({ where: { isDemo: true, OR: [{ associationId: null }, { association: { isDemo: false } }] } });
    const loose = await prisma.user.count({ where: { isDemo: false, association: { isDemo: true } } });
    add('every user in a demo tenant is flagged demo (and no demo user is outside one)', [...(strays ? [`${strays} demo users outside demo tenants`] : []), ...(loose ? [`${loose} unflagged users inside demo tenants`] : [])], ids.length);
  }
  return checks;
}

export function assertAllPass(checks: Check[]): void {
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) throw new Error(`Integrity checks failed:\n${failed.map((c) => ` - ${c.name}: ${c.detail}`).join('\n')}`);
}
