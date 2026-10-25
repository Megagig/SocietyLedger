import { finishedCount, firstOpenStep, nextStepKey, stepStateOf } from './steps';

const progress = (completedSteps: number[], skippedSteps: number[] = []) => ({ completedSteps, skippedSteps });

describe('stepStateOf', () => {
  it('tells a finished step from a skipped one and from one not yet reached', () => {
    expect(stepStateOf(progress([1], [2]), 1)).toBe('done');
    expect(stepStateOf(progress([1], [2]), 2)).toBe('skipped');
    expect(stepStateOf(progress([1], [2]), 3)).toBe('todo');
  });

  it('reads progress saved before skipped steps existed', () => {
    expect(stepStateOf({ completedSteps: [1] }, 2)).toBe('todo');
  });
});

describe('firstOpenStep (where Continue leads, so the wizard resumes)', () => {
  it('starts at the profile for a brand-new association', () => {
    expect(firstOpenStep(progress([]))).toBe('profile');
  });

  it('picks up at the first step that is neither finished nor skipped', () => {
    expect(firstOpenStep(progress([1], [2]))).toBe('members');
    expect(firstOpenStep(progress([1, 2, 3]))).toBe('finance');
  });

  it('goes to the last step once everything is done or skipped', () => {
    expect(firstOpenStep(progress([1, 2], [3, 4]))).toBe('complete');
  });
});

describe('nextStepKey and finishedCount', () => {
  it('walks the steps in order and stops after the last', () => {
    expect(nextStepKey('profile')).toBe('team');
    expect(nextStepKey('team')).toBe('members');
    expect(nextStepKey('members')).toBe('finance');
    expect(nextStepKey('finance')).toBe('complete');
    expect(nextStepKey('complete')).toBeNull();
  });

  it('counts only the four setup steps that were really finished', () => {
    expect(finishedCount(progress([1, 3, 5]))).toBe(2);
    expect(finishedCount(progress([]))).toBe(0);
  });
});
