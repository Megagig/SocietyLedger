import { useMutation, useQueryClient } from '@tanstack/react-query';

import { aiApi } from '@/api/endpoints/ai';
import { useTenantKey } from '@/hooks/useTenantKey';
import type { AiCreditsDTO, AiReportType, AiStatusDTO, AskPayload } from '@/types/api/ai';
import { aiKeys } from './queries';

/** Every answer comes back with what is left now; put it where the screens read it, so the count moves at once. */
function useShareUsage() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return (usage: AiStatusDTO) => {
    queryClient.setQueryData<AiCreditsDTO>(aiKeys.credits(tenant), (before) => (before ? { ...before, status: usage } : before));
    void queryClient.invalidateQueries({ queryKey: aiKeys.credits(tenant) });
  };
}

/** A failed request costs nothing, but a count that looked wrong should be read again. */
function useRefreshUsage() {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return () => {
    void queryClient.invalidateQueries({ queryKey: aiKeys.credits(tenant) });
  };
}

export function useAskAi() {
  const share = useShareUsage();
  const refresh = useRefreshUsage();
  return useMutation({ mutationFn: (payload: AskPayload) => aiApi.ask(payload), onSuccess: (data) => share(data.usage), onError: refresh });
}

export function useAiReminders() {
  const share = useShareUsage();
  const refresh = useRefreshUsage();
  return useMutation({ mutationFn: () => aiApi.reminders({ limit: 20 }), onSuccess: (data) => share(data.usage), onError: refresh });
}

export function useAiReport() {
  const share = useShareUsage();
  const refresh = useRefreshUsage();
  return useMutation({
    mutationFn: (payload: { reportType: AiReportType; includeRecommendations?: boolean }) => aiApi.report(payload),
    onSuccess: (data) => share(data.usage),
    onError: refresh,
  });
}

export function useStartCreditPurchase() {
  return useMutation({ mutationFn: (credits: number) => aiApi.startPurchase(credits) });
}

/** Asks whether a payment went through. The credits are added by whichever of the webhook and this call comes first. */
export function useVerifyCreditPurchase() {
  const share = useShareUsage();
  return useMutation({
    mutationFn: (reference: string) => aiApi.verifyPurchase(reference),
    onSuccess: (data) => {
      if (data.status === 'success') share(data.usage);
    },
  });
}
