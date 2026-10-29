'use client';

import { Button, Skeleton } from '@mantine/core';
import { IconAlertTriangle, IconInbox, IconLock } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ajoErrorMessage, ajoErrorStatus } from '@/lib/ajo/api';

/** Placeholder rows while a list loads: skeletons, not a spinner. */
export function AjoLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={72} radius="md" />
      ))}
    </div>
  );
}

export function AjoEmpty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong p-8 text-center">
      <IconInbox size={32} className="mx-auto mb-3 text-ink-subtle" />
      <p className="font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A failed load. A 403/404 reads as "not available to you", anything else offers a retry. */
export function AjoError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = ajoErrorStatus(error);
  const notAllowed = status === 403 || status === 404;
  return (
    <div role="alert" className="rounded-lg border border-danger-line bg-danger-soft p-6 text-center">
      <IconAlertTriangle size={28} className="mx-auto mb-2 text-danger" />
      <p className="font-medium text-danger-strong">{notAllowed ? 'You do not have access to this.' : 'We could not load this.'}</p>
      <p className="mt-1 text-sm text-danger-text">{ajoErrorMessage(error, notAllowed ? 'Ask an officer of your circle if you think this is a mistake.' : 'Check your connection and try again.')}</p>
      {onRetry && !notAllowed && (
        <Button variant="light" color="red" size="xs" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** The add-on is not on this account. There is deliberately no purchase button: an association admin adds it from the website. */
export function AjoLocked() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-line p-8 text-center">
      <IconLock size={32} className="mx-auto mb-3 text-ink-subtle" />
      <p className="text-lg font-semibold text-ink">Ajo isn&apos;t part of your association&apos;s plan.</p>
      <p className="mt-2 text-sm text-ink-muted">Your association admin can add it from the website.</p>
    </div>
  );
}

/** Shown on every Ajo page once the add-on has lapsed: history stays readable, nothing can be changed. */
export function AjoReadOnlyBanner() {
  return (
    <div role="status" className="mb-4 rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-strong">
      <strong>Read-only.</strong> The Ajo add-on has expired. You can still see everything, but nothing can be added or changed until it is renewed.
    </div>
  );
}
