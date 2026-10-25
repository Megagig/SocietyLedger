import type { OnboardingTeamInviteInput } from '@societyledger/shared';

import { client } from '../client';
import { unwrap } from '../envelope';
import type { CompleteStepPayload, OnboardingProgressDTO, OnboardingStatusDTO, TeamInviteResultDTO } from '@/types/api/onboarding';

/** The new association's setup wizard. Every route is admin-only on the server. */
export const onboardingApi = {
  /** GET /onboarding/status — creates the progress row on first read. */
  async getStatus(): Promise<OnboardingStatusDTO> {
    return unwrap<OnboardingStatusDTO>(client.get('/onboarding/status'));
  },

  /** PATCH /onboarding/complete-step — `skipped: true` records the step as skipped, not finished. Step 5 ('complete') ends the wizard. */
  async completeStep(payload: CompleteStepPayload): Promise<OnboardingProgressDTO> {
    return unwrap<OnboardingProgressDTO>(client.patch('/onboarding/complete-step', payload));
  },

  /** POST /onboarding/skip — leave the whole wizard for now; it will not appear again. */
  async skipAll(): Promise<OnboardingProgressDTO> {
    return unwrap<OnboardingProgressDTO>(client.post('/onboarding/skip', {}));
  },

  /** POST /onboarding/team — one request for everyone; the answer says what happened to each person (always 201). */
  async inviteTeam(payload: OnboardingTeamInviteInput): Promise<TeamInviteResultDTO> {
    return unwrap<TeamInviteResultDTO>(client.post('/onboarding/team', payload));
  },
};
