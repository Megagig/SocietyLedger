import { categoryLabel, countActiveFilters, loginStatusLabel, loginStatusTone, memberFullName, statusLabel } from './labels';

describe('member labels', () => {
  it('names the known statuses, categories and login states', () => {
    expect(statusLabel('suspended')).toBe('Suspended');
    expect(categoryLabel('honorary')).toBe('Honorary');
    expect(loginStatusLabel('active')).toBe('Can sign in');
    expect(loginStatusLabel('no_login')).toBe('No login');
  });

  it('shows an unlisted value capitalised instead of hiding it', () => {
    expect(categoryLabel('life_member')).toBe('Life member');
    expect(statusLabel('on_leave')).toBe('On leave');
  });

  it('picks a tone per login state', () => {
    expect(loginStatusTone('active')).toBe('success');
    expect(loginStatusTone('invited')).toBe('info');
    expect(loginStatusTone('no_login')).toBe('neutral');
  });

  it('joins first and last name', () => {
    expect(memberFullName({ firstName: 'Adaeze', lastName: 'Okafor' })).toBe('Adaeze Okafor');
  });
});

describe('countActiveFilters', () => {
  it('is zero with no filters and counts each one that is set', () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ status: 'active' })).toBe(1);
    expect(countActiveFilters({ status: 'active', category: 'regular', loginStatus: 'invited' })).toBe(3);
  });
});
