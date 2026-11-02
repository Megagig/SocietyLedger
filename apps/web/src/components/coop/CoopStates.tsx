'use client';

import { Button, Skeleton } from '@mantine/core';
import { IconAlertTriangle, IconInbox } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { coopErrorMessage, coopErrorStatus } from '@/lib/coop/api';

/** Placeholder rows while a page loads: skeletons, not a spinner. */
export function CoopLoading({ rows = 3, height = 72 }: { rows?: number; height?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={height} radius="md" />
      ))}
    </div>
  );
}

export function CoopEmpty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
      <IconInbox size={32} className="mx-auto mb-3 text-ink-subtle" />
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A failed load. A 403/404 reads as "not available to you"; anything else offers a retry. */
export function CoopError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = coopErrorStatus(error);
  const notAllowed = status === 403 || status === 404;
  return (
    <div role="alert" className="rounded-lg border border-danger-line bg-danger-soft p-6 text-center">
      <IconAlertTriangle size={28} className="mx-auto mb-2 text-danger" />
      <p className="font-medium text-danger-strong">{notAllowed ? 'This is not available to you.' : 'We could not load this.'}</p>
      <p className="mt-1 text-sm text-danger-text">
        {coopErrorMessage(error, notAllowed ? 'Ask an officer of your cooperative if you think this is a mistake.' : 'Check your connection and try again.')}
      </p>
      {onRetry && !notAllowed && (
        <Button variant="light" color="red" size="xs" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
