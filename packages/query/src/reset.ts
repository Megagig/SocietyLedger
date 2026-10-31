/**
 * Forget everything that was cached for the person who is leaving. Run on logout, on switching association, and when the refresh token fails.
 * Clears the in-memory cache and the saved copy, and stops requests still in flight so a late answer cannot refill it.
 */
import type { QueryClient } from '@tanstack/react-query';

export interface RemovablePersister {
  removeClient: () => void | Promise<void>;
}

export async function resetClientCache(queryClient: QueryClient, persister?: RemovablePersister | null): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.getMutationCache().clear();
  queryClient.clear();
  if (persister) await persister.removeClient();
}
