import { buildRecordSavingsSchema, buildRepaymentSchema, disburseSchema, emptyOpenAccountValues, emptyProductValues, openAccountSchema, productFormSchema, rejectSchema, toDisbursePayload, toProductPayload } from './schemas';

describe('recording a deposit or withdrawal', () => {
  const base = { paymentMethod: 'CASH', reference: '', notes: '' };

  it('a deposit has no upper limit but needs an amount above ₦0', () => {
    const schema = buildRecordSavingsSchema('DEPOSIT', 0);
    expect(schema.safeParse({ ...base, amount: '5,000,000' }).success).toBe(true);
    expect(schema.safeParse({ ...base, amount: '0' }).success).toBe(false);
  });

  it('a withdrawal can be at most what is available', () => {
    const schema = buildRecordSavingsSchema('WITHDRAWAL', 40000);
    expect(schema.safeParse({ ...base, amount: '40,000' }).success).toBe(true);
    const tooMuch = schema.safeParse({ ...base, amount: '40,000.01' });
    expect(tooMuch.success).toBe(false);
    expect(JSON.stringify(tooMuch)).toContain('at most ₦40,000.00');
  });
});

describe('recording a repayment', () => {
  const base = { paymentMethod: 'cash', reference: '', notes: '' };
  const schema = buildRepaymentSchema(100000);

  it('can be up to what is owed, not more', () => {
    expect(schema.safeParse({ ...base, amount: '100,000' }).success).toBe(true);
    const tooMuch = schema.safeParse({ ...base, amount: '100,000.01' });
    expect(tooMuch.success).toBe(false);
    expect(JSON.stringify(tooMuch)).toContain('more than is still owed');
  });
});

describe('rejecting', () => {
  it('needs a reason the member can read', () => {
    expect(rejectSchema.safeParse({ reason: 'Receipt is unclear' }).success).toBe(true);
    expect(rejectSchema.safeParse({ reason: 'no' }).success).toBe(false);
    expect(rejectSchema.safeParse({ reason: '   ' }).success).toBe(false);
  });
});

describe('disbursing', () => {
  it('crediting savings needs the account chosen; other methods do not', () => {
    expect(disburseSchema.safeParse({ method: 'savings_credit', savingsAccountId: '', reference: '', notes: '' }).success).toBe(false);
    expect(disburseSchema.safeParse({ method: 'savings_credit', savingsAccountId: '4', reference: '', notes: '' }).success).toBe(true);
    expect(disburseSchema.safeParse({ method: 'bank_transfer', savingsAccountId: '', reference: '', notes: '' }).success).toBe(true);
  });

  it('sends the account only for a savings credit', () => {
    expect(toDisbursePayload({ method: 'savings_credit', savingsAccountId: '4', reference: ' R1 ', notes: '' })).toEqual({
      disbursementMethod: 'savings_credit', savingsAccountId: 4, reference: 'R1', notes: undefined,
    });
    expect(toDisbursePayload({ method: 'cash', savingsAccountId: '4', reference: '', notes: '' }).savingsAccountId).toBeUndefined();
  });
});

describe('opening an account', () => {
  it('needs a member and a kind; the goals may be blank', () => {
    expect(openAccountSchema.safeParse({ ...emptyOpenAccountValues(), member: { id: 3, name: 'Ada' } }).success).toBe(true);
    expect(openAccountSchema.safeParse(emptyOpenAccountValues()).success).toBe(false);
    expect(openAccountSchema.safeParse({ ...emptyOpenAccountValues(), member: { id: 3, name: 'Ada' }, interestRate: '150' }).success).toBe(false);
  });
});

describe('productFormSchema', () => {
  const valid = { ...emptyProductValues(), name: 'Emergency loan', minAmount: '10,000', maxAmount: '500,000', interestRate: '10' };

  it('accepts sensible terms', () => {
    expect(productFormSchema.safeParse(valid).success).toBe(true);
  });

  it('the largest loan can\'t be less than the smallest, nor the longest tenure shorter than the shortest', () => {
    expect(productFormSchema.safeParse({ ...valid, maxAmount: '5,000' }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...valid, minTenureMonths: '12', maxTenureMonths: '6' }).success).toBe(false);
  });

  it('a rate or a percentage outside 0 to 100 is refused, a 0% rate is fine', () => {
    expect(productFormSchema.safeParse({ ...valid, interestRate: '101' }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...valid, interestRate: '0' }).success).toBe(true);
    expect(productFormSchema.safeParse({ ...valid, lateFeePercent: '150' }).success).toBe(false);
  });

  it('builds the payload in numbers; no guarantor needed means none required', () => {
    const payload = toProductPayload({ ...valid, processingFeePercent: '2', requiresGuarantor: false, minGuarantors: '2', maxLoanToSavingsRatio: '2' });
    expect(payload).toMatchObject({ minAmount: 10000, maxAmount: 500000, interestRate: 10, processingFeePercent: 2, requiresGuarantor: false, minGuarantors: 0, maxLoanToSavingsRatio: 2 });
    expect(toProductPayload(valid).maxLoanToSavingsRatio).toBeUndefined();
  });
});
