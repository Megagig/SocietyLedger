/** The rules of an expense voucher: amounts, dates, the receipt, the budget, and what a voucher must carry before it is sent. */
import { Decimal } from '@prisma/client/runtime/library';
import {
  assertReadyToSend,
  budgetPosition,
  DEFAULT_RECEIPT_LIMIT,
  ExpenseRuleError,
  formatNaira,
  isEditableStatus,
  parseAmount,
  parseExpenseDate,
  receiptLimit,
  rejectSchema,
  sniffReceipt,
  suffixOf,
  voidSchema,
  voucherInputSchema,
  voucherNumberFor,
} from '../../src/modules/expenses/expense-rules';

const codeOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    if (error instanceof ExpenseRuleError) return error.code;
    throw error;
  }
  return 'NO_ERROR';
};

describe('the amount', () => {
  it('accepts naira and kobo, as a number or as text', () => {
    expect(parseAmount(5000).toString()).toBe('5000');
    expect(parseAmount('1250.50').toString()).toBe('1250.5');
  });

  it('refuses zero, negatives, more than two decimals, and nonsense', () => {
    for (const bad of [0, -5, '12.345', 'abc', '', null, undefined, NaN]) expect(codeOf(() => parseAmount(bad))).toBe('INVALID_AMOUNT');
  });

  it('refuses an amount too large for one voucher', () => {
    expect(codeOf(() => parseAmount('100000000001'))).toBe('INVALID_AMOUNT');
  });
});

describe('the date', () => {
  const now = new Date('2026-10-24T15:00:00.000Z');
  it('keeps the Lagos day at midday UTC, whatever form it arrives in', () => {
    expect(parseExpenseDate('2026-10-20', now).toISOString()).toBe('2026-10-20T12:00:00.000Z');
    expect(parseExpenseDate('2026-10-20T23:30:00.000Z', now).toISOString()).toBe('2026-10-21T12:00:00.000Z'); // already the 21st in Lagos
  });

  it('refuses a day after today in Lagos, a missing date and nonsense', () => {
    expect(codeOf(() => parseExpenseDate('2026-10-26', now))).toBe('FUTURE_DATE');
    expect(codeOf(() => parseExpenseDate('', now))).toBe('INVALID_DATE');
    expect(codeOf(() => parseExpenseDate('not a date', now))).toBe('INVALID_DATE');
    expect(codeOf(() => parseExpenseDate(undefined, now))).toBe('INVALID_DATE');
  });

  it('lets today through, even late at night in Lagos', () => {
    expect(parseExpenseDate('2026-10-24', now).toISOString()).toBe('2026-10-24T12:00:00.000Z');
    expect(parseExpenseDate('2026-10-25', new Date('2026-10-24T23:30:00.000Z')).toISOString()).toBe('2026-10-25T12:00:00.000Z');
  });
});

describe('what a person types', () => {
  const valid = { payee: 'Ade Hall', description: 'Hall hire for the AGM', amount: 50000, expenseDate: '2026-10-20', categoryAccountId: 5, paidFromAccountId: 2 };

  it('accepts a complete voucher with the optional parts left out', () => {
    expect(voucherInputSchema.safeParse(valid).success).toBe(true);
    expect(voucherInputSchema.safeParse({ ...valid, reference: 'INV-9', noReceiptReason: null }).success).toBe(true);
  });

  it('says plainly what is missing', () => {
    expect(voucherInputSchema.safeParse({ ...valid, payee: '' }).error?.issues[0].message).toBe('The payee needs at least 2 characters.');
    expect(voucherInputSchema.safeParse({ ...valid, categoryAccountId: 0 }).error?.issues[0].message).toBe('Choose a category.');
    expect(voucherInputSchema.safeParse({ ...valid, paidFromAccountId: undefined }).success).toBe(false);
  });

  it('refuses anything it does not know, so a status or an approver cannot be slipped in', () => {
    expect(voucherInputSchema.safeParse({ ...valid, status: 'APPROVED' }).success).toBe(false);
    expect(voucherInputSchema.safeParse({ ...valid, approvedBy: 1 }).success).toBe(false);
  });

  it('needs a reason to reject, and a reason and a password to void', () => {
    expect(rejectSchema.safeParse({ reason: 'ok' }).success).toBe(false);
    expect(rejectSchema.safeParse({ reason: 'Wrong receipt' }).success).toBe(true);
    expect(voidSchema.safeParse({ reason: 'Paid twice' }).success).toBe(false);
    expect(voidSchema.safeParse({ reason: 'Paid twice', password: 'x' }).success).toBe(true);
  });
});

describe('the receipt', () => {
  it('uses the limit the association set, or the default when it never set one', () => {
    expect(receiptLimit(20000).toString()).toBe('20000');
    expect(receiptLimit('0').toString()).toBe('0');
    expect(receiptLimit(undefined).toString()).toBe(String(DEFAULT_RECEIPT_LIMIT));
    expect(receiptLimit(-1).toString()).toBe(String(DEFAULT_RECEIPT_LIMIT));
  });

  it('is needed above the limit', () => {
    expect(codeOf(() => assertReadyToSend({ amount: '5000.01', receiptKey: null, noReceiptReason: 'no receipt' }, 5000))).toBe('RECEIPT_REQUIRED');
    expect(codeOf(() => assertReadyToSend({ amount: '5000.01', receiptKey: 'k', noReceiptReason: null }, 5000))).toBe('NO_ERROR');
  });

  it('writes the limit in full naira in its message', () => {
    expect(formatNaira(5000)).toBe('₦5,000.00');
    expect(formatNaira('1250000.5')).toBe('₦1,250,000.50');
    expect(formatNaira(0)).toBe('₦0.00');
    expect(() => assertReadyToSend({ amount: '20000', receiptKey: null, noReceiptReason: null }, 5000)).toThrow('above ₦5,000.00.');
  });

  it('needs a reason when there is none, at or below the limit', () => {
    expect(codeOf(() => assertReadyToSend({ amount: '5000', receiptKey: null, noReceiptReason: null }, 5000))).toBe('RECEIPT_OR_REASON');
    expect(codeOf(() => assertReadyToSend({ amount: '5000', receiptKey: null, noReceiptReason: '   ' }, 5000))).toBe('RECEIPT_OR_REASON');
    expect(codeOf(() => assertReadyToSend({ amount: '5000', receiptKey: null, noReceiptReason: 'Bus fare, no receipt' }, 5000))).toBe('NO_ERROR');
  });

  it('is read from its first bytes, not from what the phone says it is', () => {
    const pad = Buffer.alloc(16);
    expect(sniffReceipt(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad]))?.mime).toBe('image/jpeg');
    expect(sniffReceipt(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad]))?.mime).toBe('image/png');
    expect(sniffReceipt(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), pad]))?.mime).toBe('image/webp');
    expect(sniffReceipt(Buffer.concat([Buffer.from('%PDF-1.7'), pad]))?.mime).toBe('application/pdf');
    expect(sniffReceipt(Buffer.concat([Buffer.from('<script>alert(1)</script>'), pad]))).toBeNull();
    expect(sniffReceipt(Buffer.from('tiny'))).toBeNull();
  });
});

describe('states and numbers', () => {
  it('lets only a draft or a rejected voucher be changed', () => {
    expect(isEditableStatus('DRAFT')).toBe(true);
    expect(isEditableStatus('REJECTED')).toBe(true);
    for (const s of ['PENDING_APPROVAL', 'APPROVED', 'VOIDED'] as const) expect(isEditableStatus(s)).toBe(false);
  });

  it('numbers vouchers one after the highest used', () => {
    expect(voucherNumberFor('2026', 0)).toBe('EXP-2026-00001');
    expect(voucherNumberFor('2026', suffixOf('EXP-2026-00041'))).toBe('EXP-2026-00042');
    expect(suffixOf(undefined)).toBe(0);
  });
});

describe('where a category stands against its budget', () => {
  const budget = { id: 4, name: '2026 budget' };

  it('counts what is left after this voucher', () => {
    const p = budgetPosition(budget, 200000, 120000, 50000);
    expect(p.left.toString()).toBe('30000');
    expect(p.overBy.toString()).toBe('0');
  });

  it('says how far over it takes the line, to the kobo', () => {
    const p = budgetPosition(budget, '1000.00', '900.50', '150.25');
    expect(p.overBy.toString()).toBe('50.75');
    expect(p.left.isNegative()).toBe(true);
  });

  it('is not over when it lands exactly on the plan', () => {
    expect(budgetPosition(budget, 1000, 600, 400).overBy.equals(new Decimal(0))).toBe(true);
  });
});
