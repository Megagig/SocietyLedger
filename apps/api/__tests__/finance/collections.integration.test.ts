/**
 * The "who has paid" read model and its exports (levy campaign, donations, penalties, member ledgers), against a real database.
 *   AJO_TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/sl_ajo_test pnpm -F @societyledger/api exec jest __tests__/finance/collections --forceExit
 */
const COL_DB = process.env.AJO_TEST_DATABASE_URL;
if (COL_DB && !/test/i.test(new URL(COL_DB).pathname)) {
  throw new Error('AJO_TEST_DATABASE_URL must point at a database whose name contains "test".');
}
if (COL_DB) {
  process.env.DATABASE_URL = COL_DB;
  process.env.DIRECT_URL = COL_DB;
}

jest.mock('../../src/services/notification-preferences.service', () => ({
  dispatchNotification: jest.fn(async () => ({ inAppCreated: true, emailSent: false, smsSent: false })),
}));
jest.mock('../../src/services/accounting-integration.service', () => ({
  accountingIntegrationService: { onPaymentRecorded: jest.fn(async () => undefined), onTransactionCreated: jest.fn(async () => undefined) },
}));

const colSuite = COL_DB ? describe : describe.skip;
if (COL_DB) jest.setTimeout(120000);
const tag = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/* eslint-disable @typescript-eslint/no-var-requires */
colSuite('Collections: filters, search and exports (database)', () => {
  let prisma: typeof import('../../src/lib/prisma').default;
  let collections: typeof import('../../src/modules/finance/collections/collections.service').collectionsService;
  let recorder: typeof import('../../src/modules/finance/payment-recording.service').paymentRecordingService;
  let exporter: typeof import('../../src/modules/finance/collections/collection-export');
  let settingsService: typeof import('../../src/modules/settings/settings.service').SettingsService;
  let n = 0;

  async function campaignWorld() {
    const slug = `col-${tag}-${++n}`;
    const assoc = await prisma.association.create({ data: { name: `Savio ${n} ${tag}`, slug, subdomain: slug } });
    const user = (label: string) => prisma.user.create({ data: { associationId: assoc.id, email: `${label}-${tag}-${++n}@test.local`, passwordHash: 'x', isActive: true } });
    const officer = await user('officer');
    const treasurer = await user('treasurer');
    const category = await prisma.financialCategory.create({ data: { associationId: assoc.id, name: 'Burial Levy', type: 'levy' } });
    const campaign = await prisma.levyCampaign.create({
      data: { associationId: assoc.id, categoryId: category.id, name: 'Mum Burial Levy', targetAmount: 9000, amountPerMember: 3000, deadline: new Date('2027-01-06'), createdBy: officer.id },
    });
    const assign = async (first: string, last: string, userId: number | null = null) => {
      const member = await prisma.member.create({ data: { associationId: assoc.id, userId, memberId: `CM${tag}${++n}`, firstName: first, lastName: last, status: 'active' } });
      const charge = await prisma.transaction.create({ data: { associationId: assoc.id, memberId: member.id, categoryId: category.id, amount: 3000, status: 'pending', createdBy: officer.id } });
      await prisma.levyCampaignAssignment.create({ data: { campaignId: campaign.id, memberId: member.id, transactionId: charge.id, amount: 3000 } });
      return { member, charge };
    };
    const ada = await assign('Ada', 'Obi');
    const bola = await assign('Bola', 'Eze');
    const chike = await assign('Chike', 'Nnaji');
    return { A: assoc.id, officer, treasurer, category, campaign, ada, bola, chike, assign };
  }

  beforeAll(async () => {
    prisma = require('../../src/lib/prisma').default;
    collections = require('../../src/modules/finance/collections/collections.service').collectionsService;
    recorder = require('../../src/modules/finance/payment-recording.service').paymentRecordingService;
    exporter = require('../../src/modules/finance/collections/collection-export');
    settingsService = require('../../src/modules/settings/settings.service').SettingsService;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const pay = (w: { A: number; treasurer: { id: number } }, transactionId: number, amountPaid: number) =>
    recorder.record(w.A, w.treasurer.id, { items: [{ transactionId, amountPaid }], paymentMethod: 'cash' });
  const names = (doc: { rows: unknown[][] }) => doc.rows.map((r) => r[1]);

  describe('levy campaign', () => {
    it('lists paid, part paid and not paid from the money, and filters them', async () => {
      const w = await campaignWorld();
      await pay(w, w.ada.charge.id, 3000);
      await pay(w, w.bola.charge.id, 1000);
      const all = await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'all' });
      expect(all.rows.map((r) => r[6])).toEqual(expect.arrayContaining(['Paid', 'Part paid', 'Not paid']));
      expect(names(await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'paid' }))).toEqual(['Ada Obi']);
      expect(names(await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'part' }))).toEqual(['Bola Eze']);
      expect(names(await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'unpaid' }))).toEqual(['Chike Nnaji']);
      expect(names(await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'owing' })).sort()).toEqual(['Bola Eze', 'Chike Nnaji']);
    });

    it('finds a member by name or number, within the filter', async () => {
      const w = await campaignWorld();
      expect(names(await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'all', search: 'bola' }))).toEqual(['Bola Eze']);
      expect(names(await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'all', search: w.chike.member.memberId }))).toEqual(['Chike Nnaji']);
      await pay(w, w.bola.charge.id, 3000);
      expect(await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'owing', search: 'bola' }).then((d) => d.rows)).toEqual([]);
    });

    it('totals only the people listed, in full, and says which filter made the list', async () => {
      const w = await campaignWorld();
      await pay(w, w.ada.charge.id, 3000);
      await pay(w, w.bola.charge.id, 1000);
      const doc = await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'owing' });
      const value = (label: string) => doc.summary.find((s) => s.label === label)?.value;
      expect(value('People listed')).toBe(2);
      expect(value('Expected')).toBe(6000);
      expect(value('Paid')).toBe(1000);
      expect(value('Outstanding')).toBe(5000);
      expect(doc.filterLine).toContain('Yet to pay');
      expect(doc.title).toContain('Mum Burial Levy');
    });

    it('does not show another association’s campaign', async () => {
      const w = await campaignWorld();
      const other = await campaignWorld();
      await expect(collections.build(other.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'all' })).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('files', () => {
    it('makes a real Excel workbook with the rows, money as numbers', async () => {
      const w = await campaignWorld();
      await pay(w, w.ada.charge.id, 3000);
      const doc = await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'all' });
      const file = await exporter.toExcel(doc);
      expect(file.subarray(0, 2).toString()).toBe('PK');
      const ExcelJS = require('exceljs');
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(file);
      const sheet = book.worksheets[0];
      const dump: unknown[][] = [];
      sheet.eachRow((row: { values: unknown[] }) => dump.push((row.values as unknown[]).slice(1)));
      const header = dump.findIndex((r) => r[0] === 'Member no.');
      expect(header).toBeGreaterThan(0);
      const ada = dump.find((r) => r[1] === 'Ada Obi');
      expect(ada?.[3]).toBe(3000);
      expect(ada?.[4]).toBe(3000);
      expect(ada?.[6]).toBe('Paid');
      expect(dump.some((r) => String(r[0]).startsWith('Showing:'))).toBe(true);
    });

    it('makes a real PDF, and one for a list nobody matches', async () => {
      const w = await campaignWorld();
      const doc = await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'paid' });
      expect(doc.rows).toHaveLength(0);
      expect((await exporter.toPdf(doc)).subarray(0, 5).toString()).toBe('%PDF-');
      const full = await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'all' });
      expect((await exporter.toPdf(full)).subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('guards a name that would run as a spreadsheet formula', async () => {
      const w = await campaignWorld();
      await w.assign('=HYPERLINK("x")', 'Bad');
      const doc = await collections.build(w.A, { screen: 'levy-campaign', id: w.campaign.id, status: 'all' });
      const ExcelJS = require('exceljs');
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(await exporter.toExcel(doc));
      let found = '';
      book.worksheets[0].eachRow((row: { values: unknown[] }) => {
        const v = String((row.values as unknown[])[2] ?? '');
        if (v.includes('HYPERLINK')) found = v;
      });
      expect(found.startsWith("'")).toBe(true);
    });
  });

  describe('donations and penalties', () => {
    it('lists pledges as not paid and gifts as paid, hides an anonymous donor, and filters', async () => {
      const w = await campaignWorld();
      const category = await prisma.financialCategory.create({ data: { associationId: w.A, name: 'AGM Donations', type: 'donation' } });
      const mk = async (first: string, amount: number, paid: number, anonymous = false) => {
        const member = await prisma.member.create({ data: { associationId: w.A, memberId: `DM${tag}${++n}`, firstName: first, lastName: 'Giver', status: 'active' } });
        const t = await prisma.transaction.create({ data: { associationId: w.A, memberId: member.id, categoryId: category.id, amount, status: 'pending', createdBy: w.officer.id } });
        await prisma.donationRecord.create({ data: { transactionId: t.id, receiptNumber: `DON-${tag}-${++n}`, isAnonymous: anonymous } });
        if (paid > 0) await pay(w, t.id, paid);
        return t;
      };
      await mk('Gift', 5000, 5000);
      await mk('Pledge', 8000, 0);
      await mk('Hidden', 2000, 0, true);
      const owing = await collections.build(w.A, { screen: 'donations', status: 'owing' });
      expect(names(owing).sort()).toEqual(['Anonymous', 'Pledge Giver']);
      expect(names(await collections.build(w.A, { screen: 'donations', status: 'paid' }))).toEqual(['Gift Giver']);
      expect(owing.rows.find((r) => r[1] === 'Anonymous')?.[0]).toBe('');
    });

    it('pages the donations list by status and by donor, and gives each row what Record payment needs', async () => {
      const w = await campaignWorld();
      const donations = require('../../src/modules/finance/advanced/donations.service').donationsService;
      const category = await prisma.financialCategory.create({ data: { associationId: w.A, name: 'Fund', type: 'donation' } });
      const mk = async (first: string, amount: number, paid: number, anonymous = false) => {
        const member = await prisma.member.create({ data: { associationId: w.A, memberId: `LM${tag}${++n}`, firstName: first, lastName: 'Donor', status: 'active' } });
        const t = await prisma.transaction.create({ data: { associationId: w.A, memberId: member.id, categoryId: category.id, amount, status: 'pending', createdBy: w.officer.id } });
        await prisma.donationRecord.create({ data: { transactionId: t.id, receiptNumber: `DON-${tag}-${++n}`, isAnonymous: anonymous } });
        if (paid > 0) await pay(w, t.id, paid);
        return { t, member };
      };
      const gift = await mk('Gift', 5000, 5000);
      const part = await mk('Part', 4000, 1000);
      const pledge = await mk('Pledge', 8000, 0);
      await mk('Secret', 2000, 0, true);
      const list = async (options: Record<string, unknown>) => (await donations.listDonations(w.A, options)).donations as Array<{ donor: { name: string }; balance: number; settlement: string; transactionId: number; memberDbId: number | null }>;
      expect((await list({ status: 'paid' })).map((d) => d.donor.name)).toEqual(['Gift Donor']);
      expect((await list({ status: 'part' })).map((d) => d.donor.name)).toEqual(['Part Donor']);
      expect((await list({ status: 'owing' })).map((d) => d.donor.name).sort()).toEqual(['Anonymous', 'Part Donor', 'Pledge Donor']);
      expect((await list({ search: 'pledge' })).map((d) => d.donor.name)).toEqual(['Pledge Donor']);
      expect((await list({ search: pledge.member.memberId })).map((d) => d.donor.name)).toEqual(['Pledge Donor']);
      expect(await list({ search: 'secret' })).toEqual([]);
      const row = (await list({ search: 'part' }))[0];
      expect(row).toMatchObject({ balance: 3000, settlement: 'part', transactionId: part.t.id, memberDbId: part.member.id });
      expect((await donations.listDonations(w.A, { status: 'owing', limit: 2 })).pagination.totalCount).toBe(3);
      expect(gift.t.id).toBeGreaterThan(0);
    });

    it('lists penalty charges and what is still owed', async () => {
      const w = await campaignWorld();
      const category = await prisma.financialCategory.create({ data: { associationId: w.A, name: 'Late Payment Fine', type: 'penalty' } });
      const member = await prisma.member.create({ data: { associationId: w.A, memberId: `PM${tag}${++n}`, firstName: 'Late', lastName: 'Payer', status: 'active' } });
      const fine = await prisma.transaction.create({ data: { associationId: w.A, memberId: member.id, categoryId: category.id, amount: 1500, status: 'pending', createdBy: w.officer.id } });
      expect(names(await collections.build(w.A, { screen: 'penalties', status: 'unpaid' }))).toEqual(['Late Payer']);
      await pay(w, fine.id, 1500);
      expect(await collections.build(w.A, { screen: 'penalties', status: 'unpaid' }).then((d) => d.rows)).toEqual([]);
      expect(names(await collections.build(w.A, { screen: 'penalties', status: 'paid' }))).toEqual(['Late Payer']);
    });
  });

  describe('member ledgers and open charges', () => {
    it('separates members who owe from members who are clear', async () => {
      const w = await campaignWorld();
      const row = async (memberId: number, balance: number) =>
        prisma.memberFinancialLedger.create({
          data: {
            associationId: w.A, memberId, entryType: 'DEBIT', category: 'LEVY', amount: Math.abs(balance), runningBalance: balance, effectiveDate: new Date(),
            description: 'test', sourceTable: 'transaction', sourceId: 1, createdBy: w.officer.id,
          },
        });
      await row(w.ada.member.id, 3000);
      await row(w.bola.member.id, 0);
      const owing = await collections.build(w.A, { screen: 'member-ledger', status: 'owing' });
      expect(names(owing)).toEqual(['Ada Obi']);
      const clear = await collections.build(w.A, { screen: 'member-ledger', status: 'paid' });
      expect(names(clear).sort()).toEqual(['Bola Eze', 'Chike Nnaji']);
    });

    it('lists a member’s open debts of every kind, with what is left on each', async () => {
      const w = await campaignWorld();
      const dues = await prisma.financialCategory.create({ data: { associationId: w.A, name: 'Annual Dues', type: 'due' } });
      const extra = await prisma.transaction.create({ data: { associationId: w.A, memberId: w.ada.member.id, categoryId: dues.id, amount: 5000, status: 'pending', createdBy: w.officer.id } });
      await pay(w, w.ada.charge.id, 1000);
      const result = await collections.openCharges(w.A, w.ada.member.id, w.treasurer.id);
      expect(result.canRecord).toBe(true);
      expect(result.charges.map((c) => [c.kind, c.label, c.balance]).sort()).toEqual([['charge', 'Annual Dues', 5000], ['levy', 'Mum Burial Levy', 2000]]);
      expect(result.totalOwed).toBe(7000);
      await pay(w, extra.id, 5000);
      expect((await collections.openCharges(w.A, w.ada.member.id, w.treasurer.id)).charges).toHaveLength(1);
    });

    it('says an officer may not record their own debt, until the setting allows it', async () => {
      const w = await campaignWorld();
      const mine = await w.assign('Olu', 'Officer', w.officer.id);
      const refused = await collections.openCharges(w.A, mine.member.id, w.officer.id);
      expect(refused.canRecord).toBe(false);
      expect(refused.reason).toContain('Another officer');
      await settingsService.updateSettings(w.A, 'financial', { allowOfficerSelfPayment: true }, w.officer.id);
      expect((await collections.openCharges(w.A, mine.member.id, w.officer.id)).canRecord).toBe(true);
    });
  });

  describe('what each charge is for', () => {
    it('names the campaign or the officer title under the category, and nothing when there is neither', async () => {
      const w = await campaignWorld();
      const dues = await prisma.financialCategory.create({ data: { associationId: w.A, name: 'Annual dues', type: 'due' } });
      const charge = (extra: { title?: string }) =>
        prisma.transaction.create({ data: { associationId: w.A, memberId: w.ada.member.id, categoryId: dues.id, amount: 5000, status: 'pending', createdBy: w.officer.id, ...extra } });
      const titled = await charge({ title: 'Annual dues 2026' });
      const plain = await charge({});

      const open = await collections.openCharges(w.A, w.ada.member.id, w.treasurer.id);
      const by = (id: number) => open.charges.find((c) => c.transactionId === id);
      expect(by(w.ada.charge.id)).toMatchObject({ category: 'Burial Levy', purpose: 'Mum Burial Levy' });
      expect(by(titled.id)).toMatchObject({ category: 'Annual dues', purpose: 'Annual dues 2026' });
      expect(by(plain.id)).toMatchObject({ category: 'Annual dues', purpose: null });
    });

    it('says which rule a penalty came from and which charge it was put on', async () => {
      const w = await campaignWorld();
      const fineCategory = await prisma.financialCategory.create({ data: { associationId: w.A, name: 'late payment fine', type: 'penalty' } });
      const rule = await prisma.penaltyRule.create({ data: { associationId: w.A, name: '5% late fee', feeType: 'percentage', feeAmount: 5 } });
      const fine = await prisma.transaction.create({ data: { associationId: w.A, memberId: w.ada.member.id, categoryId: fineCategory.id, amount: 150, status: 'pending', createdBy: w.officer.id } });
      await prisma.appliedPenalty.create({ data: { ruleId: rule.id, sourceTransactionId: w.ada.charge.id, penaltyTransactionId: fine.id, amount: 150 } });

      const open = await collections.openCharges(w.A, w.ada.member.id, w.treasurer.id);
      expect(open.charges.find((c) => c.transactionId === fine.id)).toMatchObject({ category: 'late payment fine', purpose: '5% late fee · on Mum Burial Levy' });
    });
  });
});
