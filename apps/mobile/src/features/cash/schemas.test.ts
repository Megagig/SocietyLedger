import type { CashPayablesDTO } from '@/types/api/cash';
import { buildLodgmentFormSchema, buildReceiptDraft, collectionFormSchema, newIdempotencyKey, parseNairaInput, payableRows, shortfallOf } from './schemas';

const payables: CashPayablesDTO = {
  member: { id: 7, memberId: 'M-007', name: 'Ada Obi' },
  charges: [
    { kind: 'DUES', targetId: 100, label: 'Annual dues', dueDate: null, amount: 10000, balance: 6000 },
    { kind: 'LEVY', targetId: 101, label: 'Building levy', dueDate: null, amount: 5000, balance: 5000 },
  ],
  savings: [{ kind: 'SAVINGS', targetId: 200, label: 'Savings 0001', accountType: 'REGULAR', balance: 20000, suggested: 2000 }],
  welfare: [{ kind: 'WELFARE', targetId: 300, label: 'Burial fund', minimum: 500, suggested: null }],
  loans: [{ kind: 'LOAN_REPAYMENT', targetId: 400, label: 'Loan L-1', status: 'ACTIVE', outstanding: 30000, suggested: 5000, nextPaymentDate: null }],
  donations: { categories: [{ id: 9, name: 'General donation' }], allocations: [] },
};

describe('parseNairaInput', () => {
  it('reads naira with commas and kobo, and refuses anything else', () => {
    expect(parseNairaInput('5,000')).toBe(5000);
    expect(parseNairaInput('1250.50')).toBe(1250.5);
    expect(parseNairaInput('0')).toBeNull();
    expect(parseNairaInput('')).toBeNull();
    expect(parseNairaInput('12.345')).toBeNull();
    expect(parseNairaInput('abc')).toBeNull();
    expect(parseNairaInput('-5')).toBeNull();
  });
});

describe('payableRows', () => {
  it('lists what the member owes first, then loans, savings and welfare, each with its limit', () => {
    const rows = payableRows(payables);
    expect(rows.map((r) => r.key)).toEqual(['DUES:100', 'LEVY:101', 'LOAN_REPAYMENT:400', 'SAVINGS:200', 'WELFARE:300']);
    expect(rows[0]).toMatchObject({ max: 6000, suggested: 6000, hint: 'Owes ₦6,000' });
    expect(rows.find((r) => r.kind === 'SAVINGS')).toMatchObject({ max: null, suggested: 2000 });
    expect(rows.find((r) => r.kind === 'WELFARE')?.suggested).toBe(500);
  });
});

describe('buildReceiptDraft', () => {
  const rows = payableRows(payables);

  it('builds items only for rows with an amount, and totals them', () => {
    const draft = buildReceiptDraft(rows, { amounts: { 'DUES:100': '6,000', 'SAVINGS:200': '2000' }, donation: null });
    expect(draft.items).toEqual([
      { kind: 'DUES', targetId: 100, amount: 6000 },
      { kind: 'SAVINGS', targetId: 200, amount: 2000 },
    ]);
    expect(draft.total).toBe(8000);
    expect(draft.problems).toEqual([]);
  });

  it('adds a donation with its category and project', () => {
    const draft = buildReceiptDraft(rows, { amounts: {}, donation: { categoryId: 9, allocationId: 4, amount: '1000' } });
    expect(draft.items).toEqual([{ kind: 'DONATION', targetId: 9, amount: 1000, allocationId: 4 }]);
  });

  it('reports an amount above what is owed instead of sending it', () => {
    const draft = buildReceiptDraft(rows, { amounts: { 'DUES:100': '9000' }, donation: null });
    expect(draft.items).toEqual([]);
    expect(draft.problems).toEqual(['Annual dues: only ₦6,000 is owed.']);
  });

  it('reports an amount that is not naira and kobo', () => {
    const draft = buildReceiptDraft(rows, { amounts: { 'SAVINGS:200': '12.345' }, donation: null });
    expect(draft.problems).toHaveLength(1);
    expect(draft.items).toEqual([]);
  });

  it('ignores blank rows and keeps kobo exact in the total', () => {
    const draft = buildReceiptDraft(rows, { amounts: { 'DUES:100': '', 'SAVINGS:200': '0.10', 'WELFARE:300': '0.20' }, donation: null });
    expect(draft.total).toBe(0.3);
  });
});

describe('newIdempotencyKey', () => {
  it('differs between receipts and is long enough for the API', () => {
    const a = newIdempotencyKey();
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(newIdempotencyKey()).not.toBe(a);
  });
});

describe('collectionFormSchema', () => {
  it('needs a name', () => {
    expect(collectionFormSchema.safeParse({ title: '', meetingId: '', notes: '' }).success).toBe(false);
    expect(collectionFormSchema.safeParse({ title: 'October meeting', meetingId: '', notes: '' }).success).toBe(true);
  });
});

describe('buildLodgmentFormSchema', () => {
  const slip = { uri: 'file:///slip.jpg', name: 'slip.jpg', type: 'image/jpeg' };
  const base = { bankAccountId: '3', amount: '9,000', depositDate: '2026-10-22T00:00:00.000Z', bankReference: '', shortfallReason: '', slip };

  it('accepts lodging everything with a slip', () => {
    expect(buildLodgmentFormSchema(9000).safeParse(base).success).toBe(true);
  });

  it('refuses more than the cash held', () => {
    const result = buildLodgmentFormSchema(9000).safeParse({ ...base, amount: '9500' });
    expect(result.success).toBe(false);
  });

  it('asks why when lodging less, and accepts it once a reason is given', () => {
    const schema = buildLodgmentFormSchema(9000);
    const short = schema.safeParse({ ...base, amount: '8500' });
    expect(short.success).toBe(false);
    if (!short.success) expect(short.error.issues[0]?.path).toEqual(['shortfallReason']);
    expect(schema.safeParse({ ...base, amount: '8500', shortfallReason: 'Refreshments' }).success).toBe(true);
  });

  it('needs a slip photo and an account', () => {
    const schema = buildLodgmentFormSchema(9000);
    expect(schema.safeParse({ ...base, slip: null }).success).toBe(false);
    expect(schema.safeParse({ ...base, bankAccountId: '' }).success).toBe(false);
  });
});

describe('shortfallOf', () => {
  it('is how far the typed amount is below what was collected', () => {
    expect(shortfallOf(9000, '8,500')).toBe(500);
    expect(shortfallOf(9000, '9000')).toBe(0);
    expect(shortfallOf(9000, 'abc')).toBe(0);
  });
});
