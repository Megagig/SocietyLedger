import type { OnboardingTeamInviteInput } from '@societyledger/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { onboardingApi } from '@/api/endpoints/onboarding';
import { useTenantKey } from '@/hooks/useTenantKey';
import { sessionKeys } from '@/features/session/queries';
import { useSessionStore } from '@/stores/session';
import type { CompleteStepPayload } from '@/types/api/onboarding';
import { onboardingKeys } from './queries';

function useInvalidateStatus() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: onboardingKeys.all(tenant) });
  };
}

/** Finish or skip one step; the wizard moves on and the overview shows the step as done or skipped. */
export function useCompleteStep() {
  const invalidate = useInvalidateStatus();
  return useMutation({ mutationFn: (payload: CompleteStepPayload) => onboardingApi.completeStep(payload), onSuccess: invalidate });
}

/**
 * Ends the wizard: either the last step ("All done") or "Skip setup for now". Afterwards the session no longer asks for setup, so the
 * guard in `(app)/_layout` stops sending the admin back to it, and the cached `/auth/me` is refreshed.
 */
export function useLeaveSetup() {
  const invalidate = useInvalidateStatus();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skipAll }: { skipAll: boolean }) =>
      skipAll ? onboardingApi.skipAll() : onboardingApi.completeStep({ step: 5, stepName: 'complete' }),
    onSuccess: () => {
      const { user, setUser } = useSessionStore.getState();
      if (user) setUser({ ...user, requiresOnboarding: false });
      void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
      invalidate();
    },
  });
}

export function useInviteTeam() {
  const invalidate = useInvalidateStatus();
  return useMutation({ mutationFn: (payload: OnboardingTeamInviteInput) => onboardingApi.inviteTeam(payload), onSuccess: invalidate });
}
