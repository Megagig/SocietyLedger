import { buildChargeFormSchema, bulkFormSchema, dueDateToIso, emptyChargeValues, paymentAmountProblem, paymentFormSchema, parseAmount, toChargePayload } from './schemas';

const member = { id: 7, name: 'Ada Obi' };
const valid = { ...emptyChargeValues(), member, categoryId: '3', amount: '5,000' };

describe('parseAmount', () => {
  it('reads naira and kobo and refuses the rest', () => {
    expect(parseAmount('5,000')).toBe(5000);
    expect(parseAmount('1250.50')).toBe(1250.5);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('12.345')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('charge form', () => {
  it('creating needs a member, a category and an amount', () => {
    const schema = buildChargeFormSchema('create');
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({ ...valid, member: null }).success).toBe(false);
    expect(schema.safeParse({ ...valid, categoryId: '' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, amount: '0' }).success).toBe(false);
  });

  it('editing needs a reason of at least 5 characters', () => {
    const schema = buildChargeFormSchema('edit');
    expect(schema.safeParse({ ...valid, reason: 'typo' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, reason: 'Wrong due date' }).success).toBe(true);
  });

  it('voiding needs a reason of at least 10 characters and the password', () => {
    const schema = buildChargeFormSchema('void');
    expect(schema.safeParse({ ...valid, reason: 'Wrong amount', password: '' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, reason: 'short', password: 'secret' }).success).toBe(false);
    expect(schema.safeParse({ ...valid, reason: 'Charged the wrong amount', password: 'secret' }).success).toBe(true);
  });

  it('builds the API body: amount as a number, blank due date and note as null', () => {
    expect(toChargePayload(valid)).toEqual({ memberId: 7, categoryId: 3, amount: 5000, dueDate: null, notes: null });
    expect(dueDateToIso('2026-11-01')).toBe(new Date('2026-11-01').toISOString());
  });
});

describe('bulk and payment forms', () => {
  it('bulk needs a category and an amount', () => {
    expect(bulkFormSchema.safeParse({ categoryId: '3', amount: '2000', dueDate: '', notes: '' }).success).toBe(true);
    expect(bulkFormSchema.safeParse({ categoryId: '', amount: '2000', dueDate: '', notes: '' }).success).toBe(false);
  });

  it('a payment needs an amount, a method and a date', () => {
    expect(paymentFormSchema.safeParse({ amount: '1000', method: 'cash', paymentDate: '2026-10-24T00:00:00.000Z', notes: '' }).success).toBe(true);
    expect(paymentFormSchema.safeParse({ amount: '', method: 'cash', paymentDate: 'x', notes: '' }).success).toBe(false);
  });

  it('flags an amount above what is left on the charge', () => {
    expect(paymentAmountProblem('6000', 5000)).toContain('5,000');
    expect(paymentAmountProblem('5000', 5000)).toBeNull();
    expect(paymentAmountProblem('', 5000)).toBeNull();
  });
});
