/**
 * The accounting controller as the app meets it: what the request is checked against before the service sees it, how a failure is
 * answered, and that posting asks for the officer's password.
 */
const serviceMock: any = {
  postJournalEntry: jest.fn(),
  createAccount: jest.fn(),
  updateAccount: jest.fn(),
};
jest.mock('../../src/modules/accounting/accounting.service', () => ({ accountingService: serviceMock }));
const mockConfirm = jest.fn();
jest.mock('../../src/lib/reauth', () => ({
  confirmPassword: (...a: unknown[]) => mockConfirm(...a),
  reauthFailure: jest.requireActual('../../src/lib/reauth').reauthFailure,
}));

import { accountingController } from '../../src/modules/accounting/accounting.controller';
import { createAccountSchema, updateAccountSchema } from '../../src/modules/accounting/accounting.validation';
import { respondWithError } from '../../src/modules/accounting/accounting-http';
import { AccountingRuleError } from '../../src/modules/accounting/accounting-rules';

const res = () => {
  const r: any = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  return r;
};
const req = (over: object = {}): any => ({ user: { id: 9, associationId: 7 }, params: { id: '50' }, body: {}, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('creating an account', () => {
  it('leaves the normal balance to the service when none is chosen, so an Income account is a credit account', () => {
    const parsed = createAccountSchema.parse({ code: '4950', name: 'Hall hire income', type: 'INCOME' });
    expect(parsed.normalBalance).toBeUndefined();
  });

  it('keeps a normal balance that was chosen on purpose', () => {
    expect(createAccountSchema.parse({ code: '1240', name: 'Accumulated depreciation', type: 'ASSET', normalBalance: 'CREDIT' }).normalBalance).toBe('CREDIT');
  });

  it('passes what it parsed, and who is asking, to the service', async () => {
    serviceMock.createAccount.mockResolvedValue({ id: 1 });
    const r = res();
    await accountingController.createAccount(req({ body: { code: '4950', name: 'Hall hire income', type: 'INCOME' } }), r);
    expect(serviceMock.createAccount).toHaveBeenCalledWith(7, expect.not.objectContaining({ normalBalance: expect.anything() }), 9);
    expect(r.status).toHaveBeenCalledWith(201);
  });
});

describe('changing an account', () => {
  it('lets null take an account out from under its parent', () => {
    expect(updateAccountSchema.parse({ parentId: null }).parentId).toBeNull();
    expect(updateAccountSchema.parse({ parentId: 4 }).parentId).toBe(4);
    expect(updateAccountSchema.parse({}).parentId).toBeUndefined();
  });
});

describe('posting an entry', () => {
  it('asks for the password first', async () => {
    const r = res();
    await accountingController.postJournalEntry(req({ body: {} }), r);
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0]).toMatchObject({ code: 'REAUTH_REQUIRED' });
    expect(serviceMock.postJournalEntry).not.toHaveBeenCalled();
  });

  it('refuses a wrong password with 403 and posts nothing', async () => {
    mockConfirm.mockResolvedValue({ ok: false, reason: 'wrong' });
    const r = res();
    await accountingController.postJournalEntry(req({ body: { password: 'nope' } }), r);
    expect(r.status).toHaveBeenCalledWith(403);
    expect(r.json.mock.calls[0][0]).toMatchObject({ code: 'REAUTH_FAILED' });
    expect(serviceMock.postJournalEntry).not.toHaveBeenCalled();
  });

  it('answers 429 once too many wrong passwords have been tried', async () => {
    mockConfirm.mockResolvedValue({ ok: false, reason: 'locked', retryAfterSeconds: 600 });
    const r = res();
    await accountingController.postJournalEntry(req({ body: { password: 'anything' } }), r);
    expect(r.status).toHaveBeenCalledWith(429);
    expect(r.json.mock.calls[0][0]).toMatchObject({ code: 'REAUTH_LOCKED' });
    expect(r.json.mock.calls[0][0].message).toContain('10 minutes');
  });

  it('posts for the person who confirmed, with the entry and association', async () => {
    mockConfirm.mockResolvedValue({ ok: true });
    serviceMock.postJournalEntry.mockResolvedValue({ id: 50 });
    const r = res();
    await accountingController.postJournalEntry(req({ body: { password: 'right' } }), r);
    expect(mockConfirm).toHaveBeenCalledWith(9, 'right');
    expect(serviceMock.postJournalEntry).toHaveBeenCalledWith(7, 50, 9);
    expect(r.status).toHaveBeenCalledWith(200);
  });

  it('answers a rule the entry broke with its own status and plain message', async () => {
    mockConfirm.mockResolvedValue({ ok: true });
    serviceMock.postJournalEntry.mockRejectedValue(new AccountingRuleError('The period "October" is closed.', 409, 'PERIOD_CLOSED'));
    const r = res();
    await accountingController.postJournalEntry(req({ body: { password: 'right' } }), r);
    expect(r.status).toHaveBeenCalledWith(409);
    expect(r.json.mock.calls[0][0]).toEqual({ success: false, code: 'PERIOD_CLOSED', message: 'The period "October" is closed.' });
  });
});

describe('answering a failure', () => {
  it('never sends an unexpected failure\'s own words to the person', () => {
    const r = res();
    respondWithError(r, new Error('Invalid `prisma.journalEntry.update()` invocation: connection refused at 10.0.0.4'));
    expect(r.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(r.json.mock.calls[0][0])).not.toContain('prisma');
    expect(r.json.mock.calls[0][0].message).toBe('Something went wrong. Try again.');
  });

  it('keeps a rule failure\'s status and code', () => {
    const r = res();
    respondWithError(r, new AccountingRuleError('Debits must equal credits.', 400, 'UNBALANCED'));
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.json.mock.calls[0][0].code).toBe('UNBALANCED');
  });
});
