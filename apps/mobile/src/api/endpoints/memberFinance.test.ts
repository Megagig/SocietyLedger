import MockAdapter from 'axios-mock-adapter';

// Same MMKV/storage mock `client.test.ts` establishes — `client.ts` transitively imports
// `stores/tenant.ts`, unavailable under Jest.
jest.mock('@/lib/storage', () => {
  const map = new Map<string, string>();
  return {
    storage: {
      getString: (key: string) => map.get(key),
      set: (key: string, value: string) => map.set(key, String(value)),
      remove: (key: string) => map.delete(key),
    },
  };
});
jest.mock('@/lib/secure', () => ({
  getTokenCache: () => ({ accessToken: null, refreshToken: null, accessTokenExpiresAt: null }),
  setTokens: async () => {},
  clearTokens: async () => {},
}));
jest.mock('sonner-native', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- must run after the jest.mock calls above
const { client } = require('@/api/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { memberFinanceApi } = require('./memberFinance');

describe('memberFinanceApi.getPayments', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(client);
  });

  afterEach(() => mock.restore());

  it('converts each payment amount to a Decimal', async () => {
    mock.onGet('/members/me/payments').reply(200, {
      success: true,
      data: {
        payments: [
          {
            id: 1,
            amount: 25000,
            paymentDate: '2026-01-01T00:00:00Z',
            paymentMethod: 'cash',
            reference: 'REC-1',
            transaction: { id: 1, referenceNumber: 'TXN-1', category: { id: 1, name: 'Dues', type: 'due' } },
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    });

    const payments = await memberFinanceApi.getPayments();

    expect(payments).toHaveLength(1);
    expect(payments[0].amount.toString()).toBe('25000');
    expect(typeof payments[0].amount.toFixed).toBe('function'); // it's a Decimal, not a plain number
  });
});
