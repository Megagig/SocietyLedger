import { cashAmountSchema, disputeSchema, handoverSchema, payoutAccountSchema, phoneCodeSchema, proofProblem, rulesAcceptSchema, transferSchema } from './schemas';

const proof = { uri: 'file:///slip.jpg', name: 'slip.jpg', type: 'image/jpeg', size: 1000 };

describe('transferSchema', () => {
  const ok = { amount: '5,000', paidOn: new Date().toISOString(), reference: '', proof };
  it('accepts a report with an amount, a day and a slip', () => {
    expect(transferSchema.safeParse(ok).success).toBe(true);
  });
  it('refuses a missing slip, a zero or odd amount and a future day', () => {
    expect(transferSchema.safeParse({ ...ok, proof: null }).success).toBe(false);
    expect(transferSchema.safeParse({ ...ok, amount: '0' }).success).toBe(false);
    expect(transferSchema.safeParse({ ...ok, amount: '12.345' }).success).toBe(false);
    expect(transferSchema.safeParse({ ...ok, amount: '' }).success).toBe(false);
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString();
    expect(transferSchema.safeParse({ ...ok, paidOn: tomorrow }).success).toBe(false);
  });
});

describe('payoutAccountSchema', () => {
  it('needs a 10 digit number and strips spaces', () => {
    const parsed = payoutAccountSchema.safeParse({ bankName: 'GTBank', accountNumber: '0123 456 78', accountName: 'Ada Obi' });
    expect(parsed.success).toBe(false);
    const good = payoutAccountSchema.safeParse({ bankName: 'GTBank', accountNumber: '0123456789', accountName: 'Ada Obi' });
    expect(good.success && good.data.accountNumber).toBe('0123456789');
    expect(payoutAccountSchema.safeParse({ bankName: 'G', accountNumber: '0123456789', accountName: 'Ada Obi' }).success).toBe(false);
  });
});

describe('disputeSchema, phoneCodeSchema, rulesAcceptSchema', () => {
  it('wants a real claim, a numeric code and a ticked box', () => {
    expect(disputeSchema.safeParse({ claim: 'too short' }).success).toBe(false);
    expect(disputeSchema.safeParse({ claim: 'I paid the collector on Monday morning.' }).success).toBe(true);
    expect(phoneCodeSchema.safeParse({ code: '12' }).success).toBe(false);
    expect(phoneCodeSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(rulesAcceptSchema.safeParse({ read: false }).success).toBe(false);
    expect(rulesAcceptSchema.safeParse({ read: true }).success).toBe(true);
  });
});

describe('proofProblem', () => {
  it('checks the type and the 5 MB limit', () => {
    expect(proofProblem(null)).toBeNull();
    expect(proofProblem({ type: 'image/webp', size: 10 })).toBeNull();
    expect(proofProblem({ type: 'text/plain', size: 10 })).toMatch(/JPG/);
    expect(proofProblem({ type: 'application/pdf', size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
  });
});

describe('collector amounts', () => {
  it('wants a real amount for cash taken, and lets a handover be zero', () => {
    expect(cashAmountSchema.safeParse({ amount: '1,500' }).success).toBe(true);
    expect(cashAmountSchema.safeParse({ amount: '0' }).success).toBe(false);
    expect(cashAmountSchema.safeParse({ amount: 'abc' }).success).toBe(false);
    expect(handoverSchema.safeParse({ amount: '0' }).success).toBe(true);
    expect(handoverSchema.safeParse({ amount: '' }).success).toBe(false);
    expect(handoverSchema.safeParse({ amount: '2500.50', note: 'all of it' }).success).toBe(true);
  });
  it('keeps the typed naira as typed, so it is turned into kobo exactly once', () => {
    const parsed = cashAmountSchema.parse({ amount: '1,500' });
    expect(parsed.amount).toBe('1,500');
  });
});
