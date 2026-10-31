import { blankRow, contributorRowProblem, duplicatePhones, isBlankRow, normalizeNigerianPhone, type ContributorRow } from './contributorRows';

const row = (over: Partial<ContributorRow> = {}): ContributorRow => ({ ...blankRow(), firstName: 'Ngozi', lastName: 'Eze', phone: '08031234567', ...over });

describe('normalizeNigerianPhone', () => {
  it('reads the usual ways of writing a Nigerian number', () => {
    expect(normalizeNigerianPhone('08031234567')).toBe('2348031234567');
    expect(normalizeNigerianPhone('8031234567')).toBe('2348031234567');
    expect(normalizeNigerianPhone('+234 803 123 4567')).toBe('2348031234567');
    expect(normalizeNigerianPhone('0803 123')).toBeNull();
    expect(normalizeNigerianPhone('')).toBeNull();
  });
});

describe('contributorRowProblem', () => {
  it('passes a good row and names the first thing wrong otherwise', () => {
    expect(contributorRowProblem(row(), null)).toBeNull();
    expect(contributorRowProblem(row({ firstName: '' }), null)).toBe('Enter a first name.');
    expect(contributorRowProblem(row({ lastName: ' ' }), null)).toBe('Enter a last name.');
    expect(contributorRowProblem(row({ phone: '123' }), null)).toMatch(/Nigerian phone/);
    expect(contributorRowProblem(row({ email: 'nope' }), null)).toMatch(/email/);
  });
  it('checks shares only for a rotating pot', () => {
    expect(contributorRowProblem(row({ shares: '9' }), null)).toBeNull();
    expect(contributorRowProblem(row({ shares: '9' }), 2)).toMatch(/1 to 2/);
    expect(contributorRowProblem(row({ shares: '1.5' }), 2)).toMatch(/whole number/);
    expect(contributorRowProblem(row({ shares: '' }), 2)).toBeNull();
  });
});

describe('rows', () => {
  it('knows a blank row', () => {
    expect(isBlankRow(blankRow())).toBe(true);
    expect(isBlankRow(row())).toBe(false);
  });
  it('points at the earlier row that already uses a number', () => {
    const rows = [row(), row({ firstName: 'Chidi', lastName: 'Okafor', phone: '08051234567' }), row({ firstName: 'Ngozi2', phone: '+2348031234567' })];
    expect(duplicatePhones(rows)).toEqual([null, null, 'Ngozi Eze']);
  });
});
