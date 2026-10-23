import { allocationFormSchema, buildWaiveSchema, dateInPast, emptyAllocationValues, emptyDonationValues, emptyRuleValues, recordDonationSchema, ruleFormSchema, toDonationPayload, toRulePayload } from './schemas';

const donor = { id: 7, name: 'Ada Obi' };

describe('recordDonationSchema', () => {
  const valid = { ...emptyDonationValues(), member: donor, amount: '5,000' };

  it('needs a donor and an amount above ₦0', () => {
    expect(recordDonationSchema.safeParse(valid).success).toBe(true);
    expect(recordDonationSchema.safeParse({ ...valid, member: null }).success).toBe(false);
    expect(recordDonationSchema.safeParse({ ...valid, amount: '0' }).success).toBe(false);
  });

  it('refuses a pledge dated in the past, but not an instant gift or a pledge with no date', () => {
    const yesterday = new Date(Date.now() - 86_400_000 * 2).toISOString();
    expect(recordDonationSchema.safeParse({ ...valid, donationType: 'pledge', pledgeDate: yesterday }).success).toBe(false);
    expect(recordDonationSchema.safeParse({ ...valid, donationType: 'pledge', pledgeDate: '' }).success).toBe(true);
    expect(recordDonationSchema.safeParse({ ...valid, donationType: 'instant', pledgeDate: yesterday }).success).toBe(true);
  });

  it('an instant gift sends how it was paid, a pledge sends its date', () => {
    const instant = toDonationPayload({ ...valid, paymentMethod: 'bank_transfer', allocationId: '4' }, 9);
    expect(instant).toMatchObject({ memberId: 7, categoryId: 9, amount: 5000, donationType: 'instant', paymentMethod: 'bank_transfer', allocationId: 4 });
    expect(instant.pledgeDate).toBeUndefined();
    const future = new Date(Date.now() + 86_400_000 * 20).toISOString();
    const pledge = toDonationPayload({ ...valid, donationType: 'pledge', pledgeDate: future }, 9);
    expect(pledge.paymentMethod).toBeUndefined();
    expect(pledge.pledgeDate).toBe(future);
  });

  it('leaves out a blank fund and message, and carries the anonymous choice', () => {
    const payload = toDonationPayload({ ...valid, isAnonymous: true }, 9);
    expect(payload.allocationId).toBeUndefined();
    expect(payload.donorMessage).toBeUndefined();
    expect(payload.isAnonymous).toBe(true);
  });
});

describe('allocationFormSchema', () => {
  it('needs a name and a kind, and the target may be blank', () => {
    expect(allocationFormSchema.safeParse({ ...emptyAllocationValues(), name: 'Hall roof' }).success).toBe(true);
    expect(allocationFormSchema.safeParse({ ...emptyAllocationValues(), name: 'x' }).success).toBe(false);
    expect(allocationFormSchema.safeParse({ ...emptyAllocationValues(), name: 'Hall roof', targetAmount: '0' }).success).toBe(false);
  });
});

describe('ruleFormSchema', () => {
  const valid = { ...emptyRuleValues(), name: 'Late dues fee', feeAmount: '500' };

  it('accepts a fixed fee with a grace period', () => {
    expect(ruleFormSchema.safeParse(valid).success).toBe(true);
  });

  it('a percentage can be at most 100, and a fee must be above zero', () => {
    expect(ruleFormSchema.safeParse({ ...valid, feeType: 'percentage', feeAmount: '150' }).success).toBe(false);
    expect(ruleFormSchema.safeParse({ ...valid, feeType: 'percentage', feeAmount: '5' }).success).toBe(true);
    expect(ruleFormSchema.safeParse({ ...valid, feeAmount: '0' }).success).toBe(false);
  });

  it('a repeating rule needs the days between fees', () => {
    expect(ruleFormSchema.safeParse({ ...valid, isCompounding: true, compoundingDays: '' }).success).toBe(false);
    expect(ruleFormSchema.safeParse({ ...valid, isCompounding: true, compoundingDays: '30' }).success).toBe(true);
  });

  it('builds the payload: the cap only for a percentage, the repeat days only when repeating', () => {
    expect(toRulePayload({ ...valid, maxFeeAmount: '2,000' })).toMatchObject({ feeType: 'fixed', feeAmount: 500, gracePeriodDays: 7, maxFeeAmount: undefined, compoundingDays: undefined });
    expect(toRulePayload({ ...valid, feeType: 'percentage', feeAmount: '5', maxFeeAmount: '2,000', isCompounding: true, compoundingDays: '14', categoryId: '3' })).toMatchObject({
      feeType: 'percentage', feeAmount: 5, maxFeeAmount: 2000, isCompounding: true, compoundingDays: 14, categoryId: 3,
    });
  });
});

describe('buildWaiveSchema', () => {
  const schema = buildWaiveSchema(5000);

  it('allows up to what is owed with a reason', () => {
    expect(schema.safeParse({ amount: '5,000', reason: 'First offence' }).success).toBe(true);
    expect(schema.safeParse({ amount: '1,250.50', reason: 'Hardship' }).success).toBe(true);
  });

  it('refuses more than is owed, zero, and a missing or short reason', () => {
    const tooMuch = schema.safeParse({ amount: '5,001', reason: 'First offence' });
    expect(tooMuch.success).toBe(false);
    expect(JSON.stringify(tooMuch)).toContain('at most');
    expect(schema.safeParse({ amount: '0', reason: 'First offence' }).success).toBe(false);
    expect(schema.safeParse({ amount: '100', reason: 'no' }).success).toBe(false);
  });
});

describe('dateInPast', () => {
  const now = new Date('2026-11-01T12:00:00');
  it('today is not in the past, yesterday is', () => {
    expect(dateInPast('2026-11-01T00:00:00', now)).toBe(false);
    expect(dateInPast('2026-10-31T23:00:00', now)).toBe(true);
  });
});
