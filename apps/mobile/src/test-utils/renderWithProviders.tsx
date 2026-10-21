import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, type RenderHookOptions, type RenderHookResult } from '@testing-library/react-native';

/**
 * F2.2's `useLogin`/`useVerifyEmail`/`useResendVerification` tests are this app's first
 * `@tanstack/react-query` hook tests — each needs a `QueryClientProvider` ancestor, and a fresh
 * `QueryClient` per test (one reused across renders leaks retry/gc timers into the next test,
 * the Jest "did not exit" warning this was built to fix). Returns the client too, so the caller's
 * own `afterEach` can `.clear()` it.
 *
 * Deliberately QueryClient-only, not the full theme/safe-area/bottom-sheet wrapper
 * `library-docs.md` previously (and wrongly — it was never built) described: rendering
 * `ThemeProvider` pulls in NativeWind's `useColorScheme`, which goes through the same
 * `react-native-css-interop` web-runtime path that already crashes under Jest for any
 * icon-rendering component (`ui-registry.md`'s "Dev tooling & known gaps (F1.4)") — adding it
 * here untested would just extend that same crash to every caller of this helper. Build that
 * version when a feature actually needs to RTL-render a themed component, not speculatively.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export async function renderHookWithQueryClient<TResult, TProps>(
  callback: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'>,
): Promise<RenderHookResult<TResult, TProps> & { queryClient: QueryClient }> {
  const queryClient = createTestQueryClient();
  function wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  const result = await renderHook(callback, { ...options, wrapper });
  return { ...result, queryClient };
}
