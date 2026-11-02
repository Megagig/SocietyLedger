/**
 * Dues, levies, donations and expenses for an association. Charges and payments are written directly (the services that record them
 * need a request), then the app's own ledger and books repair (`repairAssociation`, the same code that runs on every container start)
 * derives the member ledgers and the double-entry books from them, so those are exactly what the app itself would produce.
 * Expenses go through the real expenses service (maker-checker approval, journal posting).
 */
import { Prisma } from '@prisma/client';
import { repairAssociation } from '../../../src/services/ledger-books-repair.service';
import { accountingService } from '../../../src/modules/accounting/accounting.service';
import { memberLedgerService } from '../../../src/modules/member-finance/member-ledger.service';
import { SettingsService } from '../../../src/modules/settings/settings.service';
import { expensesService } from '../../../src/modules/expenses/expenses.service';
import { Ctx, Tenant, activeRoll } from './core';
import { DAY_MS, daysFrom, dueDay } from './util';

export type Counts = Record<string, number>;
const bump = (c: Counts, key: string, n = 1) => { c[key] = (c[key] ?? 0) + n; };

const DUES_NAIRA: Record<string, number> = { unity: 5000, umuahia: 3000, lagoscoop: 2000, alumni: 2000, grace: 1000, club: 5000 };
const METHODS = ['bank_transfer', 'bank_transfer', 'bank_transfer', 'cash', 'card', 'mobile_money'] as const;

type Pattern = 'paid' | 'late' | 'slow' | 'partial' | 'new';

/** How a member pays, from their sign-in situation or, for the rest of the roll, a fixed spread. */
function patternFor(t: Tenant, index: number, memberId: number): Pattern {
  const a = t.accounts.find((x) => x.member.id === memberId);
  if (a) {
    if (a.situation === 'paid') return 'paid';
    if (a.situation === 'arrears') return 'slow';
    if (a.situation === 'new') return 'new';
    return 'late';
  }
  const r = index % 20;
  if (r === 0) return 'partial';
  if (r < 3) return 'slow';
  if (r < 7) return 'late';
  return 'paid';
}

export async function seedFinance(ctx: Ctx, t: Tenant): Promise<Counts> {
  const { prisma } = ctx;
  const counts: Counts = {};
  const a = t.association.id;
  const treasurer = t.byKey.get('treasurer')?.user.id ?? t.adminUserId;
  const flags = t.def.modules;
  if (!flags.dues) return counts;

  const dues = await prisma.financialCategory.create({ data: { associationId: a, name: 'Monthly Dues', type: 'due', amount: DUES_NAIRA[t.def.short] ?? 2000, frequency: 'monthly', description: 'Monthly membership dues' } });
  const levyCategory = flags.levy ? await prisma.financialCategory.create({ data: { associationId: a, name: 'Development Levy', type: 'levy', description: 'One-off levy for projects' } }) : null;
  const donationCategory = flags.donations ? await prisma.financialCategory.create({ data: { associationId: a, name: 'Donations', type: 'donation', description: 'Fundraising and donations' } }) : null;
  const amount = DUES_NAIRA[t.def.short] ?? 2000;
  let receipt = 0;
  const nextReceipt = () => `DEMO-RCPT-${t.def.short.toUpperCase()}-${String(++receipt).padStart(5, '0')}`;
  const ref = (n: string) => `DEMO-${t.def.short.toUpperCase()}-${n}`;

  const roll = activeRoll(t);
  const failures: Array<{ transactionId: number }> = [];
  let refundTarget: { transactionId: number; paymentId: number; memberId: number } | null = null;

  await prisma.$transaction(
    async (tx) => {
      for (const [index, member] of roll.entries()) {
        const pattern = patternFor(t, index, member.id);
        const joinedAt = member.joinDate ?? daysFrom(ctx.today, -400);
        for (let k = -11; k <= 0; k += 1) {
          let due = dueDay(ctx.today, k);
          if (pattern === 'new') {
            if (k !== 0) continue;
            due = daysFrom(ctx.today, 10); // a fresh joiner's first charge is not yet due
          } else if (due.getTime() < joinedAt.getTime() - 30 * DAY_MS) continue;
          const monthsAgo = -k;
          const past = due.getTime() < ctx.today.getTime();
          let status: 'paid' | 'partial' | 'overdue' | 'pending';
          if (!past) status = 'pending';
          else if (pattern === 'paid' || pattern === 'new') status = 'paid';
          else if (pattern === 'partial') status = monthsAgo <= 3 ? 'partial' : 'paid';
          else if (pattern === 'slow') status = monthsAgo <= 3 ? 'overdue' : monthsAgo === 4 ? 'partial' : 'paid';
          else status = monthsAgo === 1 ? 'overdue' : 'paid'; // late: only last month outstanding
          const method = METHODS[(index + monthsAgo) % METHODS.length];
          const paidAt = daysFrom(due, 1 + ((index + monthsAgo) % 4));
          const txn = await tx.transaction.create({
            data: {
              associationId: a, memberId: member.id, categoryId: dues.id, amount, dueDate: due, status, createdBy: treasurer,
              createdAt: daysFrom(due, -20), paymentMethod: status === 'paid' || status === 'partial' ? method : null,
              paymentDate: status === 'paid' || status === 'partial' ? paidAt : null,
              referenceNumber: status === 'paid' || status === 'partial' ? ref(`TXN-${member.id}-${monthsAgo}`) : null,
              notes: `Monthly dues ${due.toISOString().slice(0, 7)}`,
            },
          });
          bump(counts, 'charges');
          if (status === 'paid' || status === 'partial') {
            const created = await tx.payment.create({
              data: {
                associationId: a, transactionId: txn.id, amountPaid: status === 'paid' ? amount : amount / 2, paymentDate: paidAt, paymentMethod: method,
                receiptNumber: nextReceipt(), confirmedBy: treasurer, confirmedAt: paidAt, createdAt: paidAt,
              },
            });
            bump(counts, 'payments');
            if (!refundTarget && status === 'paid' && monthsAgo === 2 && index === 4) refundTarget = { transactionId: txn.id, paymentId: created.id, memberId: member.id };
          } else if (status === 'overdue' && failures.length < 2 && monthsAgo === 1) {
            failures.push({ transactionId: txn.id });
          }
        }
      }
      for (const [i, f] of failures.entries()) {
        const txn = await tx.transaction.findUniqueOrThrow({ where: { id: f.transactionId } });
        await tx.paymentGatewayTransaction.create({
          data: { associationId: a, transactionId: txn.id, provider: i === 0 ? 'paystack' : 'nomba', reference: ref(`FAILED-${i + 1}`), amount: txn.amount, status: 'failed', metadata: { demo: true, reason: 'Card declined by issuer' }, createdAt: daysFrom(ctx.today, -3 - i) },
        });
        bump(counts, 'failedGatewayAttempts');
      }

      // ---- one development levy, partly paid ------------------------------------------------------------------------------
      if (levyCategory) {
        const levyAmount = Math.round((amount * 4) / 1000) * 1000;
        const campaign = await tx.levyCampaign.create({
          data: {
            associationId: a, categoryId: levyCategory.id, name: `${t.def.short === 'unity' ? 'Perimeter Fence' : 'Community Hall'} Levy`, description: 'One-off levy towards the project',
            targetAmount: levyAmount * roll.length, amountPerMember: levyAmount, deadline: daysFrom(ctx.today, 30), status: 'ACTIVE', createdBy: t.adminUserId, createdAt: daysFrom(ctx.today, -40),
          },
        });
        bump(counts, 'levies');
        for (const [index, member] of roll.entries()) {
          const state = index % 10 < 6 ? 'paid' : index % 10 < 8 ? 'partial' : 'pending';
          const due = daysFrom(ctx.today, 30);
          const txn = await tx.transaction.create({
            data: { associationId: a, memberId: member.id, categoryId: levyCategory.id, amount: levyAmount, dueDate: due, status: state, createdBy: t.adminUserId, createdAt: daysFrom(ctx.today, -40), paymentMethod: state === 'pending' ? null : 'bank_transfer', paymentDate: state === 'pending' ? null : daysFrom(ctx.today, -20 + (index % 15)), referenceNumber: state === 'pending' ? null : ref(`LEVY-${member.id}`), notes: campaign.name },
          });
          await tx.levyCampaignAssignment.create({ data: { campaignId: campaign.id, memberId: member.id, transactionId: txn.id, amount: levyAmount, status: state } });
          if (state !== 'pending') {
            await tx.payment.create({ data: { associationId: a, transactionId: txn.id, amountPaid: state === 'paid' ? levyAmount : levyAmount / 2, paymentDate: daysFrom(ctx.today, -20 + (index % 15)), paymentMethod: 'bank_transfer', receiptNumber: nextReceipt(), confirmedBy: treasurer, confirmedAt: daysFrom(ctx.today, -19), createdAt: daysFrom(ctx.today, -20 + (index % 15)) } });
            bump(counts, 'payments');
          }
          bump(counts, 'charges');
        }
      }

      // ---- fundraising: one campaign, donations from members, one very large and one anonymous -----------------------------
      if (donationCategory) {
        const allocation = await tx.donationAllocation.create({ data: { associationId: a, name: t.def.short === 'unity' ? 'Estate Borehole and Water Project' : 'Scholarship Fund', description: 'Fundraising campaign', type: 'project', targetAmount: 5_000_000, isActive: true } });
        bump(counts, 'donationCampaigns');
        const donors = roll.slice(0, 14);
        for (const [index, member] of donors.entries()) {
          const big = index === 0;
          const give = big ? 25_000_000 : [5000, 10000, 20000, 50000, 100000][index % 5];
          const when = daysFrom(ctx.today, -50 + index * 3);
          const txn = await tx.transaction.create({ data: { associationId: a, memberId: member.id, categoryId: donationCategory.id, amount: give, status: 'paid', paymentDate: when, paymentMethod: 'bank_transfer', referenceNumber: ref(`DON-${member.id}`), createdBy: treasurer, createdAt: when, notes: allocation.name } });
          await tx.payment.create({ data: { associationId: a, transactionId: txn.id, amountPaid: give, paymentDate: when, paymentMethod: 'bank_transfer', receiptNumber: nextReceipt(), confirmedBy: treasurer, confirmedAt: when, createdAt: when } });
          await tx.donationRecord.create({ data: { transactionId: txn.id, allocationId: allocation.id, receiptNumber: `DEMO-DON-${t.def.short.toUpperCase()}-${String(index + 1).padStart(4, '0')}`, isAnonymous: index % 5 === 4, donorMessage: index % 3 === 0 ? 'God bless our community' : null, createdAt: when } });
          bump(counts, 'donations');
          bump(counts, 'payments');
          bump(counts, 'charges');
        }
      }
    },
    { timeout: 300_000, maxWait: 30_000 },
  );

  // Let the app derive the member ledgers and the books from the charges and payments just written.
  const report = await repairAssociation(a, t.association.slug, {});
  if (report.problems.length) throw new Error(`Ledger repair reported problems for ${t.def.short}: ${report.problems.join('; ')}`);
  if (refundTarget) {
    // A payment taken twice and handed back: undone the way the app undoes a payment (the payment goes, an offsetting ledger entry stays).
    const target = refundTarget as { transactionId: number; paymentId: number; memberId: number };
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: target.paymentId } });
    await prisma.$transaction([
      prisma.payment.delete({ where: { id: payment.id } }),
      prisma.transaction.update({ where: { id: target.transactionId }, data: { status: 'overdue', paymentDate: null, notes: 'Payment refunded: the transfer was made twice by mistake' } }),
    ]);
    await memberLedgerService.createEntry({ associationId: a, memberId: target.memberId, entryType: 'DEBIT', category: 'DUES', amount: payment.amountPaid, effectiveDate: new Date(payment.paymentDate.getTime() + 3 * DAY_MS), description: 'Payment refunded to the member', sourceTable: 'payment_void', sourceId: payment.id, referenceNumber: payment.receiptNumber ?? undefined, createdBy: treasurer } as never);
    const again = await repairAssociation(a, t.association.slug, {});
    if (again.problems.length) throw new Error('Repair after refund reported problems: ' + again.problems.join('; '));
    bump(counts, 'refundedPayments');
  }
  counts.ledgerEntriesCreated = report.ledger.created;
  counts.bookCorrections = report.books.correctionsPosted;

  // ---- expenses, through the real service (needs the books the repair just created) -----------------------------------------
  if (flags.expenses) {
    const chart = await accountingService.initializeChartOfAccounts(a).catch(() => null);
    void chart;
    // Demo vouchers carry no receipt files (that needs real file storage), so the receipt threshold is set above any demo amount.
    await SettingsService.updateSettings(a, 'financial', { receiptRequiredAbove: 5_000_000 }, t.adminUserId).catch((e: Error) => ctx.log('   (receipt limit not set: ' + e.message + ')'));
    const options = await expensesService.getOptions(a);
    const paidFrom = options.paidFrom[0];
    const categories = options.categories;
    if (!paidFrom || categories.length === 0) {
      counts.expensesSkipped = 1;
    } else {
      const maker = t.byKey.get('secretary')?.user.id ?? t.adminUserId;
      const checker = t.adminUserId;
      const payees: Array<[string, string, number, number]> = [
        ['Ibeto Electricals', 'Generator servicing and diesel', 185000, 110], ['Lagos Waste Management', 'Monthly refuse collection', 60000, 95], ['Spring Water Ltd', 'Borehole pump repair', 240000, 80],
        ['Zenith Security Services', 'Security levy for the quarter', 450000, 65], ['Mama Chidi Catering', 'Refreshments for the AGM', 95000, 50], ['Print Hub', 'Printing of membership cards', 38500, 40],
        ['Bright Stationery', 'Office stationery', 22000, 25], ['Alhaji Musa Hardware', 'Gate repairs', 130000, 12],
      ];
      for (const [i, [payee, description, naira, daysAgo]] of payees.entries()) {
        const category = categories[i % categories.length];
        const v = await expensesService.create(a, maker, { expenseDate: daysFrom(ctx.today, -daysAgo).toISOString().slice(0, 10), payee, description, amount: naira, categoryAccountId: category.id, paidFromAccountId: paidFrom.id, noReceiptReason: 'Paid in cash at the vendor; the vendor did not issue a receipt' } as never);
        bump(counts, 'expenses');
        if (i === 6) continue; // left as a draft
        await expensesService.submit(a, maker, v.id);
        if (i === 7) continue; // waiting for approval
        if (i === 5) {
          await expensesService.reject(a, checker, v.id, 'Please attach the supplier invoice before this can be approved.');
          continue;
        }
        await expensesService.approve(a, checker, v.id);
      }
    }
  }
  return counts;
}

export type { Prisma };
