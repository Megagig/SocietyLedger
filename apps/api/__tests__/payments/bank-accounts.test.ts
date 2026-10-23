/**
 * The association's bank accounts are what every member is told to pay into, so they must stay sound: the first active account is the
 * default, one default at all times, the last active account can't be removed, a used account is deactivated (not deleted), and an
 * account number can't clash. Runs against a small in-memory fake of the accounts table (a few other tables are stubbed).
 */
type Account = {
  id: number;
  associationId: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankCode: string | null;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
};

const state: { accounts: Account[]; nextId: number; transfers: Record<number, number>; imports: Record<number, number> } = {
  accounts: [],
  nextId: 1,
  transfers: {},
  imports: {},
};

type Where = Partial<Record<keyof Account, unknown>> & { id?: number | { not: number } };
const matches = (account: Account, where: Where = {}) =>
  Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && 'not' in (value as object)) return account[key as keyof Account] !== (value as { not: unknown }).not;
    return account[key as keyof Account] === value;
  });

const fakeAccounts = {
  findFirst: jest.fn(async ({ where, orderBy }: { where?: Where; orderBy?: { createdAt: 'asc' } } = {}) => {
    const found = state.accounts.filter((a) => matches(a, where));
    if (orderBy?.createdAt === 'asc') found.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    // A copy, like a real query result — callers must not see later writes through the row they already read.
    return found[0] ? { ...found[0] } : null;
  }),
  count: jest.fn(async ({ where }: { where?: Where } = {}) => state.accounts.filter((a) => matches(a, where)).length),
  create: jest.fn(async ({ data }: { data: Partial<Account> }) => {
    const account = { id: state.nextId++, bankCode: null, description: null, isActive: true, isDefault: false, createdAt: new Date(state.nextId * 1000), ...data } as Account;
    state.accounts.push(account);
    return account;
  }),
  update: jest.fn(async ({ where, data }: { where: { id: number }; data: Partial<Account> }) => {
    const account = state.accounts.find((a) => a.id === where.id)!;
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) (account as Record<string, unknown>)[key] = value;
    });
    return account;
  }),
  updateMany: jest.fn(async ({ where, data }: { where: Where; data: Partial<Account> }) => {
    const hit = state.accounts.filter((a) => matches(a, where));
    hit.forEach((a) => Object.assign(a, data));
    return { count: hit.length };
  }),
  delete: jest.fn(async ({ where }: { where: { id: number } }) => {
    state.accounts = state.accounts.filter((a) => a.id !== where.id);
  }),
};

jest.mock('../../src/lib/prisma', () => ({
  prisma: {
    associationBankAccount: fakeAccounts,
    bankTransfer: { count: jest.fn(async ({ where }: { where: { bankAccountId: number } }) => state.transfers[where.bankAccountId] ?? 0) },
    bankStatementImport: { count: jest.fn(async ({ where }: { where: { bankAccountId: number } }) => state.imports[where.bankAccountId] ?? 0) },
  },
}));
jest.mock('../../src/services/accounting-integration.service', () => ({ accountingIntegrationService: {} }));
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({ memberLedgerService: {} }));

import { BankRuleError } from '../../src/modules/nigerian-payments/bank-rules';
import { nigerianPaymentsService as service } from '../../src/modules/nigerian-payments/nigerian-payments.service';

const input = (n: number, extra: Record<string, unknown> = {}) => ({
  bankName: 'GTBank',
  accountName: 'Opuogun State Union',
  accountNumber: String(1000000000 + n),
  ...extra,
});

const codeOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BankRuleError);
  return (error as BankRuleError).code;
};

const defaults = () => state.accounts.filter((a) => a.isActive && a.isDefault).map((a) => a.id);

beforeEach(() => {
  state.accounts = [];
  state.nextId = 1;
  state.transfers = {};
  state.imports = {};
});

describe('creating accounts', () => {
  it('makes the first account the default even when not asked to', async () => {
    const first = await service.createBankAccount(1, input(1));
    expect(first.isDefault).toBe(true);
  });

  it('keeps a single default when a new account is made the default', async () => {
    const first = await service.createBankAccount(1, input(1));
    const second = await service.createBankAccount(1, input(2, { isDefault: true }));

    expect(defaults()).toEqual([second.id]);
    expect(state.accounts.find((a) => a.id === first.id)!.isDefault).toBe(false);
  });

  it('leaves the default alone for a plain additional account', async () => {
    const first = await service.createBankAccount(1, input(1));
    await service.createBankAccount(1, input(2));
    expect(defaults()).toEqual([first.id]);
  });
});

describe('editing accounts', () => {
  it('refuses an account number another account already uses', async () => {
    await service.createBankAccount(1, input(1));
    const second = await service.createBankAccount(1, input(2));

    expect(await codeOf(service.updateBankAccount(second.id, 1, { accountNumber: input(1).accountNumber }))).toBe('DUPLICATE_ACCOUNT');
  });

  it('lets an account keep its own number', async () => {
    const first = await service.createBankAccount(1, input(1));
    const { account } = await service.updateBankAccount(first.id, 1, { accountNumber: first.accountNumber, accountName: 'New name' });
    expect(account.accountName).toBe('New name');
  });

  it('moves the default to the account that is made the default', async () => {
    const first = await service.createBankAccount(1, input(1));
    const second = await service.createBankAccount(1, input(2));

    await service.updateBankAccount(second.id, 1, { isDefault: true });

    expect(defaults()).toEqual([second.id]);
    expect(state.accounts.find((a) => a.id === first.id)!.isDefault).toBe(false);
  });

  it("won't un-set the default directly — it only moves", async () => {
    const first = await service.createBankAccount(1, input(1));
    await service.createBankAccount(1, input(2));

    await service.updateBankAccount(first.id, 1, { isDefault: false });

    expect(defaults()).toEqual([first.id]);
  });

  it('refuses to deactivate the last active account', async () => {
    const only = await service.createBankAccount(1, input(1));
    expect(await codeOf(service.updateBankAccount(only.id, 1, { isActive: false }))).toBe('LAST_ACCOUNT');
  });

  it('promotes the oldest other active account when the default is deactivated', async () => {
    const first = await service.createBankAccount(1, input(1));
    const second = await service.createBankAccount(1, input(2));
    await service.createBankAccount(1, input(3));

    const { newDefaultId } = await service.updateBankAccount(first.id, 1, { isActive: false });

    expect(newDefaultId).toBe(second.id);
    expect(defaults()).toEqual([second.id]);
    expect(state.accounts.find((a) => a.id === first.id)).toMatchObject({ isActive: false, isDefault: false });
  });

  it("won't make an inactive account the default", async () => {
    const first = await service.createBankAccount(1, input(1));
    const second = await service.createBankAccount(1, input(2));
    await service.updateBankAccount(second.id, 1, { isActive: false });

    expect(await codeOf(service.updateBankAccount(second.id, 1, { isDefault: true }))).toBe('INACTIVE_DEFAULT');
    expect(defaults()).toEqual([first.id]);
  });

  it("404s an account of another association", async () => {
    const other = await service.createBankAccount(2, input(9));
    expect(await codeOf(service.updateBankAccount(other.id, 1, { accountName: 'Hijack' }))).toBe('NOT_FOUND');
  });
});

describe('removing accounts', () => {
  it('refuses to remove the last active account', async () => {
    const only = await service.createBankAccount(1, input(1));
    expect(await codeOf(service.deleteBankAccount(only.id, 1))).toBe('LAST_ACCOUNT');
    expect(state.accounts).toHaveLength(1);
  });

  it('deletes an account that was never used', async () => {
    await service.createBankAccount(1, input(1));
    const spare = await service.createBankAccount(1, input(2));

    const { outcome } = await service.deleteBankAccount(spare.id, 1);

    expect(outcome).toBe('deleted');
    expect(state.accounts).toHaveLength(1);
  });

  it.each([
    ['transfers', 'transfers'],
    ['statement imports', 'imports'],
  ] as const)('deactivates, never deletes, an account that has %s', async (_label, kind) => {
    await service.createBankAccount(1, input(1));
    const used = await service.createBankAccount(1, input(2));
    state[kind][used.id] = 3;

    const { outcome } = await service.deleteBankAccount(used.id, 1);

    expect(outcome).toBe('deactivated');
    expect(state.accounts.find((a) => a.id === used.id)).toMatchObject({ isActive: false, isDefault: false });
  });

  it('promotes another account when the default is removed', async () => {
    const first = await service.createBankAccount(1, input(1));
    const second = await service.createBankAccount(1, input(2));

    const { newDefaultId } = await service.deleteBankAccount(first.id, 1);

    expect(newDefaultId).toBe(second.id);
    expect(defaults()).toEqual([second.id]);
  });

  it('lets an already-inactive account be removed without the last-active rule', async () => {
    const first = await service.createBankAccount(1, input(1));
    const old = await service.createBankAccount(1, input(2));
    await service.updateBankAccount(old.id, 1, { isActive: false });
    await service.updateBankAccount(first.id, 1, { accountName: 'Only active' });

    const { outcome } = await service.deleteBankAccount(old.id, 1);

    expect(outcome).toBe('deleted');
  });
});
