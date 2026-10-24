import { buildApproveSchema, buildContributionSchema, disburseSchema, emptyContributionValues, emptyFundValues, fundFormSchema, toBulkPayload, toContributionPayload, toFundPayload } from './schemas';

describe('fundFormSchema', () => {
  const valid = { ...emptyFundValues(), name: 'Bereavement fund' };

  it('needs a name and a kind; everything else may be blank', () => {
    expect(fundFormSchema.safeParse(valid).success).toBe(true);
    expect(fundFormSchema.safeParse({ ...valid, name: 'x' }).success).toBe(false);
  });

  it('amounts typed must be above ₦0, and days and months whole numbers', () => {
    expect(fundFormSchema.safeParse({ ...valid, maxPayout: '0' }).success).toBe(false);
    expect(fundFormSchema.safeParse({ ...valid, maxPayout: '100,000' }).success).toBe(true);
    expect(fundFormSchema.safeParse({ ...valid, waitingPeriodDays: '3.5' }).success).toBe(false);
    expect(fundFormSchema.safeParse({ ...valid, minContributionMonths: '6' }).success).toBe(true);
  });

  it('builds the payload: blanks become null, counts become numbers', () => {
    expect(toFundPayload({ ...valid, maxPayout: '100,000', waitingPeriodDays: '30', description: ' ' })).toMatchObject({
      name: 'Bereavement fund', maxPayout: 100000, targetBalance: null, minContribution: null, waitingPeriodDays: 30, minContributionMonths: 0, description: null,
    });
  });
});

describe('contributions', () => {
  it('need a fund and an amount, and meet the fund\'s minimum', () => {
    const schema = buildContributionSchema(1000);
    const valid = { ...emptyContributionValues('2'), amount: '1,000' };
    expect(schema.safeParse(valid).success).toBe(true);
    const below = schema.safeParse({ ...valid, amount: '500' });
    expect(below.success).toBe(false);
    expect(JSON.stringify(below)).toContain('smallest contribution');
    expect(schema.safeParse({ ...valid, fundId: '' }).success).toBe(false);
  });

  it('a fund with no minimum accepts any amount above ₦0, and a future date is refused', () => {
    const schema = buildContributionSchema(null);
    expect(schema.safeParse({ ...emptyContributionValues('2'), amount: '10' }).success).toBe(true);
    const future = new Date(Date.now() + 86_400_000 * 10).toISOString();
    expect(schema.safeParse({ ...emptyContributionValues('2'), amount: '10', contributionDate: future }).success).toBe(false);
  });

  it('builds a single and a bulk payload', () => {
    const values = { ...emptyContributionValues('2'), amount: '5,000', reference: ' R1 ', notes: '' };
    expect(toContributionPayload(values, 7)).toMatchObject({ fundId: 2, memberId: 7, amount: 5000, reference: 'R1', paymentMethod: 'cash' });
    expect(toBulkPayload(values, [1, 2, 3])).toMatchObject({ fundId: 2, memberIds: [1, 2, 3], amount: 5000 });
    expect(toBulkPayload(values, [1]).notes).toBeUndefined();
  });
});

describe('buildApproveSchema', () => {
  const schema = buildApproveSchema(30000);

  it('can be less than the most allowed, or exactly it', () => {
    expect(schema.safeParse({ amount: '10,000', comments: '' }).success).toBe(true);
    expect(schema.safeParse({ amount: '30,000', comments: '' }).success).toBe(true);
  });

  it('never more, and never zero', () => {
    const tooMuch = schema.safeParse({ amount: '30,000.01', comments: '' });
    expect(tooMuch.success).toBe(false);
    expect(JSON.stringify(tooMuch)).toContain('at most ₦30,000.00');
    expect(schema.safeParse({ amount: '0', comments: '' }).success).toBe(false);
  });
});

describe('disburseSchema', () => {
  it('needs a method; the reference and note are optional', () => {
    expect(disburseSchema.safeParse({ method: 'cash', reference: '', notes: '' }).success).toBe(true);
    expect(disburseSchema.safeParse({ method: '', reference: '', notes: '' }).success).toBe(false);
  });
});
