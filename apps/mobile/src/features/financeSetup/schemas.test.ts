import { assignAmount, campaignFormSchema, categoryFormSchema, deadlineInPast, emptyCampaignValues, emptyCategoryValues, toCampaignPayload, toCategoryPayload } from './schemas';

describe('categoryFormSchema', () => {
  const valid = { ...emptyCategoryValues('due'), name: 'Monthly dues' };

  it('accepts a name and a type, with no amount', () => {
    expect(categoryFormSchema.safeParse(valid).success).toBe(true);
  });

  it('needs a real name', () => {
    expect(categoryFormSchema.safeParse({ ...valid, name: ' a ' }).success).toBe(false);
  });

  it('an amount may be blank, but anything typed must be above ₦0', () => {
    expect(categoryFormSchema.safeParse({ ...valid, amount: '' }).success).toBe(true);
    expect(categoryFormSchema.safeParse({ ...valid, amount: '5,000' }).success).toBe(true);
    expect(categoryFormSchema.safeParse({ ...valid, amount: '0' }).success).toBe(false);
    expect(categoryFormSchema.safeParse({ ...valid, amount: 'abc' }).success).toBe(false);
  });

  it('builds the payload: a blank amount and description become null', () => {
    expect(toCategoryPayload({ ...valid, amount: '5,000', description: '  ' })).toEqual({
      name: 'Monthly dues', type: 'due', amount: 5000, frequency: 'monthly', description: null, isActive: true,
    });
    expect(toCategoryPayload({ ...valid, amount: '' }).amount).toBeNull();
  });

  it('starts a dues category monthly and anything else one-time', () => {
    expect(emptyCategoryValues('due').frequency).toBe('monthly');
    expect(emptyCategoryValues('levy').frequency).toBe('one-time');
  });
});

describe('campaignFormSchema', () => {
  const valid = { ...emptyCampaignValues(), name: 'Building fund', categoryId: '4', targetAmount: '500,000', deadline: '2027-01-01T00:00:00.000Z' };

  it('needs a name, a levy type, a target and a deadline', () => {
    expect(campaignFormSchema.safeParse(valid).success).toBe(true);
    expect(campaignFormSchema.safeParse({ ...valid, categoryId: '' }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, targetAmount: '' }).success).toBe(false);
    expect(campaignFormSchema.safeParse({ ...valid, deadline: '' }).success).toBe(false);
  });

  it('builds the payload in naira, leaving out what was not typed', () => {
    const payload = toCampaignPayload({ ...valid, amountPerMember: '10,000', description: '' });
    expect(payload).toMatchObject({ categoryId: 4, name: 'Building fund', targetAmount: 500000, amountPerMember: 10000 });
    expect(payload.description).toBeUndefined();
    expect(toCampaignPayload(valid).amountPerMember).toBeUndefined();
  });
});

describe('deadlineInPast', () => {
  const now = new Date('2026-10-26T15:00:00');
  it('today is fine, yesterday is not', () => {
    expect(deadlineInPast('2026-10-26T00:00:00', now)).toBe(false);
    expect(deadlineInPast('2026-10-25T23:00:00', now)).toBe(true);
    expect(deadlineInPast('2027-01-01T00:00:00', now)).toBe(false);
  });
});

describe('assignAmount', () => {
  it('prefers what was typed, then the campaign default', () => {
    expect(assignAmount('7,500', '10000')).toBe(7500);
    expect(assignAmount('', '10000')).toBe(10000);
    expect(assignAmount('', null)).toBeNull();
  });
});
