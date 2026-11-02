/**
 * What the cooperative endpoints accept. The web forms send `null` for a field the officer left empty, so an empty description has to be
 * valid; a payment's lines arrive as a JSON string inside multipart form data, so a bad string must be a validation error, not a crash.
 */
import {
  createAccountTypeSchema,
  createLoanCategorySchema,
  createPaymentRequestSchema,
  reviewWithdrawalSchema,
  updateAccountTypeSchema,
} from '../../src/modules/cooperatives/cooperative-enhancements.validation';

describe('account types and loan categories', () => {
  it('accept an empty description sent as null (what the forms send)', () => {
    expect(createAccountTypeSchema.safeParse({ name: 'Christmas', description: null, accountClass: 'SPECIAL', defaultMonthlyAmount: null }).success).toBe(true);
    expect(createLoanCategorySchema.safeParse({ name: 'Commodity', description: null, isGoods: true }).success).toBe(true);
    expect(updateAccountTypeSchema.safeParse({ description: null, isActive: false }).success).toBe(true);
  });

  it('still refuse a missing name and an unknown behaviour class', () => {
    expect(createAccountTypeSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createAccountTypeSchema.safeParse({ name: 'Ok', accountClass: 'MADE_UP' }).success).toBe(false);
  });
});

describe('payment requests', () => {
  const base = { paymentDate: '2026-10-30' };
  const line = { accountTypeId: 1, amount: 5000, periodMonth: 10, periodYear: 2026 };

  it('reads the lines from the JSON string multipart sends, and amounts as numbers', () => {
    const parsed = createPaymentRequestSchema.parse({ ...base, lines: JSON.stringify([{ ...line, amount: '5000' }]) });
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0]?.amount).toBe(5000);
  });

  it('turns a broken lines string into a validation error', () => {
    expect(createPaymentRequestSchema.safeParse({ ...base, lines: '{not json' }).success).toBe(false);
    expect(createPaymentRequestSchema.safeParse({ ...base, lines: '[]' }).success).toBe(false);
  });

  it('refuses the same type twice for the same month, but allows it for different months', () => {
    expect(createPaymentRequestSchema.safeParse({ ...base, lines: JSON.stringify([line, line]) }).success).toBe(false);
    expect(createPaymentRequestSchema.safeParse({ ...base, lines: JSON.stringify([line, { ...line, periodMonth: 11 }]) }).success).toBe(true);
  });

  it('refuses a payment dated in the future, and a nonsense month or amount', () => {
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    expect(createPaymentRequestSchema.safeParse({ paymentDate: future, lines: JSON.stringify([line]) }).success).toBe(false);
    expect(createPaymentRequestSchema.safeParse({ ...base, lines: JSON.stringify([{ ...line, periodMonth: 13 }]) }).success).toBe(false);
    expect(createPaymentRequestSchema.safeParse({ ...base, lines: JSON.stringify([{ ...line, amount: 0 }]) }).success).toBe(false);
  });
});

describe('withdrawal review', () => {
  it('needs a reason to reject, but not to pass on', () => {
    expect(reviewWithdrawalSchema.safeParse({ decision: 'FORWARD' }).success).toBe(true);
    expect(reviewWithdrawalSchema.safeParse({ decision: 'REJECT' }).success).toBe(false);
    expect(reviewWithdrawalSchema.safeParse({ decision: 'REJECT', reason: 'No' }).success).toBe(false);
    expect(reviewWithdrawalSchema.safeParse({ decision: 'REJECT', reason: 'Loan guarantee outstanding' }).success).toBe(true);
  });
});
