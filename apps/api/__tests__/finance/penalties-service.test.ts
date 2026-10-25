/**
 * Waiving lowers what the member owes and credits their ledger; late fees skip what is not a real overdue debt, can be previewed
 * without changing anything, and are not charged twice.
 */
import { Decimal } from '@prisma/client/runtime/library';

const txClient: any = {
  transaction: { updateMany: jest.fn() },
  penaltyWaiver: { create: jest.fn() },
};
const prismaMock: any = {
  transaction: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
  penaltyRule: { findMany: jest.fn(), create: jest.fn() },
  appliedPenalty: { create: jest.fn() },
  financialCategory: { findFirst: jest.fn(), create: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(async (fn: any) => fn(txClient)),
};
jest.mock('../../src/lib/prisma', () => ({ prisma: prismaMock }));
const createFromWaiver = jest.fn();
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({
  memberLedgerService: { createFromWaiver: (...a: any[]) => createFromWaiver(...a), createFromTransaction: jest.fn() },
}));
const onTransactionChange = jest.fn();
jest.mock('../../src/services/cache-invalidation.service', () => ({ cacheInvalidationService: { onTransactionChange: (...a: any[]) => onTransactionChange(...a) } }));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: { onTransactionCreated: jest.fn() } }));
jest.mock('../../src/modules/finance/ledger-sync', () => ({ syncLedgerDebit: jest.fn() }));
jest.mock('../../src/modules/settings/settings.service', () => ({ SettingsService: { getSettings: jest.fn(async () => ({ enableLateFees: false })) } }));

import { penaltiesService } from '../../src/modules/finance/advanced/penalties.service';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: any) => fn(txClient));
});

describe('waivePenalty', () => {
  const penalty = (over: object = {}) => ({
    id: 40, amount: new Decimal(5000), status: 'pending', isVoided: false,
    category: { type: 'penalty' }, payments: [], ...over,
  });

  beforeEach(() => {
    txClient.transaction.updateMany.mockResolvedValue({ count: 1 });
    txClient.penaltyWaiver.create.mockResolvedValue({ id: 7, waivedAmount: 2000 });
  });

  it('a partial waiver lowers the penalty amount, keeps it open, credits the ledger and keeps the reason', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue(penalty());
    const result = await penaltiesService.waivePenalty(40, 1, 99, { waivedAmount: 2000, reason: 'First offence' });
    const update = txClient.transaction.updateMany.mock.calls[0][0];
    expect(Number(update.data.amount)).toBe(3000);
    expect(update.data.status).toBeUndefined();
    expect(txClient.penaltyWaiver.create.mock.calls[0][0].data).toMatchObject({ transactionId: 40, waivedAmount: 2000, reason: 'First offence', waivedBy: 99 });
    expect(createFromWaiver).toHaveBeenCalledWith(7, 99);
    expect(onTransactionChange).toHaveBeenCalledWith(1);
    expect(result).toMatchObject({ newAmount: 3000, fullyWaived: false });
  });

  it('waiving everything that is owed marks the penalty Waived', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue(penalty({ payments: [{ amountPaid: new Decimal(1000) }] }));
    const result = await penaltiesService.waivePenalty(40, 1, 99, { waivedAmount: 4000, reason: 'Hardship case' });
    const update = txClient.transaction.updateMany.mock.calls[0][0];
    expect(update.data.status).toBe('waived');
    expect(Number(update.data.amount)).toBe(1000);
    expect(result.fullyWaived).toBe(true);
  });

  it('refuses more than is owed, a voided penalty, a waived one, and a charge that is not a penalty', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue(penalty());
    await expect(penaltiesService.waivePenalty(40, 1, 99, { waivedAmount: 6000, reason: 'Too much' })).rejects.toMatchObject({ status: 400, code: 'WAIVER_TOO_LARGE' });
    prismaMock.transaction.findFirst.mockResolvedValue(penalty({ isVoided: true }));
    await expect(penaltiesService.waivePenalty(40, 1, 99, { waivedAmount: 100, reason: 'Voided one' })).rejects.toMatchObject({ code: 'PENALTY_VOIDED' });
    prismaMock.transaction.findFirst.mockResolvedValue(penalty({ status: 'waived' }));
    await expect(penaltiesService.waivePenalty(40, 1, 99, { waivedAmount: 100, reason: 'Again' })).rejects.toMatchObject({ code: 'ALREADY_WAIVED' });
    prismaMock.transaction.findFirst.mockResolvedValue(penalty({ category: { type: 'due' } }));
    await expect(penaltiesService.waivePenalty(40, 1, 99, { waivedAmount: 100, reason: 'A due' })).rejects.toMatchObject({ code: 'NOT_A_PENALTY' });
    expect(txClient.penaltyWaiver.create).not.toHaveBeenCalled();
    expect(createFromWaiver).not.toHaveBeenCalled();
  });

  it('two officers waiving at once cannot both succeed: the second finds the charge already changed', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue(penalty());
    txClient.transaction.updateMany.mockResolvedValue({ count: 0 });
    await expect(penaltiesService.waivePenalty(40, 1, 99, { waivedAmount: 2000, reason: 'Race lost' })).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(txClient.penaltyWaiver.create).not.toHaveBeenCalled();
  });

  it('cannot reach another association\'s penalty', async () => {
    prismaMock.transaction.findFirst.mockResolvedValue(null);
    await expect(penaltiesService.waivePenalty(40, 2, 99, { waivedAmount: 100, reason: 'Not yours' })).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.transaction.findFirst.mock.calls[0][0].where).toEqual({ id: 40, associationId: 2 });
  });
});

describe('late fees', () => {
  const generalRule = { id: 5, name: 'Late', categoryId: null, gracePeriodDays: 7, feeType: 'fixed', feeAmount: new Decimal(500), maxFeeAmount: null, isCompounding: false, compoundingDays: null };
  const overdue = (over: object = {}) => ({
    id: 11, memberId: 3, categoryId: 10, status: 'pending', isVoided: false, dueDate: daysAgo(30), amount: new Decimal(5000), referenceNumber: 'T1',
    category: { name: 'Annual dues', type: 'due' }, member: { id: 3, memberId: 'M3', firstName: 'Ada', lastName: 'Obi' },
    payments: [], sourcePenalties: [], ...over,
  });

  beforeEach(() => {
    prismaMock.penaltyRule.findMany.mockResolvedValue([generalRule]);
    prismaMock.transaction.count.mockResolvedValue(0);
    prismaMock.financialCategory.findFirst.mockResolvedValue({ id: 99 });
    prismaMock.transaction.create.mockImplementation(async ({ data }: any) => ({ id: 500, ...data }));
    prismaMock.transaction.findUnique.mockResolvedValue(null);
  });

  it('only asks for charges that are not voided', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([]);
    await penaltiesService.previewLateFees(1, 9);
    expect(prismaMock.transaction.findMany.mock.calls[0][0].where).toMatchObject({ associationId: 1, isVoided: false });
  });

  it('a preview says who and how much, and changes nothing', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([overdue(), overdue({ id: 12, memberId: 4, member: { id: 4, memberId: 'M4', firstName: 'Bola', lastName: 'Eze' } })]);
    const preview = await penaltiesService.previewLateFees(1, 9);
    expect(preview).toMatchObject({ count: 2, memberCount: 2, totalAmount: 1000, truncated: false });
    expect(preview.items[0]).toMatchObject({ memberName: 'Ada Obi', chargeName: 'Annual dues', penaltyAmount: 500 });
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
    expect(prismaMock.appliedPenalty.create).not.toHaveBeenCalled();
    expect(prismaMock.penaltyRule.create).not.toHaveBeenCalled();
  });

  it('a donation pledge or a penalty never earns a late fee under a general rule', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      overdue({ id: 20, category: { name: 'Building fund pledge', type: 'donation' }, categoryId: 12 }),
      overdue({ id: 21, category: { name: 'Late Payment Fee', type: 'penalty' }, categoryId: 13 }),
      overdue({ id: 22, category: { name: 'Levy', type: 'levy' }, categoryId: 14 }),
    ]);
    const preview = await penaltiesService.previewLateFees(1, 9);
    expect(preview.items.map((i) => i.transactionId)).toEqual([22]);
  });

  it('applying charges each one once, with the ledger and a cache refresh', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([overdue()]);
    const result = await penaltiesService.applyLateFees(1, 9);
    expect(result).toMatchObject({ applied: 1, totalAmount: 500 });
    expect(Number(prismaMock.transaction.create.mock.calls[0][0].data.amount)).toBe(500);
    expect(prismaMock.appliedPenalty.create).toHaveBeenCalledTimes(1);
    expect(onTransactionChange).toHaveBeenCalledWith(1);
  });

  it('pressing it again charges nothing, because the fee was already applied', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([overdue({ sourcePenalties: [{ ruleId: 5, appliedAt: daysAgo(1) }] })]);
    const result = await penaltiesService.applyLateFees(1, 9);
    expect(result.applied).toBe(0);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });
});

describe('rule fees', () => {
  it('refuses a percentage above 100 when a rule is created', async () => {
    await expect(
      penaltiesService.createRule(1, 9, { name: 'Big', triggerType: 'late_payment', gracePeriodDays: 0, feeType: 'percentage', feeAmount: 150 }),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_FEE' });
  });
});
