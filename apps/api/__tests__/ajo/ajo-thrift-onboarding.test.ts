/**
 * The pure rules of standalone thrift onboarding: how a typed or uploaded row is checked, which setup steps each kind of account has,
 * how progress moves, and which team roles each kind may invite with.
 */
import { onboardingFlowFor, onboardingStepsFor, onboardingTeamInviteSchema, teamRolesAllowedFor, THRIFT_ONBOARDING_STEPS } from '@societyledger/shared';
import { checkRow } from '../../src/modules/ajo/ajo-bulk.service';
import { applyStep } from '../../src/modules/onboarding/onboarding-rules';

const fresh = { currentStep: 1, completedSteps: [] as number[], skippedSteps: [] as number[] };

describe('checking one row of contributors', () => {
  const thrift = { rotating: false, maxShares: 1 };
  const pot = { rotating: true, maxShares: 3 };

  it('accepts a good row and tidies it', () => {
    const r = checkRow({ firstName: ' Ngozi ', lastName: 'Eze', phone: '0803 123 4567', address: '12 Market Road', email: 'n@x.com' }, thrift);
    expect(r).toEqual({ ok: true, row: { firstName: 'Ngozi', lastName: 'Eze', phone: '0803 123 4567', address: '12 Market Road', email: 'n@x.com', shares: 1 } });
  });

  it('needs names and a real Nigerian phone number, in plain words', () => {
    expect(checkRow({ lastName: 'Eze', phone: '08031234567' }, thrift)).toMatchObject({ ok: false, message: expect.stringContaining('first name') });
    expect(checkRow({ firstName: 'A', phone: '08031234567' }, thrift)).toMatchObject({ ok: false, message: expect.stringContaining('last name') });
    expect(checkRow({ firstName: 'A', lastName: 'B', phone: '12345' }, thrift)).toMatchObject({ ok: false, message: expect.stringContaining('phone number') });
    expect(checkRow({ firstName: 'A', lastName: 'B', phone: '+2348031234567' }, thrift)).toMatchObject({ ok: true });
  });

  it('refuses a bad email, keeps address and email optional', () => {
    expect(checkRow({ firstName: 'A', lastName: 'B', phone: '08031234567', email: 'nope' }, thrift)).toMatchObject({ ok: false });
    expect(checkRow({ firstName: 'A', lastName: 'B', phone: '08031234567' }, thrift)).toMatchObject({ ok: true, row: { address: null, email: null } });
  });

  it('allows shares only in a rotating pot, within the limit, and ignores them elsewhere', () => {
    expect(checkRow({ firstName: 'A', lastName: 'B', phone: '08031234567', shares: 2 }, pot)).toMatchObject({ ok: true, row: { shares: 2 } });
    expect(checkRow({ firstName: 'A', lastName: 'B', phone: '08031234567', shares: 4 }, pot)).toMatchObject({ ok: false });
    expect(checkRow({ firstName: 'A', lastName: 'B', phone: '08031234567', shares: 'x' }, pot)).toMatchObject({ ok: false });
    expect(checkRow({ firstName: 'A', lastName: 'B', phone: '08031234567', shares: 3 }, thrift)).toMatchObject({ ok: true, row: { shares: 1 } });
    expect(checkRow({ firstName: 'A', lastName: 'B', phone: '08031234567' }, pot)).toMatchObject({ ok: true, row: { shares: 1 } });
  });
});

describe('which setup an account walks through', () => {
  it('gives a standalone thrift group its own five steps and everyone else the association ones', () => {
    expect(onboardingFlowFor('THRIFT_GROUP')).toBe('THRIFT');
    expect(onboardingFlowFor('ASSOCIATION')).toBe('ASSOCIATION');
    expect(onboardingFlowFor(null)).toBe('ASSOCIATION');
    expect(onboardingStepsFor('THRIFT_GROUP').map((s) => s.key)).toEqual(['profile', 'circle', 'contributors', 'team', 'review']);
    expect(onboardingStepsFor('ASSOCIATION').map((s) => s.key)).toEqual(['profile', 'team', 'members', 'finance', 'complete']);
    expect(THRIFT_ONBOARDING_STEPS).toHaveLength(5);
  });

  it('never lets one kind complete the other kind’s steps', () => {
    expect(() => applyStep(fresh, 2, 'circle', false, 'THRIFT_GROUP')).not.toThrow();
    expect(() => applyStep(fresh, 3, 'finance', false, 'THRIFT_GROUP')).toThrow();
    expect(() => applyStep(fresh, 4, 'finance', false, 'ASSOCIATION')).not.toThrow();
    expect(() => applyStep(fresh, 2, 'circle', false, 'ASSOCIATION')).toThrow();
    // "team" is step 2 for an association and step 4 for a thrift group
    expect(() => applyStep(fresh, 2, 'team', false, 'THRIFT_GROUP')).toThrow();
    expect(() => applyStep(fresh, 4, 'team', false, 'THRIFT_GROUP')).not.toThrow();
  });

  it('finishes a thrift group on its review step, skips never finish it, and sets no association flags', () => {
    expect(applyStep(fresh, 5, 'review', false, 'THRIFT_GROUP').complete).toBe(true);
    expect(applyStep(fresh, 5, 'complete', false, 'ASSOCIATION').complete).toBe(true);
    expect(applyStep(fresh, 5, 'complete', false, 'ASSOCIATION').complete).toBe(true);
    expect(applyStep(fresh, 2, 'circle', true, 'THRIFT_GROUP').complete).toBe(false);
    expect(applyStep(fresh, 1, 'profile', false, 'THRIFT_GROUP').flag).toBeUndefined();
    expect(applyStep(fresh, 1, 'profile', false, 'ASSOCIATION').flag).toBe('profileCompleted');
    const afterSkip = applyStep(applyStep(fresh, 2, 'circle', true, 'THRIFT_GROUP') as never, 2, 'circle', true, 'THRIFT_GROUP');
    expect(afterSkip.skippedSteps).toEqual([2]);
    expect(afterSkip.currentStep).toBe(3);
  });

  it('keeps the association flow exactly as it was when no kind is given', () => {
    expect(applyStep(fresh, 3, 'members', false).flag).toBe('membersImported');
    expect(() => applyStep(fresh, 2, 'circle', false)).toThrow();
  });
});

describe('who a group can invite while setting up', () => {
  it('limits each kind to its own roles', () => {
    expect(teamRolesAllowedFor('THRIFT_GROUP').sort()).toEqual(['admin', 'ajo_collector', 'ajo_officer']);
    expect(teamRolesAllowedFor('ASSOCIATION').sort()).toEqual(['admin', 'financial_secretary', 'treasurer']);
  });

  it('accepts the thrift roles in an invite, and refuses a role nobody has', () => {
    const base = { firstName: 'A', lastName: 'B', email: 'a@b.com' };
    expect(onboardingTeamInviteSchema.safeParse({ invites: [{ ...base, role: 'ajo_collector' }] }).success).toBe(true);
    expect(onboardingTeamInviteSchema.safeParse({ invites: [{ ...base, role: 'wizard' }] }).success).toBe(false);
  });
});
