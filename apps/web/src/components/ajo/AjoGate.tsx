'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAjoStatus } from '@/lib/ajo/hooks';
import { AjoError, AjoLoading, AjoLocked, AjoReadOnlyBanner } from './AjoStates';

type AjoAccessValue = { readOnly: boolean; canWrite: boolean };

const AjoAccessContext = createContext<AjoAccessValue>({ readOnly: false, canWrite: true });

/** Whether the add-on currently allows changes. Write controls check `canWrite`, so a lapsed add-on shows history and nothing else. */
export const useAjoAccess = () => useContext(AjoAccessContext);

/**
 * Wraps every Ajo page. It asks the API what this account can do with Ajo and draws the matching state: loading, locked (no add-on),
 * not allowed (no Ajo permission), or the page itself, with a read-only banner when the add-on has lapsed.
 */
export function AjoGate({ children }: { children: ReactNode }) {
  const status = useAjoStatus();

  if (status.isLoading) return <AjoLoading rows={2} />;
  if (status.isError) return <AjoError error={status.error} onRetry={() => status.refetch()} />;
  const result = status.data;
  if (!result || result.kind === 'locked') return <AjoLocked />;
  if (result.kind === 'forbidden') {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-lg border border-line p-8 text-center">
        <p className="text-lg font-semibold text-ink">You do not have access to Ajo.</p>
        <p className="mt-2 text-sm text-ink-muted">Ask an officer of your association to give you access.</p>
      </div>
    );
  }

  const readOnly = result.status.readOnly;
  return (
    <AjoAccessContext.Provider value={{ readOnly, canWrite: !readOnly }}>
      {readOnly && <AjoReadOnlyBanner />}
      {children}
    </AjoAccessContext.Provider>
  );
}
