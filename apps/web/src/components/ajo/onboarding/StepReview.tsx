'use client';

import { useState } from 'react';
import { Button, Modal } from '@mantine/core';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { FREQUENCY_LABEL, MODEL_LABEL, formatDay, formatKobo } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { GroupDetailDTO, RosterPersonDTO, RuleVersionDTO } from '@/lib/ajo/staffTypes';

type Progress = { completed: number[]; skipped: number[] };

function Row({ label, state, children, onFix }: { label: string; state: 'done' | 'skipped' | 'attention'; children: React.ReactNode; onFix: () => void }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{children}</div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={state === 'done' ? 'CONFIRMED' : state === 'skipped' ? 'WAIVED' : 'OVERDUE'} label={state === 'done' ? 'Done' : state === 'skipped' ? 'Skipped' : 'Needs attention'} />
        <Button size="compact-xs" variant="subtle" onClick={onFix}>{state === 'done' ? 'Change' : 'Fix'}</Button>
      </div>
    </li>
  );
}

/** Step 5: what is set up, what is missing, what happens next, and the choice to open the circle now or keep it as a draft. */
export function StepReview({ group, roster, rules, progress, groupName, onFix, onFinish }: {
  group: GroupDetailDTO | undefined;
  roster: RosterPersonDTO[];
  rules: RuleVersionDTO | undefined;
  progress: Progress;
  groupName: string;
  onFix: (step: number) => void;
  onFinish: (groupId: number | null, opened: boolean) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const state = (step: number, ok: boolean): 'done' | 'skipped' | 'attention' => (ok && progress.completed.includes(step) ? 'done' : progress.skipped.includes(step) ? 'skipped' : ok ? 'done' : 'attention');
  const live = roster.filter((p) => p.status !== 'LEFT');
  const approved = live.filter((p) => p.approvedAt).length;
  const active = live.filter((p) => p.status === 'ACTIVE').length;
  const draft = group?.status === 'DRAFT';

  const finish = async (open: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      if (open && group) await ajoStaffApi.openGroup(group.id);
      await onFinish(group?.id ?? null, open);
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'We could not finish. Please try again.'));
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        <Row label="Group profile" state={state(1, true)} onFix={() => onFix(1)}>{groupName}</Row>
        <Row label="Circle" state={state(2, !!group)} onFix={() => onFix(2)}>
          {group ? (
            <>
              <p>{group.name}: {MODEL_LABEL[group.model]}, {formatKobo(group.contributionKobo)} {FREQUENCY_LABEL[group.frequency].toLowerCase()}, starting {formatDay(group.startDate)}.</p>
              <p>{group.model === 'ROTATING_POT' ? `${group.rounds ?? 'Several'} rounds` : `${group.cycleLength ?? '—'} payments`} · collector fee {group.collectorFee.type === 'NONE' ? 'none' : group.collectorFee.type === 'FIXED' ? formatKobo(group.collectorFee.value) : group.collectorFee.type === 'PERCENT' ? `${Number(group.collectorFee.value) / 100}%` : `${group.collectorFee.value} day(s) of contribution`}</p>
              <p>Group account: {group.bankAccount ? `${group.bankAccount.bankName} ${group.bankAccount.masked}` : 'not added yet'}</p>
              {rules && <ul className="mt-1 list-disc pl-5">{rules.summary.slice(0, 4).map((l) => <li key={l}>{l}</li>)}</ul>}
            </>
          ) : 'No circle yet.'}
        </Row>
        <Row label="Contributors" state={state(3, live.length > 0)} onFix={() => onFix(3)}>{live.length} added · {approved} approved · {active} active</Row>
        <Row label="Team and collectors" state={progress.completed.includes(4) ? 'done' : 'skipped'} onFix={() => onFix(4)}>{progress.completed.includes(4) ? 'Invites sent.' : 'Nobody invited yet. You can do it from Settings later.'}</Row>
      </ul>

      <div>
        <h3 className="font-semibold">What happens next</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>Open the circle so your contributors can see it and accept the rules.</li>
          <li>SocietyLedger checks each person&apos;s name, phone, address and payout account. Nobody can be paid out until they are verified.</li>
          <li>Start the circle on {group ? formatDay(group.startDate) : 'its start date'}.</li>
          <li>Record contributions as they come in. Every contributor gets a receipt.</li>
        </ol>
        <p className="mt-2 text-xs text-gray-500">Your group&apos;s money stays in your own bank account. SocietyLedger keeps the records.</p>
      </div>

      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="default" onClick={() => void finish(false)} loading={busy && !confirming}>{group ? 'Keep as draft and go to Ajo' : 'Go to Ajo'}</Button>
        {draft && group && <Button color="green" onClick={() => setConfirming(true)}>Open {group.name}</Button>}
      </div>

      <Modal opened={confirming} onClose={() => !busy && setConfirming(false)} title={`Open ${group?.name ?? 'the circle'}?`} centered>
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">Contributors will see the circle and its rules. If you change the rules later, a new version is saved and applies from then on. People you have already approved become active now.</p>
          <div className="flex justify-end gap-2"><Button variant="default" onClick={() => setConfirming(false)} disabled={busy}>Not yet</Button><Button color="green" onClick={() => void finish(true)} loading={busy}>Open the circle</Button></div>
        </div>
      </Modal>
    </div>
  );
}
