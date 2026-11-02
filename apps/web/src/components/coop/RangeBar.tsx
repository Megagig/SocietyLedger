'use client';

import { Button } from '@mantine/core';
import { useState, type ReactNode } from 'react';

const inputClass =
  'mt-1 h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus';

/** From / To dates with an Apply button. Nothing is fetched until Apply, so typing a date never fires a request per keystroke. */
export function RangeBar({
  from,
  to,
  onApply,
  children,
}: {
  from: string;
  to: string;
  onApply: (range: { from: string; to: string }) => void;
  children?: ReactNode;
}) {
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const invalid = !!draftFrom && !!draftTo && draftFrom > draftTo;

  return (
    <form
      className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) onApply({ from: draftFrom, to: draftTo });
      }}
    >
      <label className="block text-sm font-medium text-ink-soft">
        From
        <input type="date" value={draftFrom} max={draftTo || undefined} onChange={(e) => setDraftFrom(e.target.value)} className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-ink-soft">
        To
        <input type="date" value={draftTo} min={draftFrom || undefined} onChange={(e) => setDraftTo(e.target.value)} className={inputClass} />
      </label>
      <div className="flex items-center gap-2">
        <Button type="submit" color="green" disabled={invalid} className="h-11">
          Apply
        </Button>
        {children}
      </div>
      {invalid && (
        <p role="alert" className="text-sm text-danger-text sm:col-span-3">
          The start date must be on or before the end date.
        </p>
      )}
    </form>
  );
}
