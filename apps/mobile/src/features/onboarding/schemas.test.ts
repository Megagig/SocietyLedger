import { ONBOARDING_FINANCE_TEMPLATES } from '@societyledger/shared';

import {
  defaultAmounts,
  financeSetupSchema,
  quickMemberSchema,
  toBankAccountPayload,
  toCategoryPayload,
  toMemberPayload,
  type FinanceSetupFormValues,
} from './schemas';

const finance = (over: Partial<FinanceSetupFormValues> = {}): FinanceSetupFormValues => ({
  amounts: defaultAmounts(),
  bankName: '',
  accountName: '',
  accountNumber: '',
  ...over,
});
const financeIssues = (values: FinanceSetupFormValues) => {
  const result = financeSetupSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('adding a member in the wizard', () => {
  const values = { firstName: ' Ngozi ', lastName: 'Eze', phone: '', email: ' NGOZI@Example.com ', gender: 'female' as const };

  it('needs a name and a gender; phone and email are optional but must be real when given', () => {
    expect(quickMemberSchema.safeParse(values).success).toBe(true);
    expect(quickMemberSchema.safeParse({ ...values, firstName: '' }).success).toBe(false);
    expect(quickMemberSchema.safeParse({ ...values, email: 'nope' }).success).toBe(false);
    expect(quickMemberSchema.safeParse({ ...values, phone: 'abc' }).success).toBe(false);
  });

  it('becomes an active regular member who joined now, with blanks sent as null', () => {
    const now = new Date('2026-11-03T10:00:00.000Z');
    expect(toMemberPayload(quickMemberSchema.parse(values), now)).toEqual({
      firstName: 'Ngozi',
      lastName: 'Eze',
      phone: null,
      email: 'ngozi@example.com',
      gender: 'female',
      category: 'regular',
      status: 'active',
      joinDate: now.toISOString(),
    });
  });
});

describe('finance setup in the wizard', () => {
  it('starts with the shared starter amounts', () => {
    expect(defaultAmounts()).toEqual(ONBOARDING_FINANCE_TEMPLATES.map((t) => String(t.amount)));
  });

  it('accepts nothing at all (everything here is optional) and rejects an amount that is not above zero', () => {
    expect(financeIssues(finance())).toEqual([]);
    expect(financeIssues(finance({ amounts: ['0', '', '', ''] }))).toEqual(['amounts.0: Enter an amount above ₦0']);
  });

  it('asks for the whole bank account once any part of it is typed', () => {
    expect(financeIssues(finance({ accountNumber: '0123456789' }))).toEqual(['bankName: Choose the bank', 'accountName: Enter the account name']);
    expect(financeIssues(finance({ bankName: 'GTBank', accountName: 'Oko Youth Forum', accountNumber: '12345' }))).toEqual(['accountNumber: The account number must be 10 digits']);
    expect(financeIssues(finance({ bankName: 'GTBank', accountName: 'Oko Youth Forum', accountNumber: '0123456789' }))).toEqual([]);
  });

  it('turns a starter charge into a category with the amount as a number, using the API\'s own frequency spelling', () => {
    const annual = ONBOARDING_FINANCE_TEMPLATES.find((t) => t.name === 'Annual Dues');
    expect(annual && toCategoryPayload(annual, '60,000')).toMatchObject({ name: 'Annual Dues', type: 'due', amount: 60000, frequency: 'annual', isActive: true });
  });

  it('builds the bank account body, or nothing when no bank details were entered', () => {
    expect(toBankAccountPayload(finance(), undefined)).toBeNull();
    expect(toBankAccountPayload(finance({ bankName: 'GTBank', accountName: 'Oko Youth Forum', accountNumber: '0123456789' }), '058')).toEqual({
      bankName: 'GTBank',
      accountName: 'Oko Youth Forum',
      accountNumber: '0123456789',
      bankCode: '058',
      isDefault: true,
    });
  });
});
