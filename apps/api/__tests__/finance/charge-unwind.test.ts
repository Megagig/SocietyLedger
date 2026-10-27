/**
 * Deleting a charge (or voiding a cash donation) takes it back out of the books and off the member's ledger. It used to leave both counting
 * money that no longer existed.
 */
const reverseEntriesForSources = jest.fn();
jest.mock('../../src/services/accounting-integration.service', () => ({
  accountingIntegrationService: { reverseEntriesForSources: (...a: any[]) => reverseEntriesForSources(...a) },
}));
const reconcileMemberLedger = jest.fn();
jest.mock('../../src/modules/member-finance/member-ledger.service', () => ({
  memberLedgerService: { reconcileMemberLedger: (...a: any[]) => reconcileMemberLedger(...a) },
}));

import { unwindDeletedCharges } from '../../src/modules/finance/charge-unwind';

const input = { associationId: 1, userId: 5, memberIds: [7, 7, 9], transactionIds: [70, 71], paymentIds: [80], reason: 'deleted', reference: 'TXN-1' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('unwindDeletedCharges', () => {
  it('reverses the books for the deleted charges and payments, and cleans each affected member ledger once', async () => {
    await unwindDeletedCharges(input);
    expect(reverseEntriesForSources).toHaveBeenCalledWith(1, 5, { transactionIds: [70, 71], paymentIds: [80] }, 'deleted', 'TXN-1');
    expect(reconcileMemberLedger).toHaveBeenCalledTimes(2);
    expect(reconcileMemberLedger).toHaveBeenCalledWith(1, 7, 5);
    expect(reconcileMemberLedger).toHaveBeenCalledWith(1, 9, 5);
  });

  it('cleans the ledgers even when the books cannot be reversed (for example a closed period), and never throws', async () => {
    reverseEntriesForSources.mockRejectedValue(new Error('period closed'));
    await expect(unwindDeletedCharges(input)).resolves.toBeUndefined();
    expect(reconcileMemberLedger).toHaveBeenCalledTimes(2);
  });

  it('keeps going to the next member when one ledger fails', async () => {
    reconcileMemberLedger.mockRejectedValueOnce(new Error('lock timeout'));
    await expect(unwindDeletedCharges(input)).resolves.toBeUndefined();
    expect(reconcileMemberLedger).toHaveBeenCalledTimes(2);
  });
});
