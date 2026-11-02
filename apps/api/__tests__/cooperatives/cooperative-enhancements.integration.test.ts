/**
 * Officer-defined account types, batched payment requests and two-stage withdrawals against a real (disposable) database. The parts that
 * matter most for money: a payment request posts every line or none, nobody decides their own request, three different people are needed
 * for a two-stage withdrawal, the monthly limit and the share-capital rule hold, and the balance moves only at final approval.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test"; without it the suite is skipped.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/cooperatives/cooperative-enhancements --forceExit
 */

export {};
const TEST_DB = process.env.AJO_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('AJO_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) {
  process.env.DATABASE_URL = TEST_DB;
  process.env.DIRECT_URL = TEST_DB;
}

jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async () => ({ inAppCreated: true, emailSent: false, smsSent: false })),
}));

const suite = TEST_DB ? describe : describe.skip;
if (TEST_DB) jest.setTimeout(120000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Cooperative enhancements (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let types: typeof import('../../src/modules/cooperatives/cooperative-types.service').cooperativeTypesService;
  let payments: typeof import('../../src/modules/cooperatives/cooperative-payments.service').cooperativePaymentsService;
  let withdrawals: typeof import('../../src/modules/cooperatives/cooperative-withdrawals.service').cooperativeWithdrawalsService;
  let settings: typeof import('../../src/modules/cooperatives/cooperative-settings');
  let counter = 0;

  interface World {
    A: number;
    officer1: { id: number };
    officer2: { id: number };
    member: { id: number; userId: number };
  }

  async function world(): Promise<World> {
    const slug = `coop-${run}-${++counter}`;
    const assoc = await prisma.association.create({ data: { name: `Coop ${counter} ${run}`, slug, subdomain: slug } });
    const user = (label: string) =>
      prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
    const officer1 = await user('officer1');
    const officer2 = await user('officer2');
    const memberUser = await user('member');
    const member = await prisma.member.create({
      data: { associationId: assoc.id, userId: memberUser.id, memberId: `CP${run}${++counter}`, firstName: 'Anthony', lastName: 'Obi', status: 'active' },
    });
    return { A: assoc.id, officer1, officer2, member: { id: member.id, userId: memberUser.id } };
  }

  const receipt = { filename: 'proof.png', filepath: 'cooperative-payments/test/proof.png' };

  async function accountWithBalance(w: World, typeId: number, balance: number) {
    return prisma.savingsAccount.create({
      data: {
        associationId: w.A,
        memberId: w.member.id,
        accountNumber: `SAV-T-${run}-${++counter}`,
        accountTypeId: typeId,
        balance,
        totalDeposits: balance,
      },
    });
  }

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    types = require('../../src/modules/cooperatives/cooperative-types.service').cooperativeTypesService;
    payments = require('../../src/modules/cooperatives/cooperative-payments.service').cooperativePaymentsService;
    withdrawals = require('../../src/modules/cooperatives/cooperative-withdrawals.service').cooperativeWithdrawalsService;
    settings = require('../../src/modules/cooperatives/cooperative-settings');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('account types', () => {
    it('forces share capital to be non-withdrawable and drops any limit', async () => {
      const w = await world();
      const shares = await types.createAccountType(w.A, { name: 'Shares', accountClass: 'SHARES', monthlyWithdrawalLimit: 50000 });
      expect(shares.isWithdrawable).toBe(false);
      expect(shares.monthlyWithdrawalLimit).toBeNull();
    });

    it('refuses a duplicate name within the association, but allows it in another', async () => {
      const w = await world();
      const other = await world();
      await types.createAccountType(w.A, { name: 'Christmas Savings' });
      await expect(types.createAccountType(w.A, { name: 'Christmas Savings' })).rejects.toMatchObject({ code: 'DUPLICATE_NAME', status: 409 });
      await expect(types.createAccountType(other.A, { name: 'Christmas Savings' })).resolves.toMatchObject({ name: 'Christmas Savings' });
    });

    it("locks a type's behaviour class once members hold accounts of it", async () => {
      const w = await world();
      const type = await types.createAccountType(w.A, { name: 'Special', accountClass: 'SPECIAL' });
      await accountWithBalance(w, type.id, 1000);
      await expect(types.updateAccountType(w.A, type.id, { accountClass: 'SHARES' })).rejects.toMatchObject({ code: 'CLASS_LOCKED' });
      await expect(types.updateAccountType(w.A, type.id, { description: 'For emergencies' })).resolves.toMatchObject({ description: 'For emergencies' });
    });

    it("gives a cooperative with no types its first one, once", async () => {
      const w = await world();
      await types.ensureDefaultAccountType(w.A);
      await types.ensureDefaultAccountType(w.A);
      const all = await types.listAccountTypes(w.A);
      expect(all.map((t) => t.name)).toEqual(['Ordinary Savings']);
    });
  });

  describe('payment requests', () => {
    it('posts every line when approved, opens the accounts, and cannot be approved twice', async () => {
      const w = await world();
      const savings = await types.createAccountType(w.A, { name: 'Monthly savings' });
      const shares = await types.createAccountType(w.A, { name: 'Shares', accountClass: 'SHARES' });

      const request = await payments.createRequest(
        w.A,
        w.member.id,
        {
          paymentDate: new Date('2026-03-04'),
          lines: [
            { accountTypeId: savings.id, amount: 5000, periodMonth: 3, periodYear: 2026 },
            { accountTypeId: shares.id, amount: 2000, periodMonth: 3, periodYear: 2026 },
          ],
        },
        receipt,
      );
      expect(request.totalAmount.toString()).toBe('7000');

      // Nothing has moved while it is pending.
      expect(await prisma.savingsAccount.count({ where: { associationId: w.A } })).toBe(0);

      const approved = await payments.approve(w.A, request.id, w.officer1.id);
      expect(approved.status).toBe('APPROVED');

      const accounts = await prisma.savingsAccount.findMany({ where: { associationId: w.A }, orderBy: { id: 'asc' } });
      expect(accounts.map((a) => a.balance.toString()).sort()).toEqual(['2000', '5000']);
      const lines = await prisma.cooperativePaymentLine.findMany({ where: { requestId: request.id } });
      expect(lines.every((l) => l.savingsTransactionId && l.savingsAccountId)).toBe(true);

      await expect(payments.approve(w.A, request.id, w.officer2.id)).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
      // Still only credited once.
      const after = await prisma.savingsAccount.findMany({ where: { associationId: w.A } });
      expect(after.reduce((sum, a) => sum + Number(a.balance), 0)).toBe(7000);
    });

    it('posts NOTHING and leaves the request waiting when one line cannot post', async () => {
      const w = await world();
      const savings = await types.createAccountType(w.A, { name: 'Monthly savings' });
      const shares = await types.createAccountType(w.A, { name: 'Shares', accountClass: 'SHARES' });
      const savingsAccount = await accountWithBalance(w, savings.id, 1000);
      // The member's shares account exists but is closed, so the second line can't be credited.
      await prisma.savingsAccount.create({
        data: { associationId: w.A, memberId: w.member.id, accountNumber: `SAV-C-${run}-${++counter}`, accountTypeId: shares.id, status: 'CLOSED' },
      });

      const request = await payments.createRequest(
        w.A,
        w.member.id,
        {
          paymentDate: new Date('2026-03-04'),
          lines: [
            { accountTypeId: savings.id, amount: 5000, periodMonth: 3, periodYear: 2026 },
            { accountTypeId: shares.id, amount: 2000, periodMonth: 3, periodYear: 2026 },
          ],
        },
        receipt,
      );

      await expect(payments.approve(w.A, request.id, w.officer1.id)).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });

      const row = await prisma.cooperativePaymentRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(row.status).toBe('PENDING');
      const unchanged = await prisma.savingsAccount.findUniqueOrThrow({ where: { id: savingsAccount.id } });
      expect(unchanged.balance.toString()).toBe('1000');
      expect(await prisma.savingsTransaction.count({ where: { associationId: w.A } })).toBe(0);
    });

    it("won't let an officer approve or reject their own payment", async () => {
      const w = await world();
      const type = await types.createAccountType(w.A, { name: 'Monthly savings' });
      const request = await payments.createRequest(
        w.A,
        w.member.id,
        { paymentDate: new Date('2026-03-04'), lines: [{ accountTypeId: type.id, amount: 1000, periodMonth: 3, periodYear: 2026 }] },
        receipt,
      );
      await expect(payments.approve(w.A, request.id, w.member.userId)).rejects.toMatchObject({ code: 'OWN_REQUEST', status: 403 });
      await expect(payments.reject(w.A, request.id, w.member.userId, 'no')).rejects.toMatchObject({ code: 'OWN_REQUEST' });
    });

    it('gives every account opened by simultaneous approvals its own number', async () => {
      const w = await world();
      const a = await types.createAccountType(w.A, { name: 'Alpha' });
      const b = await types.createAccountType(w.A, { name: 'Beta' });
      const c = await types.createAccountType(w.A, { name: 'Gamma' });
      const pay = (typeId: number) =>
        payments.createRequest(w.A, w.member.id, { paymentDate: new Date('2026-03-04'), lines: [{ accountTypeId: typeId, amount: 1000, periodMonth: 3, periodYear: 2026 }] }, receipt);
      const [r1, r2, r3] = await Promise.all([pay(a.id), pay(b.id), pay(c.id)]);
      await Promise.all([r1, r2, r3].map((r) => payments.approve(w.A, r.id, w.officer1.id)));
      const accounts = await prisma.savingsAccount.findMany({ where: { associationId: w.A } });
      expect(accounts).toHaveLength(3);
      expect(new Set(accounts.map((x) => x.accountNumber)).size).toBe(3);
    });

    it('refuses a type from another association, and an inactive one', async () => {
      const w = await world();
      const other = await world();
      const foreign = await types.createAccountType(other.A, { name: 'Theirs' });
      await expect(
        payments.createRequest(w.A, w.member.id, { paymentDate: new Date(), lines: [{ accountTypeId: foreign.id, amount: 100, periodMonth: 1, periodYear: 2026 }] }, receipt),
      ).rejects.toMatchObject({ code: 'TYPE_UNAVAILABLE' });

      const mine = await types.createAccountType(w.A, { name: 'Retired' });
      await types.updateAccountType(w.A, mine.id, { isActive: false });
      await expect(
        payments.createRequest(w.A, w.member.id, { paymentDate: new Date(), lines: [{ accountTypeId: mine.id, amount: 100, periodMonth: 1, periodYear: 2026 }] }, receipt),
      ).rejects.toMatchObject({ code: 'TYPE_UNAVAILABLE' });
    });

    it('rejecting leaves the savings untouched and records the reason', async () => {
      const w = await world();
      const type = await types.createAccountType(w.A, { name: 'Monthly savings' });
      const request = await payments.createRequest(
        w.A,
        w.member.id,
        { paymentDate: new Date('2026-03-04'), lines: [{ accountTypeId: type.id, amount: 1000, periodMonth: 3, periodYear: 2026 }] },
        receipt,
      );
      const rejected = await payments.reject(w.A, request.id, w.officer1.id, 'Receipt is unreadable');
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toBe('Receipt is unreadable');
      expect(await prisma.savingsAccount.count({ where: { associationId: w.A } })).toBe(0);
    });
  });

  describe('two-stage withdrawals', () => {
    const now = new Date();

    async function specialAccount(w: World, balance: number, limit: number | null) {
      const type = await types.createAccountType(w.A, { name: 'Special', accountClass: 'SPECIAL', monthlyWithdrawalLimit: limit });
      return accountWithBalance(w, type.id, balance);
    }

    it('moves no money until the second officer approves, and records both stages', async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, null);

      const request = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 20000, reason: 'School fees' }, now);
      expect(request.status).toBe('PENDING_REVIEW');
      expect(request.twoStage).toBe(true);

      const reviewed = await withdrawals.review(w.A, request.id, w.officer1.id, { decision: 'FORWARD', comment: 'Balance confirmed' }, now);
      expect(reviewed.status).toBe('PENDING_APPROVAL');
      expect((await prisma.savingsAccount.findUniqueOrThrow({ where: { id: account.id } })).balance.toString()).toBe('100000');

      const approved = await withdrawals.approve(w.A, request.id, w.officer2.id, { payoutMethod: 'BANK_TRANSFER', payoutReference: 'TRF-1' }, now);
      expect(approved.status).toBe('APPROVED');
      expect(approved.reviewedBy).toBe(w.officer1.id);
      expect(approved.approvedBy).toBe(w.officer2.id);
      expect((await prisma.savingsAccount.findUniqueOrThrow({ where: { id: account.id } })).balance.toString()).toBe('80000');
      const posted = await prisma.savingsTransaction.findFirstOrThrow({ where: { savingsAccountId: account.id, type: 'WITHDRAWAL' } });
      expect(posted.amount.toString()).toBe('20000');
    });

    it('needs a different officer to approve than reviewed', async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, null);
      const request = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now);
      await withdrawals.review(w.A, request.id, w.officer1.id, { decision: 'FORWARD' }, now);
      await expect(withdrawals.approve(w.A, request.id, w.officer1.id, { payoutMethod: 'CASH' }, now)).rejects.toMatchObject({ code: 'SAME_REVIEWER' });
      expect((await prisma.savingsAccount.findUniqueOrThrow({ where: { id: account.id } })).balance.toString()).toBe('100000');
    });

    it("won't let the member decide their own request at either stage", async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, null);
      const request = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now);
      await expect(withdrawals.review(w.A, request.id, w.member.userId, { decision: 'FORWARD' }, now)).rejects.toMatchObject({ code: 'OWN_REQUEST' });
      await withdrawals.review(w.A, request.id, w.officer1.id, { decision: 'FORWARD' }, now);
      await expect(withdrawals.approve(w.A, request.id, w.member.userId, { payoutMethod: 'CASH' }, now)).rejects.toMatchObject({ code: 'OWN_REQUEST' });
    });

    it('cannot be approved before it has been reviewed', async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, null);
      const request = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now);
      await expect(withdrawals.approve(w.A, request.id, w.officer2.id, { payoutMethod: 'CASH' }, now)).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
      expect((await prisma.savingsAccount.findUniqueOrThrow({ where: { id: account.id } })).balance.toString()).toBe('100000');
    });

    it('rejection at review ends it with the reason, and the money stays', async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, null);
      const request = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now);
      const rejected = await withdrawals.review(w.A, request.id, w.officer1.id, { decision: 'REJECT', reason: 'Loan guarantee outstanding' }, now);
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toBe('Loan guarantee outstanding');
      expect((await prisma.savingsAccount.findUniqueOrThrow({ where: { id: account.id } })).balance.toString()).toBe('100000');
    });

    it('holds the monthly limit across requests, counting what was already withdrawn this month', async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, 30000);

      const first = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 20000 }, now);
      await withdrawals.review(w.A, first.id, w.officer1.id, { decision: 'FORWARD' }, now);
      await withdrawals.approve(w.A, first.id, w.officer2.id, { payoutMethod: 'CASH' }, now);

      await expect(withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 15000 }, now)).rejects.toMatchObject({ code: 'MONTHLY_LIMIT' });
      await expect(withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 10000 }, now)).resolves.toMatchObject({ status: 'PENDING_REVIEW' });
    });

    it('allows only one waiting withdrawal per account', async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, null);
      await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now);
      await expect(withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 1000 }, now)).rejects.toMatchObject({ code: 'WITHDRAWAL_PENDING' });
    });

    it('lets only one of two simultaneous requests through (the database enforces it)', async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, null);
      const attempts = await Promise.allSettled([
        withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now),
        withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 6000 }, now),
        withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 7000 }, now),
      ]);
      expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
      for (const a of attempts.filter((x) => x.status === 'rejected')) {
        expect((a as PromiseRejectedResult).reason).toMatchObject({ code: 'WITHDRAWAL_PENDING' });
      }
    });

    it('never lets share capital be withdrawn', async () => {
      const w = await world();
      const shares = await types.createAccountType(w.A, { name: 'Shares', accountClass: 'SHARES' });
      const account = await accountWithBalance(w, shares.id, 50000);
      await expect(withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 1000 }, now)).rejects.toMatchObject({ code: 'NOT_WITHDRAWABLE' });
    });

    it("refuses more than the balance, and an account that isn't the member's own", async () => {
      const w = await world();
      const other = await world();
      const account = await specialAccount(w, 1000, null);
      await expect(withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 1000.01 }, now)).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
      await expect(withdrawals.create(other.A, other.member.id, { savingsAccountId: account.id, amount: 100 }, now)).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('re-checks the balance at final approval, so a balance that fell meanwhile blocks the payout', async () => {
      const w = await world();
      const account = await specialAccount(w, 10000, null);
      const request = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 8000 }, now);
      await withdrawals.review(w.A, request.id, w.officer1.id, { decision: 'FORWARD' }, now);
      await prisma.savingsAccount.update({ where: { id: account.id }, data: { balance: 3000 } });

      await expect(withdrawals.approve(w.A, request.id, w.officer2.id, { payoutMethod: 'CASH' }, now)).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
      // The claim rolled back with the failed payout, so the officer can retry once it is topped up.
      expect((await prisma.savingsWithdrawalRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe('PENDING_APPROVAL');
    });

    it('skips the review stage when the association switches two-stage off, and one officer decides', async () => {
      const w = await world();
      await settings.setTwoStageWithdrawal(w.A, w.officer1.id, false);
      const account = await specialAccount(w, 100000, null);

      const request = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now);
      expect(request.twoStage).toBe(false);
      expect(request.status).toBe('PENDING_APPROVAL');

      const approved = await withdrawals.approve(w.A, request.id, w.officer1.id, { payoutMethod: 'CASH' }, now);
      expect(approved.status).toBe('APPROVED');
      expect((await prisma.savingsAccount.findUniqueOrThrow({ where: { id: account.id } })).balance.toString()).toBe('95000');
    });

    it('keeps a request on the stage rules it was made under, even if the setting changes after', async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, null);
      const request = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now);
      await settings.setTwoStageWithdrawal(w.A, w.officer1.id, false);
      const row = await prisma.savingsWithdrawalRequest.findUniqueOrThrow({ where: { id: request.id } });
      expect(row.twoStage).toBe(true);
      expect(row.status).toBe('PENDING_REVIEW');
    });

    it('lets the member cancel while waiting, but not after approval', async () => {
      const w = await world();
      const account = await specialAccount(w, 100000, null);
      const request = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now);
      await expect(withdrawals.cancel(w.A, request.id, w.member.id)).resolves.toMatchObject({ status: 'CANCELLED' });

      const second = await withdrawals.create(w.A, w.member.id, { savingsAccountId: account.id, amount: 5000 }, now);
      await withdrawals.review(w.A, second.id, w.officer1.id, { decision: 'FORWARD' }, now);
      await withdrawals.approve(w.A, second.id, w.officer2.id, { payoutMethod: 'CASH' }, now);
      await expect(withdrawals.cancel(w.A, second.id, w.member.id)).rejects.toMatchObject({ code: 'NOT_CANCELLABLE' });
    });

    it('defaults to two-stage for a society that never opened the setting', async () => {
      const w = await world();
      expect(await settings.getTwoStageWithdrawal(w.A)).toBe(true);
    });
  });

  describe('rollout migration', () => {
    const sql = require('fs').readFileSync(require('path').join(__dirname, '../../prisma/migrations/20261126_cooperative_permissions_rollout/migration.sql'), 'utf8') as string;
    // Statements end at a semicolon at the end of a line; comment lines are dropped.
    const statements = sql
      .split(/;[ \t]*\r?\n/)
      .map((part) => part.split(/\r?\n/).filter((l) => !l.trim().startsWith('--')).join('\n').trim())
      .filter(Boolean);
    const runMigration = async () => {
      for (const statement of statements) await prisma.$executeRawUnsafe(statement);
    };
    const keysOf = async (roleId: number) =>
      (await prisma.rolePermission.findMany({ where: { roleId }, include: { permission: true } })).map((rp) => rp.permission.key).sort();

    it('gives the built-in roles their new permissions without the seed, and can be run twice', async () => {
      const w = await world();
      const make = (name: string, isSystemRole = true, associationId = w.A) =>
        prisma.role.create({ data: { associationId, name, displayName: name, isSystemRole } });
      const admin = await make('admin');
      const treasurer = await make('treasurer');
      const plainMember = await make('member');
      const custom = await make('admin', false, (await world()).A);
      await runMigration();
      await runMigration();
      expect(await keysOf(admin.id)).toEqual(
        expect.arrayContaining(['cooperatives.withdraw_own', 'cooperatives.manage_types', 'cooperatives.withdrawals.review', 'cooperatives.withdrawals.approve', 'cooperatives.view_own']),
      );
      expect(await keysOf(treasurer.id)).toEqual(expect.arrayContaining(['cooperatives.manage_types', 'cooperatives.withdrawals.review']));
      expect(await keysOf(treasurer.id)).not.toContain('cooperatives.withdrawals.approve');
      expect(await keysOf(plainMember.id)).toEqual(['cooperatives.withdraw_own']);
      expect(await keysOf(custom.id)).toEqual([]);
    });

    it('leaves a standalone thrift group without cooperative permissions', async () => {
      const w = await world();
      await prisma.association.update({ where: { id: w.A }, data: { kind: 'THRIFT_GROUP' } });
      const role = await prisma.role.create({ data: { associationId: w.A, name: 'member', displayName: 'Member', isSystemRole: true } });
      await runMigration();
      expect(await keysOf(role.id)).toEqual([]);
    });
  });
});
