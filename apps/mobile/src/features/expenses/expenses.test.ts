import { expensesApi } from '@/api/endpoints/expenses';
import type { BudgetPositionDTO, ExpenseDetailDTO } from '@/types/api/expenses';
import { budgetSentence, EXPENSE_FILTER_OPTIONS, expenseStatusKey, receiptHelper, receiptRule } from './labels';
import { emptyExpenseValues, expenseFormSchema, expenseToFormValues, toExpensePayload } from './schemas';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/client', () => ({
  client: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    put: (...a: unknown[]) => mockPut(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));
const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

beforeEach(() => jest.clearAllMocks());

const valid = { ...emptyExpenseValues('2026-10-20T10:00:00.000Z'), payee: 'Ade Hall', description: 'Hall hire', amount: '50,000', categoryAccountId: '5', paidFromAccountId: '2' };

describe('expensesApi', () => {
  it('reads the options, the list and one voucher', async () => {
    mockGet.mockReturnValue(ok({}));
    await expensesApi.getOptions();
    await expensesApi.list({ page: 2, limit: 20, status: 'APPROVED' });
    await expensesApi.get(7);
    expect(mockGet).toHaveBeenNthCalledWith(1, '/expenses/options');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/expenses', { params: { page: 2, limit: 20, status: 'APPROVED' } });
    expect(mockGet).toHaveBeenNthCalledWith(3, '/expenses/7');
  });

  it('asks where a category stands against its budget', async () => {
    mockGet.mockReturnValue(ok(null));
    await expensesApi.checkBudget({ categoryAccountId: 5, amount: 50000, date: '2026-10-20' });
    expect(mockGet).toHaveBeenCalledWith('/expenses/budget-check', { params: { categoryAccountId: 5, amount: 50000, date: '2026-10-20' } });
  });

  it('records, changes and deletes a voucher', async () => {
    mockPost.mockReturnValue(ok({}));
    mockPut.mockReturnValue(ok({}));
    mockDelete.mockReturnValue(ok({ removed: true }));
    const payload = toExpensePayload(valid);
    await expensesApi.create(payload);
    await expensesApi.update(7, payload);
    await expensesApi.remove(7);
    expect(mockPost).toHaveBeenCalledWith('/expenses', payload);
    expect(mockPut).toHaveBeenCalledWith('/expenses/7', payload);
    expect(mockDelete).toHaveBeenCalledWith('/expenses/7');
  });

  it('attaches the receipt as a multipart file called receipt', async () => {
    mockPost.mockReturnValue(ok({}));
    await expensesApi.uploadReceipt(7, { uri: 'file:///r.jpg', name: 'r.jpg', type: 'image/jpeg' });
    const [url, form, config] = mockPost.mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
    expect(url).toBe('/expenses/7/receipt');
    expect(form.has?.('receipt') ?? true).toBe(true);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('sends the password with an approval and with a void, and the reason with a rejection', async () => {
    mockPost.mockReturnValue(ok({}));
    await expensesApi.approve(7, 'secret');
    await expensesApi.reject(7, 'Wrong receipt');
    await expensesApi.voidVoucher(7, { reason: 'Paid twice', password: 'secret' });
    await expensesApi.submit(7);
    await expensesApi.withdraw(7);
    expect(mockPost).toHaveBeenNthCalledWith(1, '/expenses/7/approve', { password: 'secret' });
    expect(mockPost).toHaveBeenNthCalledWith(2, '/expenses/7/reject', { reason: 'Wrong receipt' });
    expect(mockPost).toHaveBeenNthCalledWith(3, '/expenses/7/void', { reason: 'Paid twice', password: 'secret' });
    expect(mockPost).toHaveBeenNthCalledWith(4, '/expenses/7/submit');
    expect(mockPost).toHaveBeenNthCalledWith(5, '/expenses/7/withdraw');
  });
});

describe('the voucher form', () => {
  it('accepts a complete voucher', () => {
    expect(expenseFormSchema.safeParse(valid).success).toBe(true);
  });

  it('says plainly what is missing', () => {
    const message = (over: object) => expenseFormSchema.safeParse({ ...valid, ...over }).error?.issues[0]?.message;
    expect(message({ payee: '' })).toBe('Enter who was paid');
    expect(message({ description: 'a' })).toBe('Say what it was for');
    expect(message({ amount: '' })).toBe('Enter the amount');
    expect(message({ amount: '12.345' })).toBe('Use naira and kobo, like 2500 or 2500.50');
    expect(message({ amount: '0' })).toBe('The amount must be more than zero');
    expect(message({ categoryAccountId: '' })).toBe('Choose a category');
    expect(message({ paidFromAccountId: '' })).toBe('Choose the account it was paid from');
  });

  it('sends the amount as a number, the day as a plain day, and blanks as nothing', () => {
    expect(toExpensePayload({ ...valid, expenseDate: '2026-10-20T10:00:00.000Z' })).toEqual({
      payee: 'Ade Hall',
      description: 'Hall hire',
      amount: 50000,
      expenseDate: '2026-10-20',
      categoryAccountId: 5,
      paidFromAccountId: 2,
      reference: null,
      noReceiptReason: null,
    });
    expect(toExpensePayload({ ...valid, reference: ' INV-9 ', noReceiptReason: 'Bus fare, no receipt' })).toMatchObject({ reference: 'INV-9', noReceiptReason: 'Bus fare, no receipt' });
  });

  it('starts from a saved voucher, ready to change', () => {
    const saved = {
      payee: 'Ade Hall', description: 'Hall hire', amount: '1250.50', expenseDate: '2026-10-20T12:00:00.000Z', category: { id: 5, code: '5100', name: 'Hall hire' },
      paidFrom: { id: 2, code: '1112', name: 'Bank' }, reference: null, noReceiptReason: 'no receipt',
    } as unknown as ExpenseDetailDTO;
    expect(expenseToFormValues(saved)).toMatchObject({ payee: 'Ade Hall', amount: '1250.5', categoryAccountId: '5', paidFromAccountId: '2', reference: '', noReceiptReason: 'no receipt', receipt: null });
  });
});

describe('words for an expense', () => {
  const position = (over: Partial<BudgetPositionDTO>): BudgetPositionDTO => ({ budgetId: 4, budgetName: '2026 budget', planned: '200000', spent: '120000', thisVoucher: '50000', left: '30000', overBy: '0', ...over });

  it('says what is left in the budget, in full naira', () => {
    const note = budgetSentence(position({}));
    expect(note.over).toBe(false);
    expect(note.text).toBe('₦170,000.00 of ₦200,000.00 used. ₦30,000.00 left in the budget.');
  });

  it('says how far over this voucher takes the category', () => {
    const note = budgetSentence(position({ spent: '180000', thisVoucher: '50000', left: '-30000', overBy: '30000' }));
    expect(note.over).toBe(true);
    expect(note.text).toContain('₦30,000.00 over its budget');
  });

  it('asks for the receipt above the limit, and a receipt or a reason at or below it', () => {
    expect(receiptRule('5000.01', 5000)).toBe('receipt');
    expect(receiptRule('5000', 5000)).toBe('receipt-or-reason');
    expect(receiptHelper('20000', 5000)).toContain('needs its receipt');
    expect(receiptHelper('800', 5000)).toContain('or say why there is none');
    expect(receiptHelper('', 5000)).toContain('₦5,000.00');
  });

  it('keys each state the way the status chip knows it', () => {
    expect(expenseStatusKey('PENDING_APPROVAL')).toBe('pending_approval');
    expect(expenseStatusKey('VOIDED')).toBe('cancelled');
    expect(EXPENSE_FILTER_OPTIONS.map((o) => o.value)).toEqual(['ALL', 'PENDING_APPROVAL', 'APPROVED', 'DRAFT', 'REJECTED', 'VOIDED']);
  });
});
