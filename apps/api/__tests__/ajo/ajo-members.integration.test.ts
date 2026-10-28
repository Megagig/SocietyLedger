/**
 * Ajo T2 against a real (disposable) database: approval and activation, the phone code, the payout account and SocietyLedger verification.
 *
 * Needs a migrated database. Point AJO_TEST_DATABASE_URL at one whose name contains "test" (the suite refuses anything else, because it
 * creates rows). Without the variable the whole suite is skipped, so a normal `pnpm test` never touches a database.
 *
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/ajo/ajo-members
 *
 * Only the edges are replaced: the plan's contributor limit, notifications, platform settings and the SMS provider. The transactions, the
 * per-tenant lock, the audit rows and the encryption are the real thing.
 */
const TEST_DB = process.env.AJO_TEST_DATABASE_URL;
if (TEST_DB && !/test/i.test(new URL(TEST_DB).pathname)) {
  throw new Error('AJO_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (TEST_DB) {
  process.env.DATABASE_URL = TEST_DB;
  process.env.DIRECT_URL = TEST_DB;
  process.env.TOTP_ENCRYPTION_KEY = 'integration-test-encryption-key-0123456789';
}

const mockLimit = { value: 100 as number | null };
const mockSettings = { hours: 72 };
const notices: Array<{ to: string; userId?: number; permission?: string; pushType: string; message: string }> = [];

jest.mock('../../src/services/billing/entitlements.service', () => ({
  computeEntitlements: jest.fn(async () => ({ limits: { ajoContributors: mockLimit.value } })),
}));
jest.mock('../../src/modules/admin/platform-settings.service', () => ({
  PlatformSettingsService: { getSettings: jest.fn(async () => ({ ajoPayoutCooloffHours: mockSettings.hours })) },
}));
jest.mock('../../src/modules/ajo/ajo-support', () => {
  const actual = jest.requireActual('../../src/modules/ajo/ajo-support');
  return {
    ...actual,
    notifyUser: jest.fn(async (_a: number, userId: number, n: { pushType: string; message: string }) => {
      notices.push({ to: 'user', userId, pushType: n.pushType, message: n.message });
    }),
    notifyPermissionHolders: jest.fn(async (_a: number, permission: string, n: { pushType: string; message: string }) => {
      notices.push({ to: 'holders', permission, pushType: n.pushType, message: n.message });
    }),
  };
});

const suite = TEST_DB ? describe : describe.skip;
// Real transactions against a shared database: under load a test can take longer than Jest's 5 seconds, and a test that times out keeps running into the next.
if (TEST_DB) jest.setTimeout(30000);
const run = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const ACCOUNT = '0123456789';

/* eslint-disable @typescript-eslint/no-var-requires */
suite('Ajo members, phone code, payout account and verification (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let members: typeof import('../../src/modules/ajo/ajo-membership.service');
  let phone: typeof import('../../src/modules/ajo/ajo-phone-code.service');
  let accounts: typeof import('../../src/modules/ajo/ajo-payout-account.service');
  let verification: typeof import('../../src/modules/ajo/ajo-verification.service');

  let A: number; // the association under test
  let B: number; // another association, for cross-tenant attempts
  let officer: { id: number };
  let officerB: { id: number };
  let counter = 0;
  const sms: Array<{ to: string; message: string }> = [];
  const send = async ({ to, message }: { to: string; message: string }) => {
    sms.push({ to, message });
    return { success: true, messageId: `m-${sms.length}`, message: 'ok' };
  };
  const lastCode = () => /is (\d{6})\./.exec(sms[sms.length - 1]?.message ?? '')?.[1] ?? '';

  async function mkAssociation(label: string) {
    const slug = `ajo-${label}-${run}`;
    return prisma.association.create({ data: { name: `Ajo ${label} ${run}`, slug, subdomain: slug } });
  }
  async function mkUser(associationId: number, label: string) {
    return prisma.user.create({ data: { associationId, email: `${label}-${run}-${++counter}@test.local`, passwordHash: 'x', isActive: true } });
  }
  async function mkMember(associationId: number, over: { phone?: string | null; address?: string | null; withUser?: boolean; first?: string } = {}) {
    const n = ++counter;
    const user = over.withUser ? await mkUser(associationId, 'member') : null;
    return prisma.member.create({
      data: {
        associationId,
        userId: user?.id ?? null,
        memberId: `M${run}${n}`,
        firstName: over.first ?? 'Adaeze',
        lastName: `Okafor${n}`,
        phone: over.phone === undefined ? '08031234567' : over.phone,
        address: over.address === undefined ? '12 Market Road, Aba' : over.address,
        status: 'active',
      },
    });
  }
  async function mkGroup(associationId: number, over: { requirePhoneConfirm?: boolean; maxParticipants?: number } = {}) {
    return prisma.ajoGroup.create({
      data: { associationId, name: `Market Circle ${++counter}`, model: 'COLLECTOR_THRIFT', frequency: 'WEEKLY', contributionKobo: BigInt(500_000), startDate: new Date('2027-01-04'), maxParticipants: over.maxParticipants ?? 30, requirePhoneConfirm: over.requirePhoneConfirm ?? false, status: 'OPEN' },
    });
  }
  async function pendingMember(groupId: number, over: Parameters<typeof mkMember>[1] = {}, assoc = A) {
    const member = await mkMember(assoc, over);
    const membership = await members.addMember({ associationId: assoc, groupId, memberId: member.id, actorUserId: officer.id });
    return { member, membership };
  }
  const audits = (action: string, recordId?: number) => prisma.auditLog.findMany({ where: { associationId: A, action, ...(recordId ? { recordId } : {}) } });

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    members = require('../../src/modules/ajo/ajo-membership.service');
    phone = require('../../src/modules/ajo/ajo-phone-code.service');
    accounts = require('../../src/modules/ajo/ajo-payout-account.service');
    verification = require('../../src/modules/ajo/ajo-verification.service');
    A = (await mkAssociation('a')).id;
    B = (await mkAssociation('b')).id;
    officer = await mkUser(A, 'officer');
    officerB = await mkUser(B, 'officer-b');
  });

  beforeEach(() => {
    mockLimit.value = 100;
    mockSettings.hours = 72;
    notices.length = 0;
    sms.length = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('approval and activation (T2.1)', () => {
    it('adds a pending member, approves them, and they become active with the whole trail audited', async () => {
      const group = await mkGroup(A);
      const { member, membership } = await pendingMember(group.id);
      expect(membership.status).toBe('PENDING');

      const result = await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id });
      expect(result).toMatchObject({ status: 'ACTIVE', activated: true, unmet: [], blockedByLimit: null, replayed: false });

      const row = await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membership.id } });
      expect(row).toMatchObject({ status: 'ACTIVE', approvedBy: officer.id });
      expect(row.approvedAt).not.toBeNull();
      expect(row.joinedAt).not.toBeNull();

      expect(await audits('AJO_MEMBER_ADDED', membership.id)).toHaveLength(1);
      expect(await audits('AJO_MEMBERSHIP_APPROVED', membership.id)).toHaveLength(1);
      expect(await audits('AJO_MEMBERSHIP_ACTIVATED', membership.id)).toHaveLength(1);

      // The group's approval puts the person in SocietyLedger's queue, with what they submitted.
      const v = await verification.latestVerification(prisma, A, member.id);
      expect(v).toMatchObject({ status: 'PENDING', submittedName: `Adaeze ${member.lastName}`, submittedPhone: '08031234567', submittedAddress: '12 Market Road, Aba' });
    });

    it('is safe to approve twice: nothing is recorded twice', async () => {
      const group = await mkGroup(A);
      const { member, membership } = await pendingMember(group.id);
      await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id });
      const again = await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id });
      expect(again).toMatchObject({ status: 'ACTIVE', replayed: true, activated: false });
      expect(await audits('AJO_MEMBERSHIP_APPROVED', membership.id)).toHaveLength(1);
      expect(await prisma.ajoVerification.count({ where: { memberId: member.id } })).toBe(1);
    });

    it('keeps an unapproved person out: no schedule, no contribution', async () => {
      const group = await mkGroup(A);
      const { membership } = await pendingMember(group.id);
      await expect(members.assertCanContribute(prisma, { associationId: A, membershipId: membership.id })).rejects.toMatchObject({ code: 'MEMBERSHIP_NOT_ACTIVE', status: 403 });
      await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id });
      await expect(members.assertCanContribute(prisma, { associationId: A, membershipId: membership.id })).resolves.toBeUndefined();
    });

    it('refuses contributions from a suspended member and in a closed group', async () => {
      const group = await mkGroup(A);
      const { membership } = await pendingMember(group.id);
      await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id });
      await prisma.ajoMembership.update({ where: { id: membership.id }, data: { status: 'SUSPENDED' } });
      await expect(members.assertCanContribute(prisma, { associationId: A, membershipId: membership.id })).rejects.toMatchObject({ code: 'MEMBERSHIP_NOT_ACTIVE' });
      await prisma.ajoMembership.update({ where: { id: membership.id }, data: { status: 'ACTIVE' } });
      await prisma.ajoGroup.update({ where: { id: group.id }, data: { status: 'CANCELLED' } });
      await expect(members.assertCanContribute(prisma, { associationId: A, membershipId: membership.id })).rejects.toMatchObject({ code: 'GROUP_CLOSED' });
    });

    it('does not let an officer approve their own membership', async () => {
      const group = await mkGroup(A);
      const self = await prisma.member.create({ data: { associationId: A, userId: officer.id, memberId: `S${run}${++counter}`, firstName: 'Officer', lastName: 'Self', status: 'active' } });
      const membership = await members.addMember({ associationId: A, groupId: group.id, memberId: self.id, actorUserId: officer.id });
      await expect(members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id })).rejects.toMatchObject({ code: 'SELF_APPROVAL', status: 403 });
    });

    it('cannot reach another association: its group, its member or its membership', async () => {
      const groupB = await mkGroup(B);
      const memberA = await mkMember(A);
      const memberB = await mkMember(B);
      const { membership: membershipB } = await pendingMember(groupB.id, {}, B).catch(async () => {
        // addMember audits against officer.id (association A's user); use B's officer for B's data.
        const m = await mkMember(B);
        return { member: m, membership: await members.addMember({ associationId: B, groupId: groupB.id, memberId: m.id, actorUserId: officerB.id }) };
      });

      await expect(members.addMember({ associationId: A, groupId: groupB.id, memberId: memberA.id, actorUserId: officer.id })).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND', status: 404 });
      const groupA = await mkGroup(A);
      await expect(members.addMember({ associationId: A, groupId: groupA.id, memberId: memberB.id, actorUserId: officer.id })).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND', status: 404 });
      await expect(members.approveMembership({ associationId: A, membershipId: membershipB.id, actorUserId: officer.id })).rejects.toMatchObject({ code: 'MEMBERSHIP_NOT_FOUND', status: 404 });
      await expect(members.assertCanContribute(prisma, { associationId: A, membershipId: membershipB.id })).rejects.toMatchObject({ code: 'MEMBERSHIP_NOT_FOUND' });
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membershipB.id } })).status).toBe('PENDING');
    });

    it('refuses a duplicate and a full group', async () => {
      const group = await mkGroup(A, { maxParticipants: 2 });
      const first = await pendingMember(group.id);
      await expect(members.addMember({ associationId: A, groupId: group.id, memberId: first.member.id, actorUserId: officer.id })).rejects.toMatchObject({ code: 'ALREADY_IN_GROUP' });
      await pendingMember(group.id);
      const extra = await mkMember(A);
      await expect(members.addMember({ associationId: A, groupId: group.id, memberId: extra.id, actorUserId: officer.id })).rejects.toMatchObject({ code: 'GROUP_FULL' });
    });

    it('holds a membership back when the plan has no room, and completes it after the plan grows', async () => {
      const tenant = (await mkAssociation('limit')).id;
      const boss = await mkUser(tenant, 'boss');
      const group = await mkGroup(tenant);
      const add = async () => {
        const m = await mkMember(tenant);
        return { m, ms: await members.addMember({ associationId: tenant, groupId: group.id, memberId: m.id, actorUserId: boss.id }) };
      };
      mockLimit.value = 1;
      const one = await add();
      const two = await add();
      expect(await members.approveMembership({ associationId: tenant, membershipId: one.ms.id, actorUserId: boss.id })).toMatchObject({ status: 'ACTIVE', activated: true });

      const held = await members.approveMembership({ associationId: tenant, membershipId: two.ms.id, actorUserId: boss.id });
      expect(held).toMatchObject({ status: 'PENDING', activated: false, blockedByLimit: { code: 'AJO_CONTRIBUTOR_LIMIT', limit: 1, count: 1 } });
      // The approval itself stands: it is recorded and the person is waiting only for room.
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: two.ms.id } })).approvedAt).not.toBeNull();

      mockLimit.value = 2;
      expect(await members.approveMembership({ associationId: tenant, membershipId: two.ms.id, actorUserId: boss.id })).toMatchObject({ status: 'ACTIVE', activated: true, replayed: true });
    });

    it('counts a person once across groups', async () => {
      const tenant = (await mkAssociation('once')).id;
      const boss = await mkUser(tenant, 'boss');
      const g1 = await mkGroup(tenant);
      const g2 = await mkGroup(tenant);
      mockLimit.value = 1;
      const m = await mkMember(tenant);
      const in1 = await members.addMember({ associationId: tenant, groupId: g1.id, memberId: m.id, actorUserId: boss.id });
      const in2 = await members.addMember({ associationId: tenant, groupId: g2.id, memberId: m.id, actorUserId: boss.id });
      expect(await members.approveMembership({ associationId: tenant, membershipId: in1.id, actorUserId: boss.id })).toMatchObject({ activated: true });
      // At the limit already, but this person is the one contributor, so the second group does not add to the count.
      expect(await members.approveMembership({ associationId: tenant, membershipId: in2.id, actorUserId: boss.id })).toMatchObject({ activated: true });
    });

    it('never lets simultaneous approvals pass the limit', async () => {
      const tenant = (await mkAssociation('race')).id;
      const boss = await mkUser(tenant, 'boss');
      const group = await mkGroup(tenant);
      mockLimit.value = 2;
      const rows = [];
      for (let i = 0; i < 6; i++) {
        const m = await mkMember(tenant);
        rows.push(await members.addMember({ associationId: tenant, groupId: group.id, memberId: m.id, actorUserId: boss.id }));
      }
      const outcomes = await Promise.all(rows.map((r) => members.approveMembership({ associationId: tenant, membershipId: r.id, actorUserId: boss.id })));
      expect(outcomes.filter((o) => o.activated)).toHaveLength(2);
      expect(await prisma.ajoMembership.count({ where: { associationId: tenant, status: 'ACTIVE' } })).toBe(2);
      expect(outcomes.filter((o) => o.blockedByLimit)).toHaveLength(4);
    });

    it('lists approval and phone confirmation as the missing requirements', () => {
      const base = { approvedAt: null, requirePhoneConfirm: true, phoneConfirmedNumber: null, memberPhone: '08031234567' };
      expect(members.unmetRequirements(base)).toEqual(['APPROVAL', 'PHONE_CONFIRMATION']);
      expect(members.unmetRequirements({ ...base, approvedAt: new Date() })).toEqual(['PHONE_CONFIRMATION']);
      expect(members.unmetRequirements({ ...base, approvedAt: new Date(), phoneConfirmedNumber: '2348031234567' })).toEqual([]);
      // A confirmation is for one number: a changed number must be confirmed again.
      expect(members.unmetRequirements({ ...base, approvedAt: new Date(), phoneConfirmedNumber: '2348031234567', memberPhone: '08099999999' })).toEqual(['PHONE_CONFIRMATION']);
      expect(members.unmetRequirements({ ...base, requirePhoneConfirm: false, approvedAt: new Date() })).toEqual([]);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('phone confirmation code (T2.1)', () => {
    async function withCredits(associationId: number, balance = 10) {
      await prisma.sMSCreditBalance.upsert({ where: { associationId }, create: { associationId, balance, totalPurchased: balance, totalUsed: 0 }, update: { balance } });
    }
    const balance = async (associationId = A) => Number((await prisma.sMSCreditBalance.findUnique({ where: { associationId } }))?.balance ?? 0);
    async function pendingWithPhoneRule() {
      const group = await mkGroup(A, { requirePhoneConfirm: true });
      const made = await pendingMember(group.id, { withUser: true });
      await members.approveMembership({ associationId: A, membershipId: made.membership.id, actorUserId: officer.id });
      return made;
    }

    it('waits for the code: approval alone does not activate a group that asks for it', async () => {
      const { membership } = await pendingWithPhoneRule();
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membership.id } })).status).toBe('PENDING');
      await expect(members.assertCanContribute(prisma, { associationId: A, membershipId: membership.id })).rejects.toMatchObject({ code: 'MEMBERSHIP_NOT_ACTIVE', message: expect.stringContaining('confirm their phone') });
    });

    it('sends a code (one credit), confirms it, and activates the member', async () => {
      await withCredits(A, 10);
      const { membership } = await pendingWithPhoneRule();
      const sent = await phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send });
      expect(sent.sentTo).toMatch(/^234803•••••567$/);
      expect(sms).toHaveLength(1);
      expect(sms[0]?.to).toBe('2348031234567');
      expect(await balance()).toBe(9);

      // The database holds a hash, never the code.
      const stored = await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membership.id } });
      expect(stored.phoneCodeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(stored)).not.toContain(lastCode());

      const done = await phone.confirmPhoneCode({ associationId: A, membershipId: membership.id, code: lastCode(), actorUserId: officer.id });
      expect(done).toMatchObject({ confirmed: true, activation: { status: 'ACTIVE', activated: true } });
      const after = await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membership.id } });
      expect(after).toMatchObject({ status: 'ACTIVE', phoneConfirmedNumber: '2348031234567', phoneCodeHash: null });
      expect(await audits('AJO_PHONE_CONFIRMED', membership.id)).toHaveLength(1);
    });

    it('counts wrong tries, then locks the code after five', async () => {
      await withCredits(A, 10);
      const { membership } = await pendingWithPhoneRule();
      await phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send });
      const right = lastCode();
      const wrong = right === '000000' ? '111111' : '000000';

      await expect(phone.confirmPhoneCode({ associationId: A, membershipId: membership.id, code: wrong, actorUserId: officer.id })).rejects.toMatchObject({ code: 'CODE_INVALID', message: expect.stringContaining('4 tries left') });
      for (let i = 0; i < 4; i++) {
        await expect(phone.confirmPhoneCode({ associationId: A, membershipId: membership.id, code: wrong, actorUserId: officer.id })).rejects.toMatchObject({ code: 'CODE_INVALID' });
      }
      // Locked: even the right code no longer works. A new one is needed.
      await expect(phone.confirmPhoneCode({ associationId: A, membershipId: membership.id, code: right, actorUserId: officer.id })).rejects.toMatchObject({ code: 'NO_CODE' });
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membership.id } })).status).toBe('PENDING');
    });

    it('rejects an expired code', async () => {
      await withCredits(A, 10);
      const { membership } = await pendingWithPhoneRule();
      const t0 = new Date();
      await phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send, now: t0 });
      await expect(phone.confirmPhoneCode({ associationId: A, membershipId: membership.id, code: lastCode(), actorUserId: officer.id, now: new Date(t0.getTime() + 11 * MIN) })).rejects.toMatchObject({ code: 'CODE_EXPIRED' });
    });

    it('allows one resend a minute and five codes a day', async () => {
      await withCredits(A, 20);
      const { membership } = await pendingWithPhoneRule();
      // A fixed time well inside one Lagos day: "five a day" resets at local midnight, so the real clock could straddle it.
      const t0 = new Date('2027-02-01T10:00:00Z');
      await phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send, now: t0 });
      await expect(phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send, now: new Date(t0.getTime() + 20_000) })).rejects.toMatchObject({ code: 'CODE_TOO_SOON', status: 429 });
      for (let i = 1; i < 5; i++) await phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send, now: new Date(t0.getTime() + i * 61_000) });
      expect(sms).toHaveLength(5);
      await expect(phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send, now: new Date(t0.getTime() + 6 * 61_000) })).rejects.toMatchObject({ code: 'DAILY_CODE_LIMIT', status: 429 });
      expect(sms).toHaveLength(5);
    });

    it('stops with NO_SMS_CREDITS and leaves nothing behind when the association has no credits', async () => {
      await withCredits(A, 0);
      const { membership } = await pendingWithPhoneRule();
      await expect(phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send })).rejects.toMatchObject({ code: 'NO_SMS_CREDITS', status: 402 });
      expect(sms).toHaveLength(0);
      const row = await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membership.id } });
      expect(row).toMatchObject({ phoneCodeHash: null, phoneCodeDayCount: 0, phoneCodeSentAt: null });
      // There is no way round it: the member stays pending.
      expect(row.status).toBe('PENDING');
    });

    it('gives the credit back and fails clearly when the text cannot be delivered', async () => {
      await withCredits(A, 5);
      const { membership } = await pendingWithPhoneRule();
      const broken = async () => ({ success: false, message: 'Failed', error: 'provider down' });
      await expect(phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send: broken })).rejects.toMatchObject({ code: 'SMS_FAILED', status: 503 });
      expect(await balance()).toBe(5);
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membership.id } })).phoneCodeHash).toBeNull();
    });

    it('makes the code useless if the phone number changes before it is entered', async () => {
      await withCredits(A, 10);
      const { member, membership } = await pendingWithPhoneRule();
      await phone.requestPhoneCode({ associationId: A, membershipId: membership.id, send });
      const code = lastCode();
      await prisma.member.update({ where: { id: member.id }, data: { phone: '08099999999' } });
      await expect(phone.confirmPhoneCode({ associationId: A, membershipId: membership.id, code, actorUserId: officer.id })).rejects.toMatchObject({ code: 'CODE_INVALID' });
      expect((await prisma.ajoMembership.findUniqueOrThrow({ where: { id: membership.id } })).phoneConfirmedNumber).toBeNull();
    });

    it('does not send to a group that does not ask, to a bad number, or to another association', async () => {
      await withCredits(A, 10);
      const plain = await pendingMember((await mkGroup(A)).id);
      await expect(phone.requestPhoneCode({ associationId: A, membershipId: plain.membership.id, send })).rejects.toMatchObject({ code: 'PHONE_CONFIRMATION_NOT_REQUIRED' });

      const badPhone = await pendingMember((await mkGroup(A, { requirePhoneConfirm: true })).id, { phone: '12345' });
      await expect(phone.requestPhoneCode({ associationId: A, membershipId: badPhone.membership.id, send })).rejects.toMatchObject({ code: 'MEMBER_PHONE_INVALID' });

      const { membership } = await pendingWithPhoneRule();
      await expect(phone.requestPhoneCode({ associationId: B, membershipId: membership.id, send })).rejects.toMatchObject({ code: 'MEMBERSHIP_NOT_FOUND' });
      expect(sms).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('payout account (T2.2)', () => {
    const entry = (memberId: number, over: Record<string, unknown> = {}) => ({ associationId: A, memberId, bankName: 'GTBank', accountNumber: ACCOUNT, accountName: 'Adaeze Okafor', actorUserId: officer.id, ...over });

    it('stores the number encrypted, shows it masked, and starts the cool-off', async () => {
      const member = await mkMember(A);
      const now = new Date('2027-02-01T10:00:00Z');
      const result = await accounts.setPayoutAccount(entry(member.id, { now }));
      expect(result).toMatchObject({ replayed: false, voidedPayoutIds: [], verification: 'NONE' });
      expect(result.account).toMatchObject({ bankName: 'GTBank', accountMasked: '••••6789', inCoolOff: true });
      expect(result.account.coolOffUntil?.toISOString()).toBe('2027-02-04T10:00:00.000Z'); // 72 hours

      const raw = await prisma.ajoPayoutAccount.findUniqueOrThrow({ where: { memberId: member.id } });
      expect(JSON.stringify(raw)).not.toContain(ACCOUNT);
      expect(raw.last4).toBe('6789');
      expect(raw.accountNumberEnc).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    });

    it('treats the same details sent again as nothing new: no restart of the cool-off', async () => {
      const member = await mkMember(A);
      const first = await accounts.setPayoutAccount(entry(member.id, { now: new Date('2027-02-01T10:00:00Z') }));
      notices.length = 0;
      const again = await accounts.setPayoutAccount(entry(member.id, { accountNumber: '0123 456 789', now: new Date('2027-02-02T10:00:00Z') }));
      expect(again.replayed).toBe(true);
      expect(again.account.coolOffUntil).toEqual(first.account.coolOffUntil);
      expect(notices).toHaveLength(0);
    });

    it('switches the cool-off off when the platform sets zero hours', async () => {
      mockSettings.hours = 0;
      const member = await mkMember(A);
      const result = await accounts.setPayoutAccount(entry(member.id));
      expect(result.account).toMatchObject({ coolOffUntil: null, inCoolOff: false });
    });

    it('voids an approved payout, restarts the cool-off and sends the person back to pending when the account changes', async () => {
      const group = await mkGroup(A);
      const { member, membership } = await pendingMember(group.id, { withUser: true });
      await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id });
      await accounts.setPayoutAccount(entry(member.id, { now: new Date('2027-02-01T10:00:00Z') }));
      const v = await verification.latestVerification(prisma, A, member.id);
      await verification.decideVerification({ verificationId: v!.id, reviewerId: officer.id, reviewerRole: 'SUPER_ADMIN', decision: 'VERIFIED', checklist: { nameMatchesAccount: true, phoneConfirmed: true, addressFilled: true } });

      const payout = (key: string, status: 'APPROVED' | 'PAID' | 'PREPARED') =>
        prisma.ajoPayout.create({ data: { associationId: A, groupId: group.id, membershipId: membership.id, grossKobo: BigInt(5_000_000), netKobo: BigInt(5_000_000), status, preparedBy: officer.id, accountSnapshot: { last4: '6789' }, idempotencyKey: `${key}-${run}-${++counter}` } });
      const approved = await payout('a', 'APPROVED');
      const paid = await payout('p', 'PAID');
      const prepared = await payout('r', 'PREPARED');
      notices.length = 0;

      const later = new Date('2027-02-10T09:00:00Z');
      const changed = await accounts.setPayoutAccount(entry(member.id, { accountNumber: '9876543210', now: later }));
      expect(changed).toMatchObject({ replayed: false, voidedPayoutIds: [approved.id], verification: 'RESET' });
      expect(changed.account.coolOffUntil?.toISOString()).toBe('2027-02-13T09:00:00.000Z');

      const statuses = Object.fromEntries((await prisma.ajoPayout.findMany({ where: { id: { in: [approved.id, paid.id, prepared.id] } } })).map((p) => [p.id, p.status]));
      expect(statuses).toEqual({ [approved.id]: 'VOID', [paid.id]: 'PAID', [prepared.id]: 'PREPARED' });
      expect((await prisma.ajoPayout.findUniqueOrThrow({ where: { id: approved.id } })).voidReason).toMatch(/payout account was changed/);

      // A verified person is back to pending, with the old decision kept as history.
      expect((await verification.latestVerification(prisma, A, member.id))?.status).toBe('PENDING');
      expect(await prisma.ajoVerification.count({ where: { memberId: member.id } })).toBe(2);

      expect(await audits('AJO_PAYOUT_ACCOUNT_CHANGED')).not.toHaveLength(0);
      expect(notices.map((n) => n.to).sort()).toEqual(['holders', 'user']);
      expect(notices.every((n) => n.pushType === 'ajo.payout_account_changed')).toBe(true);
      expect(notices.find((n) => n.to === 'holders')?.message).toContain('cancelled and must be approved again');
    });

    it('lets the owner and officers read the full number, and audits every look', async () => {
      const member = await mkMember(A);
      await accounts.setPayoutAccount(entry(member.id));
      expect(await accounts.revealAccountNumber({ associationId: A, memberId: member.id, actorUserId: officer.id })).toBe(ACCOUNT);
      const views = await audits('AJO_PAYOUT_ACCOUNT_VIEWED');
      expect(views.filter((a) => (a.newValues as { memberId?: number })?.memberId === member.id)).toHaveLength(1);
    });

    it('rejects a bad number or name, and another association\'s member', async () => {
      const member = await mkMember(A);
      await expect(accounts.setPayoutAccount(entry(member.id, { accountNumber: '12345' }))).rejects.toMatchObject({ code: 'INVALID_PAYOUT_ACCOUNT' });
      await expect(accounts.setPayoutAccount(entry(member.id, { accountName: ' ' }))).rejects.toMatchObject({ code: 'INVALID_PAYOUT_ACCOUNT' });
      await expect(accounts.setPayoutAccount(entry(member.id, { associationId: B }))).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });
      await expect(accounts.getPayoutAccount({ associationId: B, memberId: member.id })).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });
      await expect(accounts.revealAccountNumber({ associationId: B, memberId: member.id, actorUserId: officerB.id })).rejects.toMatchObject({ code: 'MEMBER_NOT_FOUND' });
    });

    it('never lets the full number into a response, an audit row, a notification or a log line', async () => {
      const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
      try {
        const group = await mkGroup(A);
        const { member, membership } = await pendingMember(group.id, { withUser: true });
        await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id });
        notices.length = 0;
        const responses = [
          await accounts.setPayoutAccount(entry(member.id)),
          await accounts.setPayoutAccount(entry(member.id, { accountNumber: '5550001111' })),
          await accounts.getPayoutAccount({ associationId: A, memberId: member.id }),
        ];
        const queue = await verification.listVerificationQueue({});
        const detail = await verification.getVerificationDetail((await verification.latestVerification(prisma, A, member.id))!.id);
        const auditRows = await prisma.auditLog.findMany({ where: { associationId: A, tableName: 'ajo_payout_accounts' } });

        const everything = JSON.stringify({ responses, queue, detail, auditRows, notices });
        const logged = spies.flatMap((s) => s.mock.calls).map((c) => JSON.stringify(c)).join('\n');
        for (const secret of [ACCOUNT, '5550001111']) {
          expect(everything).not.toContain(secret);
          expect(logged).not.toContain(secret);
        }
        expect(everything).toContain('••••1111');
      } finally {
        spies.forEach((s) => s.mockRestore());
      }
    });
  });

  // ----------------------------------------------------------------------------------------------------------------------------
  describe('SocietyLedger verification (T2.3)', () => {
    const checklist = { nameMatchesAccount: true, phoneConfirmed: true, addressFilled: true };
    const staff = { reviewerId: 0, reviewerRole: 'COMPLIANCE_ADMIN' };

    async function approvedWithAccount() {
      const group = await mkGroup(A);
      const made = await pendingMember(group.id, { withUser: true });
      await members.approveMembership({ associationId: A, membershipId: made.membership.id, actorUserId: officer.id });
      await accounts.setPayoutAccount({ associationId: A, memberId: made.member.id, bankName: 'GTBank', accountNumber: ACCOUNT, accountName: 'Adaeze Okafor', actorUserId: officer.id, now: new Date('2027-03-01T08:00:00Z') });
      const v = (await verification.latestVerification(prisma, A, made.member.id))!;
      return { ...made, v, group };
    }

    it('cannot be decided before the person has a payout account to compare', async () => {
      const group = await mkGroup(A);
      const { member, membership } = await pendingMember(group.id);
      await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id });
      const v = (await verification.latestVerification(prisma, A, member.id))!;
      await expect(verification.decideVerification({ ...staff, reviewerId: officer.id, verificationId: v.id, decision: 'VERIFIED', checklist })).rejects.toMatchObject({ code: 'PAYOUT_ACCOUNT_MISSING' });
    });

    it('verifies only when all three checks pass, and records who decided and why', async () => {
      const { v } = await approvedWithAccount();
      await expect(verification.decideVerification({ ...staff, reviewerId: officer.id, verificationId: v.id, decision: 'VERIFIED', checklist: { ...checklist, addressFilled: false } })).rejects.toMatchObject({ code: 'CHECKLIST_INCOMPLETE' });

      await verification.decideVerification({ ...staff, reviewerId: officer.id, verificationId: v.id, decision: 'VERIFIED', checklist });
      const row = await prisma.ajoVerification.findUniqueOrThrow({ where: { id: v.id } });
      expect(row).toMatchObject({ status: 'VERIFIED', reviewedBy: officer.id, nameMatchesAccount: true, phoneConfirmed: true, addressFilled: true, submittedAccountName: 'Adaeze Okafor', rejectionReason: null });
      expect(row.reviewedAt).not.toBeNull();

      const logged = await prisma.platformActionLog.findMany({ where: { targetType: 'ajo_verification', targetId: v.id } });
      expect(logged).toHaveLength(1);
      expect(logged[0]).toMatchObject({ actionType: 'AJO_VERIFICATION_VERIFIED', actorRole: 'COMPLIANCE_ADMIN', associationId: A });
    });

    it('rejects with a reason the group admin is told, and refuses a rejection without one', async () => {
      const { v, member } = await approvedWithAccount();
      await expect(verification.decideVerification({ ...staff, reviewerId: officer.id, verificationId: v.id, decision: 'REJECTED', checklist: { ...checklist, nameMatchesAccount: false }, reason: 'too short' })).rejects.toMatchObject({ code: 'REASON_REQUIRED' });

      notices.length = 0;
      await verification.decideVerification({ ...staff, reviewerId: officer.id, verificationId: v.id, decision: 'REJECTED', checklist: { ...checklist, nameMatchesAccount: false }, reason: 'The account name does not match the member name.' });
      expect(notices.find((n) => n.to === 'holders')).toMatchObject({ permission: 'ajo.manage', pushType: 'ajo.verification_status' });
      expect(notices.find((n) => n.to === 'holders')?.message).toContain('The account name does not match the member name.');
      expect(notices.find((n) => n.to === 'user')?.message).toContain('could not verify you');

      const detail = await verification.getVerificationDetail(v.id);
      expect(detail).toMatchObject({ status: 'REJECTED', rejectionReason: 'The account name does not match the member name.' });
      expect(detail.current.payoutAccount?.masked).toBe('••••6789');

      // They fix it and are put back in the queue; the rejection stays as history.
      const again = await verification.resubmitVerification({ associationId: A, memberId: member.id, actorUserId: officer.id });
      expect(again.replayed).toBe(false);
      expect((await verification.latestVerification(prisma, A, member.id))?.status).toBe('PENDING');
      expect((await verification.resubmitVerification({ associationId: A, memberId: member.id, actorUserId: officer.id })).replayed).toBe(true);
      expect(await prisma.ajoVerification.count({ where: { memberId: member.id } })).toBe(2);
    });

    it('refuses a second decision on the same row, even from two reviewers at once', async () => {
      const { v } = await approvedWithAccount();
      const decide = () => verification.decideVerification({ ...staff, reviewerId: officer.id, verificationId: v.id, decision: 'VERIFIED', checklist });
      const settled = await Promise.allSettled([decide(), decide()]);
      expect(settled.filter((s) => s.status === 'fulfilled')).toHaveLength(1);
      expect(settled.find((s) => s.status === 'rejected')).toMatchObject({ reason: { code: 'ALREADY_DECIDED' } });
      expect(await prisma.platformActionLog.count({ where: { targetType: 'ajo_verification', targetId: v.id } })).toBe(1);
    });

    it('reviews on what is on file now, not the snapshot from when the group approved', async () => {
      const { v, member } = await approvedWithAccount();
      await prisma.member.update({ where: { id: member.id }, data: { address: '5 New Layout, Enugu' } });
      await verification.decideVerification({ ...staff, reviewerId: officer.id, verificationId: v.id, decision: 'VERIFIED', checklist });
      expect((await prisma.ajoVerification.findUniqueOrThrow({ where: { id: v.id } })).submittedAddress).toBe('5 New Layout, Enugu');
    });

    it('lists the queue with masked accounts only', async () => {
      const { v } = await approvedWithAccount();
      const queue = await verification.listVerificationQueue({ status: 'PENDING', associationId: A });
      const item = queue.items.find((i) => i.id === v.id);
      expect(queue.items.every((i) => i.association.id === A)).toBe(true);
      expect(item).toMatchObject({ status: 'PENDING', hasPayoutAccount: true, payoutAccount: { bankName: 'GTBank', masked: '••••6789' } });
    });

    describe('the payout guard', () => {
      const guard = (membershipId: number, now: Date, associationId = A) => verification.assertPayoutEligible(prisma, { associationId, membershipId, now });

      it('refuses without an account, then until verified, then through the cool-off, then allows', async () => {
        const group = await mkGroup(A);
        const { member, membership } = await pendingMember(group.id);
        await members.approveMembership({ associationId: A, membershipId: membership.id, actorUserId: officer.id });
        const t0 = new Date('2027-03-01T08:00:00Z');

        await expect(guard(membership.id, t0)).rejects.toMatchObject({ code: 'PAYOUT_ACCOUNT_MISSING' });

        await accounts.setPayoutAccount({ associationId: A, memberId: member.id, bankName: 'GTBank', accountNumber: ACCOUNT, accountName: 'Adaeze Okafor', actorUserId: officer.id, now: t0 });
        await expect(guard(membership.id, t0)).rejects.toMatchObject({ code: 'PERSON_NOT_VERIFIED', status: 403, message: expect.stringContaining('waiting for SocietyLedger') });

        const v = (await verification.latestVerification(prisma, A, member.id))!;
        await verification.decideVerification({ ...staff, reviewerId: officer.id, verificationId: v.id, decision: 'VERIFIED', checklist });
        await expect(guard(membership.id, new Date(t0.getTime() + 71 * HOUR))).rejects.toMatchObject({ code: 'PAYOUT_COOL_OFF', status: 403 });
        await expect(guard(membership.id, new Date(t0.getTime() + 73 * HOUR))).resolves.toBeUndefined();

        // A change sends them back: pending again, and cooling off again.
        await accounts.setPayoutAccount({ associationId: A, memberId: member.id, bankName: 'GTBank', accountNumber: '9876543210', accountName: 'Adaeze Okafor', actorUserId: officer.id, now: new Date(t0.getTime() + 80 * HOUR) });
        await expect(guard(membership.id, new Date(t0.getTime() + 90 * HOUR))).rejects.toMatchObject({ code: 'PERSON_NOT_VERIFIED' });
      });

      it('says why a person was rejected', async () => {
        const { v, membership } = await approvedWithAccount();
        await verification.decideVerification({ ...staff, reviewerId: officer.id, verificationId: v.id, decision: 'REJECTED', checklist: { ...checklist, addressFilled: false }, reason: 'There is no address on file for this member.' });
        await expect(guard(membership.id, new Date('2027-04-01T00:00:00Z'))).rejects.toMatchObject({ code: 'PERSON_NOT_VERIFIED', message: expect.stringContaining('There is no address on file') });
      });

      it('still lets a person who is not verified contribute: verification gates payouts only', async () => {
        const { membership } = await approvedWithAccount();
        await expect(members.assertCanContribute(prisma, { associationId: A, membershipId: membership.id })).resolves.toBeUndefined();
      });

      it('reports another association\'s membership as missing', async () => {
        const { membership } = await approvedWithAccount();
        await expect(guard(membership.id, new Date(), B)).rejects.toMatchObject({ code: 'MEMBERSHIP_NOT_FOUND' });
      });
    });
  });
});
