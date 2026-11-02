import { purposeOf, withPurpose } from '../../src/modules/finance/charge-purpose';

const category = { name: 'wedding Levy' };

describe('what a charge is for', () => {
  it('names the campaign a levy belongs to', () => {
    expect(purposeOf({ category, levyAssignment: { campaign: { name: 'Levy For Emma Wedding' } } })).toBe('Levy For Emma Wedding');
  });

  it('names the donation cause', () => {
    expect(purposeOf({ category: { name: 'Donation' }, donationRecord: { allocation: { name: 'Building fund' } } })).toBe('Building fund');
  });

  it('uses the officer title when there is no campaign or cause, and the campaign wins over a title', () => {
    expect(purposeOf({ category: { name: 'Annual dues' }, title: '  Annual dues 2026 ' })).toBe('Annual dues 2026');
    expect(purposeOf({ category, title: 'Old title', levyAssignment: { campaign: { name: 'Levy For Emma Wedding' } } })).toBe('Levy For Emma Wedding');
  });

  it('says which rule a penalty came from and which charge it was put on', () => {
    const penalty = {
      category: { name: 'late payment fine' },
      asPenalty: { rule: { name: '5% late fee' }, sourceTransaction: { category, levyAssignment: { campaign: { name: 'Levy For Emma Wedding' } } } },
    };
    expect(purposeOf(penalty)).toBe('5% late fee · on Levy For Emma Wedding');
    expect(purposeOf({ ...penalty, asPenalty: { rule: { name: '5% late fee' }, sourceTransaction: { category: { name: 'Annual dues' } } } })).toBe('5% late fee · on Annual dues');
  });

  it('is null when there is nothing more specific than the category, so the list does not repeat itself', () => {
    expect(purposeOf({ category })).toBeNull();
    expect(purposeOf({ category, title: 'WEDDING levy' })).toBeNull();
    expect(purposeOf({ category, title: '   ' })).toBeNull();
    expect(withPurpose({ category, id: 4 })).toEqual({ category, id: 4, purpose: null });
  });
});
