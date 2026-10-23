const createFromTransaction = jest.fn();
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({ memberLedgerService: { createFromTransaction } }));

import { syncLedgerDebit } from '../../src/modules/finance/ledger-sync';

beforeEach(() => jest.clearAllMocks());

describe('syncLedgerDebit', () => {
  it('puts the new charge on the member ledger', async () => {
    createFromTransaction.mockResolvedValue({ id: 1 });
    await syncLedgerDebit(42, 7);
    expect(createFromTransaction).toHaveBeenCalledWith(42, 7);
  });

  it('never blocks creating the charge when the ledger fails', async () => {
    createFromTransaction.mockRejectedValue(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(syncLedgerDebit(42, 7)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
