/** How the setup wizard's progress moves when a step is finished or skipped (pure, so web and mobile are held to the same rules). */
import { ONBOARDING_STEPS, type OnboardingStepKey } from '@societyledger/shared';

export interface ProgressFacts {
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
}

export interface ProgressUpdate {
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  /** The step's own flag (profileCompleted, ...), set only when the step was really finished. */
  flag?: 'profileCompleted' | 'teamInvited' | 'membersImported' | 'financeConfigured';
  /** The last step is finished: the wizard no longer appears. */
  complete: boolean;
}

const FLAG_FOR_STEP: Partial<Record<OnboardingStepKey, NonNullable<ProgressUpdate['flag']>>> = {
  profile: 'profileCompleted',
  team: 'teamInvited',
  members: 'membersImported',
  finance: 'financeConfigured',
};

const asNumbers = (value: unknown): number[] => (Array.isArray(value) ? value.filter((v): v is number => typeof v === 'number') : []);

export function readProgress(row: { currentStep: number; completedSteps: unknown; skippedSteps?: unknown }): ProgressFacts {
  return { currentStep: row.currentStep, completedSteps: asNumbers(row.completedSteps), skippedSteps: asNumbers(row.skippedSteps) };
}

/**
 * Finishing a step marks it done (and no longer skipped). Skipping marks it skipped (and no longer done) without setting the step's
 * flag, so the final checklist can tell "set up" from "skipped". Either way the wizard moves on. The final step always ends the wizard.
 */
export function applyStep(progress: ProgressFacts, step: number, stepName: OnboardingStepKey, skipped: boolean): ProgressUpdate {
  const known = ONBOARDING_STEPS.find((s) => s.id === step && s.key === stepName);
  if (!known) throw new Error(`Step ${step} is not "${stepName}"`);

  const without = (list: number[]) => list.filter((n) => n !== step);
  const completedSteps = skipped ? without(progress.completedSteps) : [...without(progress.completedSteps), step].sort((a, b) => a - b);
  const skippedSteps = skipped ? [...without(progress.skippedSteps), step].sort((a, b) => a - b) : without(progress.skippedSteps);

  return {
    currentStep: Math.max(progress.currentStep, Math.min(step + 1, ONBOARDING_STEPS.length)),
    completedSteps,
    skippedSteps,
    flag: skipped ? undefined : FLAG_FOR_STEP[stepName],
    complete: stepName === 'complete',
  };
}
