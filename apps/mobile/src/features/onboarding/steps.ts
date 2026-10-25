import { ONBOARDING_STEPS, type OnboardingStepKey } from '@societyledger/shared';

import type { OnboardingProgressDTO } from '@/types/api/onboarding';

export type StepState = 'done' | 'skipped' | 'todo';

/** The docs screen ID for each step (O1–O5), all pointing at the setup-wizard page. */
export const STEP_DOCS_KEY: Record<OnboardingStepKey, string> = { profile: 'O1', finance: 'O2', members: 'O3', team: 'O4', complete: 'O5' };

export function stepStateOf(progress: Pick<OnboardingProgressDTO, 'completedSteps' | 'skippedSteps'>, stepId: number): StepState {
  if (progress.completedSteps.includes(stepId)) return 'done';
  if ((progress.skippedSteps ?? []).includes(stepId)) return 'skipped';
  return 'todo';
}

/** The step after this one, or null after the last. */
export function nextStepKey(key: OnboardingStepKey): OnboardingStepKey | null {
  const index = ONBOARDING_STEPS.findIndex((s) => s.key === key);
  return ONBOARDING_STEPS[index + 1]?.key ?? null;
}

/**
 * Where "Continue" leads when the wizard is opened again: the first step that is neither finished nor skipped, so closing the app halfway
 * and coming back (or starting on the web) picks up where things were left. When every step has been dealt with it is the last one.
 */
export function firstOpenStep(progress: Pick<OnboardingProgressDTO, 'completedSteps' | 'skippedSteps'>): OnboardingStepKey {
  const open = ONBOARDING_STEPS.filter((s) => s.key !== 'complete').find((s) => stepStateOf(progress, s.id) === 'todo');
  return open?.key ?? 'complete';
}

/** How many of the four setup steps (not counting "All done") are finished, for the progress bar. */
export function finishedCount(progress: Pick<OnboardingProgressDTO, 'completedSteps'>): number {
  return ONBOARDING_STEPS.filter((s) => s.key !== 'complete' && progress.completedSteps.includes(s.id)).length;
}
