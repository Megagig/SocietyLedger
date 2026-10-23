import { isOverdue, overdueWhere } from '../../src/modules/finance/overdue-rules';

const now = new Date('2026-10-24T12:00:00.000Z');
const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000);

describe('isOverdue', () => {
  it('a charge still owed and past its due date is overdue — whatever status is stored', () => {
    expect(isOverdue({ status: 'pending', dueDate: day(-2) }, now)).toBe(true);
    expect(isOverdue({ status: 'partial', dueDate: day(-2) }, now)).toBe(true);
    expect(isOverdue({ status: 'overdue', dueDate: day(-2) }, now)).toBe(true);
  });

  it('is not overdue before the due date, when paid, when voided, or with no due date', () => {
    expect(isOverdue({ status: 'pending', dueDate: day(3) }, now)).toBe(false);
    expect(isOverdue({ status: 'paid', dueDate: day(-9) }, now)).toBe(false);
    expect(isOverdue({ status: 'pending', dueDate: day(-9), isVoided: true }, now)).toBe(false);
    expect(isOverdue({ status: 'pending', dueDate: null }, now)).toBe(false);
  });
});

describe('overdueWhere', () => {
  it('asks the database for the same thing: open, not voided, due before now', () => {
    expect(overdueWhere(now)).toEqual({ isVoided: false, status: { in: ['pending', 'partial', 'overdue'] }, dueDate: { lt: now } });
  });
});
