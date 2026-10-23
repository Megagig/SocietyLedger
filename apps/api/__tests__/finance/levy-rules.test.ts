/**
 * A levy is a debt. Closing a campaign only stops new members; the charges already raised stay owed. These are the rules that keep it so.
 */
import {
  LevyRuleError,
  assertAssignmentRemovable,
  assertCanAssign,
  assertDeadlineNotPast,
  assertStatusChange,
  effectiveStatus,
} from '../../src/modules/finance/advanced/levy-rules';
import { categoryDeactivateError, categoryTypeChangeError } from '../../src/modules/finance/category-rules';

describe('assertStatusChange', () => {
  it('lets an officer start a draft and close an active campaign', () => {
    expect(() => assertStatusChange('DRAFT', 'ACTIVE')).not.toThrow();
    expect(() => assertStatusChange('ACTIVE', 'CLOSED')).not.toThrow();
  });

  it('does nothing when the status is not changing', () => {
    expect(() => assertStatusChange('CLOSED', 'CLOSED')).not.toThrow();
  });

  it('never moves backwards, and never lets an officer complete or cancel a campaign', () => {
    for (const [from, to] of [
      ['CLOSED', 'ACTIVE'],
      ['COMPLETED', 'ACTIVE'],
      ['ACTIVE', 'COMPLETED'],
      ['ACTIVE', 'CANCELLED'],
      ['DRAFT', 'CLOSED'],
    ] as const) {
      expect(() => assertStatusChange(from, to)).toThrow(LevyRuleError);
    }
  });

  it('explains that a debt is dropped member by member', () => {
    try {
      assertStatusChange('ACTIVE', 'CANCELLED');
    } catch (error) {
      expect((error as LevyRuleError).message).toMatch(/member by member/);
      expect((error as LevyRuleError).status).toBe(409);
    }
  });
});

describe('assertCanAssign', () => {
  it('only an active campaign takes new members', () => {
    expect(() => assertCanAssign('ACTIVE')).not.toThrow();
    for (const status of ['DRAFT', 'CLOSED', 'COMPLETED', 'CANCELLED'] as const) {
      expect(() => assertCanAssign(status)).toThrow(LevyRuleError);
    }
  });
});

describe('assertDeadlineNotPast', () => {
  const now = new Date('2026-10-26T15:00:00');
  it('allows today and later', () => {
    expect(() => assertDeadlineNotPast(new Date('2026-10-26T00:00:00'), now)).not.toThrow();
    expect(() => assertDeadlineNotPast(new Date('2026-12-01'), now)).not.toThrow();
  });
  it('refuses a day that has passed', () => {
    expect(() => assertDeadlineNotPast(new Date('2026-10-25T23:59:00'), now)).toThrow(LevyRuleError);
  });
});

describe('effectiveStatus', () => {
  it('is Completed once every assigned member has paid', () => {
    expect(effectiveStatus('ACTIVE', 10, 10)).toBe('COMPLETED');
    expect(effectiveStatus('CLOSED', 3, 3)).toBe('COMPLETED');
  });
  it('stays as stored while anyone still owes', () => {
    expect(effectiveStatus('ACTIVE', 10, 9)).toBe('ACTIVE');
    expect(effectiveStatus('CLOSED', 10, 0)).toBe('CLOSED');
  });
  it('a campaign with nobody assigned is not complete', () => {
    expect(effectiveStatus('ACTIVE', 0, 0)).toBe('ACTIVE');
  });
});

describe('assertAssignmentRemovable', () => {
  it('allows a correction while nothing has been paid', () => {
    expect(() => assertAssignmentRemovable(0)).not.toThrow();
  });
  it('is refused once any payment exists', () => {
    expect(() => assertAssignmentRemovable(1)).toThrow(/Waive or void/);
  });
});

describe('categoryTypeChangeError', () => {
  it('allows a change on a category nothing uses, or no change at all', () => {
    expect(categoryTypeChangeError('due', 'levy', { charges: 0, campaigns: 0 })).toBeNull();
    expect(categoryTypeChangeError('due', 'due', { charges: 9, campaigns: 0 })).toBeNull();
    expect(categoryTypeChangeError('due', undefined, { charges: 9, campaigns: 0 })).toBeNull();
  });
  it('locks the type once a charge or a campaign uses the category', () => {
    expect(categoryTypeChangeError('due', 'penalty', { charges: 2, campaigns: 0 })).toMatch(/can't change from due to penalty/);
    expect(categoryTypeChangeError('levy', 'due', { charges: 0, campaigns: 1 })).not.toBeNull();
  });
});

describe('categoryDeactivateError', () => {
  it('is refused while charges are still owed', () => {
    expect(categoryDeactivateError(3)).toMatch(/3 pending/);
    expect(categoryDeactivateError(0)).toBeNull();
  });
});
