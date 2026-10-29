import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useTenantKey } from '@/hooks/useTenantKey';
import { ajoKeys } from './queries';

/**
 * Any write refreshes every Ajo screen, which is cheap and never shows a stale balance. A money-recording write that failed halfway
 * still refreshes (`onSettled`) so the screen shows what really happened. The screen passes the API call, so each one keeps its
 * own typed input and result.
 *
 * `networkMode: 'always'` on purpose: by default TanStack pauses a mutation made offline and replays it later. Ajo never queues
 * money for later — offline, the call fails at once with "You're offline" and the person is told to try again with internet.
 */
export function useAjoAction<Input, Output = unknown>(fn: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  const tenant = useTenantKey();
  return useMutation({
    mutationFn: fn,
    networkMode: 'always',
    onSettled: () => queryClient.invalidateQueries({ queryKey: ajoKeys.all(tenant) }),
  });
}
