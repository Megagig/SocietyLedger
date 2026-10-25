/** The setup wizard: finishing a step is not the same as skipping it, and the checklist at the end has to tell them apart. */
import { applyStep, readProgress } from '../../src/modules/onboarding/onboarding-rules';
import { onboardingTeamInviteSchema, ONBOARDING_STEPS } from '@societyledger/shared';

const fresh = { currentStep: 1, completedSteps: [] as number[], skippedSteps: [] as number[] };

describe('finishing and skipping steps', () => {
  it('marks a finished step done, sets its flag, and moves on', () => {
    expect(applyStep(fresh, 1, 'profile', false)).toEqual({
      currentStep: 2,
      completedSteps: [1],
      skippedSteps: [],
      flag: 'profileCompleted',
      complete: false,
    });
  });

  it('marks a skipped step skipped, leaves its flag alone, and still moves on', () => {
    expect(applyStep(fresh, 2, 'team', true)).toEqual({
      currentStep: 3,
      completedSteps: [],
      skippedSteps: [2],
      flag: undefined,
      complete: false,
    });
  });

  it('turns a skipped step into a finished one when they come back to it, and the other way round', () => {
    const skipped = applyStep(fresh, 4, 'finance', true);
    const later = applyStep({ currentStep: 5, completedSteps: skipped.completedSteps, skippedSteps: skipped.skippedSteps }, 4, 'finance', false);
    expect(later.completedSteps).toEqual([4]);
    expect(later.skippedSteps).toEqual([]);
    expect(later.flag).toBe('financeConfigured');

    const undone = applyStep({ currentStep: 5, completedSteps: [4], skippedSteps: [] }, 4, 'finance', true);
    expect(undone.completedSteps).toEqual([]);
    expect(undone.skippedSteps).toEqual([4]);
  });

  it('never moves the wizard backwards when an earlier step is redone', () => {
    expect(applyStep({ currentStep: 4, completedSteps: [1, 2, 3], skippedSteps: [] }, 1, 'profile', false).currentStep).toBe(4);
  });

  it('keeps the list in order with no duplicates', () => {
    const once = applyStep({ currentStep: 3, completedSteps: [2], skippedSteps: [] }, 1, 'profile', false);
    expect(once.completedSteps).toEqual([1, 2]);
    expect(applyStep({ currentStep: 3, completedSteps: once.completedSteps, skippedSteps: [] }, 1, 'profile', false).completedSteps).toEqual([1, 2]);
  });

  it('ends the wizard on the last step and caps the current step at the last one', () => {
    const done = applyStep({ currentStep: 5, completedSteps: [1, 2, 3, 4], skippedSteps: [] }, 5, 'complete', false);
    expect(done.complete).toBe(true);
    expect(done.currentStep).toBe(ONBOARDING_STEPS.length);
  });

  it('refuses a step number that does not match the step name', () => {
    expect(() => applyStep(fresh, 3, 'profile', false)).toThrow('Step 3 is not "profile"');
  });

  it('reads old progress rows that have no skipped list yet', () => {
    expect(readProgress({ currentStep: 3, completedSteps: [1, 2] })).toEqual({ currentStep: 3, completedSteps: [1, 2], skippedSteps: [] });
    expect(readProgress({ currentStep: 1, completedSteps: 'junk', skippedSteps: null })).toEqual({ currentStep: 1, completedSteps: [], skippedSteps: [] });
  });
});

describe('inviting the team', () => {
  const person = { firstName: 'Ngozi', lastName: 'Eze', email: ' Ngozi@Example.com', role: 'treasurer' };

  it('takes a name, an email and one of the officer roles, and tidies the email', () => {
    const parsed = onboardingTeamInviteSchema.parse({ invites: [person] });
    expect(parsed.invites[0]?.email).toBe('ngozi@example.com');
  });

  it('does not let an invite hand out a role that is not an officer role', () => {
    expect(onboardingTeamInviteSchema.safeParse({ invites: [{ ...person, role: 'member' }] }).success).toBe(false);
    expect(onboardingTeamInviteSchema.safeParse({ invites: [{ ...person, role: 'election_committee' }] }).success).toBe(false);
  });

  it('needs at least one person and at most twenty', () => {
    expect(onboardingTeamInviteSchema.safeParse({ invites: [] }).success).toBe(false);
    expect(onboardingTeamInviteSchema.safeParse({ invites: Array.from({ length: 21 }, () => person) }).success).toBe(false);
  });
});
