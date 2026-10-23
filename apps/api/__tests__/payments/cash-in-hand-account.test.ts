/**
 * Cash an officer collects is held as "Cash in hand" until lodged. Everything else must keep debiting the bank account exactly as
 * before — these prove the switch only happens inside a cash collection.
 */
const accounts: Record<string, { id: number; code: string }> = {
  '1110': { id: 10, code: '1110' },
  '1112': { id: 12, code: '1112' },
};
const created: any[] = [];

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    chartOfAccount: {
      findFirst: jest.fn(async ({ where }: any) => accounts[where.code] ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: 14, ...data };
        accounts[data.code] = row;
        created.push(row);
        return row;
      }),
    },
  },
}));
jest.mock('../../src/modules/accounting/accounting.service', () => ({ accountingService: {} }));

import { accountingIntegrationService, runAsCashCollection } from '../../src/services/accounting-integration.service';

describe('findInflowAccount', () => {
  beforeEach(() => {
    delete accounts['1114'];
    created.length = 0;
  });

  it('uses the operating bank account outside a cash collection', async () => {
    const acc = await accountingIntegrationService.findInflowAccount(1);
    expect(acc?.code).toBe('1112');
    expect(created).toHaveLength(0);
  });

  it('uses Cash in hand inside a cash collection, creating it once under Cash and Cash Equivalents', async () => {
    const acc = await runAsCashCollection(() => accountingIntegrationService.findInflowAccount(1));
    expect(acc?.code).toBe('1114');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ associationId: 1, parentId: 10, type: 'ASSET', normalBalance: 'DEBIT' });

    await runAsCashCollection(() => accountingIntegrationService.findInflowAccount(1));
    expect(created).toHaveLength(1);
  });

  it('does not leak the cash context to code that runs afterwards', async () => {
    await runAsCashCollection(() => accountingIntegrationService.findInflowAccount(1));
    const acc = await accountingIntegrationService.findInflowAccount(1);
    expect(acc?.code).toBe('1112');
  });
});
