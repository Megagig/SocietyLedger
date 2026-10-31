import type { ReactNode } from 'react';

import { AccessState } from '@/components/feedback/AccessState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { useAjoStatus } from '../queries';
import { AjoLoading, AjoReadOnlyBanner } from './AjoStates';

/**
 * Whether the add-on currently allows changes. Write controls check `canWrite`, so a lapsed add-on shows history and nothing else.
 * It reads the same status query the gate uses (React Query shares it), so it works in a screen's own body, above the gate.
 */
export function useAjoWrite(): { readOnly: boolean; canWrite: boolean } {
  const status = useAjoStatus();
  const readOnly = status.data?.kind === 'ok' && status.data.status.readOnly;
  return { readOnly, canWrite: !readOnly };
}

/**
 * Wraps every Ajo screen's body. It asks the API what this account can do with Ajo and draws the matching state: loading, locked
 * (no add-on), not allowed (no Ajo permission), or the screen itself — with a read-only banner when the add-on has lapsed.
 * There is deliberately no purchase button: an association admin adds the add-on from the website (ui-rules.md rule #16).
 */
export function AjoGate({ children }: { children: ReactNode }) {
  const status = useAjoStatus();

  if (status.isPending) return <AjoLoading rows={2} />;
  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />;
  const result = status.data;
  if (result.kind === 'locked') return <AccessState kind="plan" moduleName="Thrift (Ajo)" onRetry={() => status.refetch()} />;
  if (result.kind === 'forbidden') return <AccessState kind="permission" />;

  return (
    <>
      {result.status.readOnly ? <AjoReadOnlyBanner /> : null}
      {children}
    </>
  );
}
