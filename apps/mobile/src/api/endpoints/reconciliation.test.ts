const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({ client: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) } }));

import { reconciliationApi } from './reconciliation';

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });
const file = { uri: 'file:///cache/stmt.csv', name: 'stmt.csv', type: 'text/csv' };

beforeEach(() => jest.clearAllMocks());

describe('uploading a statement', () => {
  it('sends the file and the account as a form, and the column choices only when there are some', async () => {
    mockPost.mockReturnValue(ok({}));
    const append = jest.spyOn(FormData.prototype, 'append');
    await reconciliationApi.previewStatement({ bankAccountId: 4, file });
    expect(mockPost.mock.calls[0][0]).toBe('/payments/nigerian/import-statement/preview');
    expect(append).toHaveBeenCalledWith('bankAccountId', '4');
    expect(append).toHaveBeenCalledWith('file', { uri: file.uri, name: file.name, type: file.type });
    expect(append).not.toHaveBeenCalledWith('mapping', expect.anything());

    append.mockClear();
    await reconciliationApi.importStatement({ bankAccountId: 4, file, mapping: { date: 0, credit: 3 }, headerRow: 2 });
    expect(mockPost.mock.calls[1][0]).toBe('/payments/nigerian/import-statement');
    expect(append).toHaveBeenCalledWith('mapping', JSON.stringify({ date: 0, credit: 3 }));
    expect(append).toHaveBeenCalledWith('headerRow', '2');
    expect(mockPost.mock.calls[1][2].headers['Content-Type']).toBe('multipart/form-data');
    append.mockRestore();
  });
});

describe('matching', () => {
  it('asks for the suggestions and lists only money-in lines that are unmatched', async () => {
    mockGet.mockReturnValue(ok({}));
    await reconciliationApi.getSuggestions();
    await reconciliationApi.listUnmatchedLines({ page: 2, limit: 20 });
    expect(mockGet).toHaveBeenNthCalledWith(1, '/payments/nigerian/reconciliation/suggestions');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/payments/nigerian/statement-entries', { params: { page: 2, limit: 20, matchStatus: 'UNMATCHED', creditsOnly: true } });
  });

  it('proposes matches without ever sending an amount', async () => {
    mockPost.mockReturnValue(ok({ results: [] }));
    await reconciliationApi.applyMatches([{ transactionId: 8, statementEntryId: 21, matchType: 'AUTO_REFERENCE', confidence: 100 }]);
    await reconciliationApi.proposeMatch({ transactionId: 8, statementEntryId: 21, matchType: 'AUTO_AMOUNT' });
    expect(mockPost).toHaveBeenNthCalledWith(1, '/payments/nigerian/auto-match/apply', { matches: [{ transactionId: 8, statementEntryId: 21, matchType: 'AUTO_REFERENCE', confidence: 100 }] });
    expect(mockPost.mock.calls[1][1]).toEqual({ transactionId: 8, statementEntryId: 21, matchType: 'MANUAL' });
    expect(JSON.stringify(mockPost.mock.calls)).not.toMatch(/matchedAmount/);
  });

  it('confirms or turns a match down on its own route, with the reason', async () => {
    mockPost.mockReturnValue(ok({ id: 3, status: 'CONFIRMED' }));
    mockGet.mockReturnValue(ok({ reconciliations: [] }));
    await reconciliationApi.decideMatch(3, 'CONFIRMED');
    await reconciliationApi.decideMatch(3, 'DISPUTED', 'wrong member');
    await reconciliationApi.listMatches({ status: 'PENDING', page: 1, limit: 20 });
    expect(mockPost).toHaveBeenNthCalledWith(1, '/payments/nigerian/reconciliations/3/confirm', { status: 'CONFIRMED', notes: undefined });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/payments/nigerian/reconciliations/3/confirm', { status: 'DISPUTED', notes: 'wrong member' });
    expect(mockGet).toHaveBeenCalledWith('/payments/nigerian/reconciliations', { params: { status: 'PENDING', page: 1, limit: 20 } });
  });
});
