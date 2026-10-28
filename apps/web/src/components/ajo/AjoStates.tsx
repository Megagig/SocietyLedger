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
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
      <IconInbox size={32} className="mx-auto mb-3 text-gray-400" />
      <p className="font-medium text-gray-900 dark:text-gray-100">{title}</p>
      {hint && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** A failed load. A 403/404 reads as "not available to you", anything else offers a retry. */
export function AjoError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = ajoErrorStatus(error);
  const notAllowed = status === 403 || status === 404;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30">
      <IconAlertTriangle size={28} className="mx-auto mb-2 text-red-600" />
      <p className="font-medium text-red-800 dark:text-red-200">{notAllowed ? 'You do not have access to this.' : 'We could not load this.'}</p>
      <p className="mt-1 text-sm text-red-700 dark:text-red-300">{ajoErrorMessage(error, notAllowed ? 'Ask an officer of your group if you think this is a mistake.' : 'Check your connection and try again.')}</p>
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
    <div className="mx-auto max-w-md rounded-lg border border-gray-200 p-8 text-center dark:border-gray-700">
      <IconLock size={32} className="mx-auto mb-3 text-gray-400" />
      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ajo isn&apos;t part of your association&apos;s plan.</p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Your association admin can add it from the website.</p>
    </div>
  );
}

/** Shown on every Ajo page once the add-on has lapsed: history stays readable, nothing can be changed. */
export function AjoReadOnlyBanner() {
  return (
    <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <strong>Read-only.</strong> The Ajo add-on has expired. You can still see everything, but nothing can be added or changed until it is renewed.
    </div>
  );
}
