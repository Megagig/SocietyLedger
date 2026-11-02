/**
 * Cooperative savings and loans. Balances are computed here with plain arithmetic (flat interest, equal instalments) and written with
 * matching schedule and repayment rows; the member ledger is then fed through the app's own ledger service. The invariants check every
 * loan again afterwards: outstanding = principal + interest - repayments.
 */
import { memberLedgerService } from '../../../src/modules/member-finance/member-ledger.service';
import { Ctx, Tenant, activeRoll } from './core';
import type { Counts } from './finance';
import { daysFrom } from './util';

const bump = (c: Counts, key: string, n = 1) => { c[key] = (c[key] ?? 0) + n; };
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function seedCooperative(ctx: Ctx, t: Tenant): Promise<Counts> {
  const counts: Counts = {};
  if (!t.def.modules.cooperative) return counts;
  const { prisma } = ctx;
  const a = t.association.id;
  const roll = activeRoll(t);
  const officer = t.byKey.get('treasurer')?.user.id ?? t.adminUserId;
  const short = t.def.short.toUpperCase();

  const regular = await prisma.cooperativeAccountType.create({ data: { associationId: a, name: 'Regular Savings', description: 'Monthly contributions, withdrawable on approval', accountClass: 'CONTRIBUTION', defaultMonthlyAmount: 5000, isWithdrawable: true, monthlyWithdrawalLimit: 200000, sortOrder: 1 } });
  const shares = await prisma.cooperativeAccountType.create({ data: { associationId: a, name: 'Share Capital', description: 'Shares bought by each member, not withdrawable', accountClass: 'SHARES', defaultMonthlyAmount: 2000, isWithdrawable: false, sortOrder: 2 } });
  await prisma.cooperativeAccountType.create({ data: { associationId: a, name: 'Special Deposit', description: 'Fixed-term deposit for a special purpose', accountClass: 'SPECIAL', isWithdrawable: false, sortOrder: 3 } });
  const goods = await prisma.loanCategory.create({ data: { associationId: a, name: 'Goods and Appliances', description: 'Loans paid to the supplier, not the member', isGoods: true, sortOrder: 2 } });
  const cash = await prisma.loanCategory.create({ data: { associationId: a, name: 'Cash Loans', description: 'Paid to the member', isGoods: false, sortOrder: 1 } });
  void goods;

  // ---- savings: monthly deposits for six months, a few withdrawals -----------------------------------------------------------
  const savers = roll.slice(0, Math.min(25, roll.length));
  const txIds: number[] = [];
  const accounts = new Map<number, number>();
  for (const [i, m] of savers.entries()) {
    const type = i % 4 === 3 ? shares : regular;
    const monthly = type === shares ? 2000 : [5000, 10000, 20000, 50000][i % 4];
    let balance = 0;
    let deposits = 0;
    let withdrawals = 0;
    const account = await prisma.savingsAccount.create({
      data: { associationId: a, memberId: m.id, accountNumber: `DEMO-SAV-${short}-${String(i + 1).padStart(4, '0')}`, accountType: type === shares ? 'FIXED_DEPOSIT' : 'REGULAR', accountTypeId: type.id, monthlyContribution: monthly, openedAt: daysFrom(ctx.today, -200) },
    });
    accounts.set(m.id, account.id);
    for (let k = 6; k >= 1; k -= 1) {
      balance = r2(balance + monthly);
      deposits = r2(deposits + monthly);
      const when = daysFrom(ctx.today, -k * 30);
      const tx = await prisma.savingsTransaction.create({ data: { associationId: a, savingsAccountId: account.id, type: 'DEPOSIT', amount: monthly, balanceAfter: balance, paymentMethod: 'bank_transfer', reference: `DEMO-SAVDEP-${account.id}-${k}`, processedBy: officer, transactionDate: when, createdAt: when } });
      txIds.push(tx.id);
      bump(counts, 'savingsDeposits');
    }
    if (type === regular && i % 5 === 0) {
      const take = monthly * 2;
      balance = r2(balance - take);
      withdrawals = r2(withdrawals + take);
      const when = daysFrom(ctx.today, -20);
      const tx = await prisma.savingsTransaction.create({ data: { associationId: a, savingsAccountId: account.id, type: 'WITHDRAWAL', amount: take, balanceAfter: balance, paymentMethod: 'bank_transfer', reference: `DEMO-SAVWD-${account.id}`, processedBy: officer, notes: 'Approved withdrawal', transactionDate: when, createdAt: when } });
      txIds.push(tx.id);
      bump(counts, 'savingsWithdrawals');
    }
    await prisma.savingsAccount.update({ where: { id: account.id }, data: { balance, totalDeposits: deposits, totalWithdrawals: withdrawals } });
    bump(counts, 'savingsAccounts');
  }
  // A withdrawal request waiting for review, so the approval queue has an item.
  const waitingMember = savers[1];
  const waitingAccount = accounts.get(waitingMember.id);
  if (waitingAccount) {
    await prisma.savingsWithdrawalRequest.create({ data: { associationId: a, memberId: waitingMember.id, savingsAccountId: waitingAccount, amount: 15000, reason: 'School fees for the new term', status: 'PENDING_REVIEW', twoStage: true } });
    bump(counts, 'withdrawalRequests');
  }

  // ---- loans ---------------------------------------------------------------------------------------------------------------
  const product = await prisma.loanProduct.create({
    data: { associationId: a, name: 'Personal Loan', description: 'Cash loan against savings', minAmount: 20000, maxAmount: 500000, interestRate: 10, interestType: 'FLAT', minTenureMonths: 3, maxTenureMonths: 24, requiresGuarantor: true, minGuarantors: 1, lockSavings: false, loanCategoryId: cash.id },
  });
  let n = 0;
  const loanIds: number[] = [];
  const repaymentIds: number[] = [];

  async function makeLoan(memberIdx: number, principal: number, tenure: number, disbursedDaysAgo: number, paidInstalments: number, forceOverdue: boolean) {
    n += 1;
    const member = savers[memberIdx];
    const interest = r2(principal * 0.1 * (tenure / 12));
    const total = r2(principal + interest);
    const monthly = r2(total / tenure);
    const principalPer = r2(principal / tenure);
    const interestPer = r2(interest / tenure);
    const disbursedAt = daysFrom(ctx.today, -disbursedDaysAgo);
    const application = await prisma.loanApplication.create({
      data: {
        associationId: a, applicationNumber: `DEMO-LA-${short}-${String(n).padStart(4, '0')}`, memberId: member.id, loanProductId: product.id, amount: principal, tenureMonths: tenure, interestRate: 10, interestType: 'FLAT',
        monthlyRepayment: monthly, totalRepayment: total, totalInterest: interest, purpose: 'Stock for the trading season', status: 'DISBURSED', appliedAt: daysFrom(disbursedAt, -10),
        reviewedBy: officer, reviewedAt: daysFrom(disbursedAt, -7), approvedBy: t.adminUserId, approvedAt: daysFrom(disbursedAt, -5), disbursedAt,
      },
    });
    await prisma.loanGuarantor.create({ data: { associationId: a, loanApplicationId: application.id, guarantorMemberId: savers[(memberIdx + 2) % savers.length].id, guaranteeAmount: principal / 2, status: 'ACCEPTED', acceptedAt: daysFrom(disbursedAt, -8) } });
    const paidTotal = r2(monthly * paidInstalments);
    const loan = await prisma.loan.create({
      data: {
        associationId: a, loanNumber: `DEMO-LN-${short}-${String(n).padStart(4, '0')}`, applicationId: application.id, memberId: member.id, loanProductId: product.id, principalAmount: principal, interestRate: 10, interestType: 'FLAT',
        tenureMonths: tenure, monthlyRepayment: monthly, totalRepayment: total, totalInterest: interest, amountDisbursed: principal, totalPaid: paidTotal, principalPaid: r2(principalPer * paidInstalments), interestPaid: r2(interestPer * paidInstalments),
        outstandingBalance: r2(total - paidTotal), status: paidInstalments >= tenure ? 'PAID_OFF' : forceOverdue ? 'OVERDUE' : 'ACTIVE', disbursedAt, maturityDate: daysFrom(disbursedAt, tenure * 30), closedAt: paidInstalments >= tenure ? daysFrom(ctx.today, -3) : null,
        nextPaymentDate: paidInstalments >= tenure ? null : daysFrom(disbursedAt, (paidInstalments + 1) * 30), nextPaymentAmount: paidInstalments >= tenure ? null : monthly,
      },
    });
    loanIds.push(loan.id);
    for (let k = 1; k <= tenure; k += 1) {
      const due = daysFrom(disbursedAt, k * 30);
      const paid = k <= paidInstalments;
      const overdue = !paid && due.getTime() < ctx.today.getTime();
      const item = await prisma.loanRepaymentSchedule.create({
        data: { loanId: loan.id, installmentNumber: k, dueDate: due, principalDue: principalPer, interestDue: interestPer, totalDue: monthly, principalPaid: paid ? principalPer : 0, interestPaid: paid ? interestPer : 0, totalPaid: paid ? monthly : 0, status: paid ? 'PAID' : overdue ? 'OVERDUE' : 'PENDING', paidAt: paid ? daysFrom(due, -1) : null },
      });
      if (paid) {
        const rep = await prisma.loanRepayment.create({ data: { associationId: a, loanId: loan.id, scheduleItemId: item.id, amount: monthly, principalPortion: principalPer, interestPortion: interestPer, paymentMethod: 'bank_transfer', reference: `DEMO-LNPAY-${loan.id}-${k}`, processedBy: officer, paidAt: daysFrom(due, -1), paymentDate: daysFrom(due, -1), createdAt: daysFrom(due, -1) } });
        repaymentIds.push(rep.id);
        bump(counts, 'loanRepayments');
      }
    }
    bump(counts, 'loans');
    return loan;
  }
  await makeLoan(2, 200000, 12, 125, 4, false); // active, on schedule
  await makeLoan(5, 100000, 6, 170, 3, true); //   overdue: instalments 4 and 5 are late
  await makeLoan(7, 50000, 3, 130, 3, false); //    fully repaid

  // Applications that did not become loans.
  const common = { associationId: a, loanProductId: product.id, tenureMonths: 12, interestRate: 10, interestType: 'FLAT' as const };
  await prisma.loanApplication.create({ data: { ...common, applicationNumber: `DEMO-LA-${short}-0101`, memberId: savers[9 % savers.length].id, amount: 450000, monthlyRepayment: 41250, totalRepayment: 495000, totalInterest: 45000, purpose: 'Buy a delivery van', status: 'REJECTED', appliedAt: daysFrom(ctx.today, -35), reviewedBy: officer, reviewedAt: daysFrom(ctx.today, -30), rejectionReason: 'Amount is more than three times the applicant savings, and there is no guarantor.' } });
  await prisma.loanApplication.create({ data: { ...common, applicationNumber: `DEMO-LA-${short}-0102`, memberId: savers[11 % savers.length].id, amount: 120000, monthlyRepayment: 11000, totalRepayment: 132000, totalInterest: 12000, purpose: 'Shop renovation', status: 'PENDING_REVIEW', appliedAt: daysFrom(ctx.today, -4) } });
  const wg = await prisma.loanApplication.create({ data: { ...common, applicationNumber: `DEMO-LA-${short}-0103`, memberId: savers[13 % savers.length].id, amount: 80000, monthlyRepayment: 7333.33, totalRepayment: 88000, totalInterest: 8000, purpose: 'Buy a freezer', status: 'PENDING_GUARANTORS', appliedAt: daysFrom(ctx.today, -2) } });
  await prisma.loanGuarantor.create({ data: { associationId: a, loanApplicationId: wg.id, guarantorMemberId: savers[3 % savers.length].id, guaranteeAmount: 40000, status: 'PENDING' } });
  bump(counts, 'loanApplications', 6);

  // Feed the member ledger through the app's own service (savings deposits/withdrawals, loan disbursements and repayments).
  for (const id of txIds) await memberLedgerService.createFromSavingsTransaction(id, officer);
  for (const id of loanIds) await memberLedgerService.createFromLoanDisbursement(id, officer);
  for (const id of repaymentIds) await memberLedgerService.createFromLoanRepayment(id, officer);
  return counts;
}
