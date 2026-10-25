import { can, canAll, canAny, PERMISSIONS } from './permissions';

describe('PERMISSIONS', () => {
  it('resolves MEETING_MINUTES/MEETING_ATTENDANCE to the real, server-enforced keys (not the stale web values)', () => {
    expect(PERMISSIONS.MEETING_MINUTES).toBe('meetings.manage_minutes');
    expect(PERMISSIONS.MEETING_ATTENDANCE).toBe('meetings.manage_attendance');
  });
});

describe('can', () => {
  it('is true when the base key is present', () => {
    expect(can(['ledger.view', 'members.view'], 'LEDGER_VIEW')).toBe(true);
  });

  it('is false when the base key is absent', () => {
    expect(can(['members.view'], 'LEDGER_VIEW')).toBe(false);
  });

  it('is false for an empty permission list', () => {
    expect(can([], 'LEDGER_VIEW')).toBe(false);
  });
});

describe('canAny', () => {
  it('is true when at least one alias is present', () => {
    expect(canAny(['ledger.view'], ['MEMBER_VIEW', 'LEDGER_VIEW'])).toBe(true);
  });

  it('is false when none of the aliases are present', () => {
    expect(canAny(['settings.view'], ['MEMBER_VIEW', 'LEDGER_VIEW'])).toBe(false);
  });

  it('is false for an empty alias list', () => {
    expect(canAny(['ledger.view'], [])).toBe(false);
  });
});

describe('canAll', () => {
  it('is true when every alias is present', () => {
    expect(canAll(['ledger.view', 'members.view'], ['MEMBER_VIEW', 'LEDGER_VIEW'])).toBe(true);
  });

  it('is false when only some aliases are present', () => {
    expect(canAll(['ledger.view'], ['MEMBER_VIEW', 'LEDGER_VIEW'])).toBe(false);
  });

  it('is true for an empty alias list (vacuous truth)', () => {
    expect(canAll(['ledger.view'], [])).toBe(true);
  });
});
