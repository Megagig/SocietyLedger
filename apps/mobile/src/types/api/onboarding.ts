/** `modules/onboarding` — verified against onboarding.controller.ts (2026-11-03). */
import type { OnboardingStepKey } from '@societyledger/shared';

import type { IsoDateString } from './common';

export type OnboardingProgressDTO = {
  id: number;
  currentStep: number;
  completedSteps: number[];
  /** Steps the admin chose to skip, kept apart from the ones they finished. Absent on rows saved before this existed. */
  skippedSteps?: number[];
  profileCompleted: boolean;
  teamInvited: boolean;
  membersImported: boolean;
  financeConfigured: boolean;
  onboardingComplete: boolean;
  skippedAt: IsoDateString | null;
};

/** GET /onboarding/status */
export type OnboardingStatusDTO = {
  onboarding: OnboardingProgressDTO;
  association: { id: number; name: string; logo: string | null; primaryColor: string | null; _count: { users: number; members: number } } | null;
  /** THRIFT for a standalone thrift group, which has its own five-step wizard. */
  flow?: 'ASSOCIATION' | 'THRIFT';
  context: { hasLogo: boolean; hasTeamMembers: boolean; hasMembers: boolean; hasFinancialSetup: boolean; hasBankAccount?: boolean };
};

/** PATCH /onboarding/complete-step */
export type CompleteStepPayload = { step: number; stepName: OnboardingStepKey; skipped?: boolean };

export type TeamInviteStatus = 'invited' | 'invited_email_failed' | 'already_member' | 'failed';

/** POST /onboarding/team */
export type TeamInviteResultDTO = { results: { email: string; status: TeamInviteStatus; message?: string }[] };
