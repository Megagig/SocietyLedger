'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import { GroupWizard } from '@/components/ajo/GroupWizard';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { frequencyText, MODEL_LABEL, formatKobo } from '@/lib/ajo/format';
import type { GroupListItemDTO } from '@/lib/ajo/staffTypes';

/**
 * Step 2: the first circle, made with the same wizard as Ajo's "New circle". If the admin already has one (they skipped earlier and came
 * back) they are asked whether to use it, so setup never makes a second circle by accident.
 */
export function StepCircle({ existing, chosenId, onChoose, onCreated, onSkip }: { existing: GroupListItemDTO[]; chosenId: number | null; onChoose: (id: number) => void; onCreated: (id: number) => Promise<void>; onSkip: () => Promise<void> }) {
  const [makingAnother, setMakingAnother] = useState(false);
  const [busy, setBusy] = useState(false);
  const usable = existing.filter((g) => g.status !== 'CANCELLED' && g.status !== 'COMPLETED');
  const current = usable.find((g) => g.id === chosenId) ?? usable[0];

  if (current && !makingAnother) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-line p-4">
          <p className="text-sm text-ink-muted">You already have</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{current.name}</p>
            <StatusBadge status={current.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">{MODEL_LABEL[current.model]} · {frequencyText(current)} · {formatKobo(current.contributionKobo)} each</p>
        </div>
        {usable.length > 1 && (
          <select aria-label="Choose a circle" className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2" value={current.id} onChange={(e) => onChoose(Number(e.target.value))}>
            {usable.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="default" onClick={() => setMakingAnother(true)}>Create another circle</Button>
          <Button color="green" loading={busy} onClick={() => { setBusy(true); onCreated(current.id).finally(() => setBusy(false)); }}>Use {current.name}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <GroupWizard examples onCreated={(g) => { setMakingAnother(false); void onCreated(g.id); }} />
      <div className="flex justify-between">
        {current ? <Button variant="subtle" onClick={() => setMakingAnother(false)}>Use the circle I already have</Button> : <span />}
        <Button variant="subtle" onClick={() => { setBusy(true); onSkip().finally(() => setBusy(false)); }} disabled={busy}>Skip this step</Button>
      </div>
    </div>
  );
}
