'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Modal } from '@mantine/core';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { boardSetting } from '@/lib/ajo/boardSetting';
import { formatDay } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useRuleVersions } from '@/lib/ajo/staffHooks';
import { toast } from '@/lib/toast';

/**
 * A rotating pot's Circle board setting, where an officer looks for it: on or off, when a change takes effect, and the way to change it.
 * The setting lives in the rules, so a change is a new version. Once the circle is running it takes effect after the notice period; before
 * it starts, while nobody is paying under the rules, the admin can choose to turn it on or off right now.
 */
export function BoardSettingCard({ groupId, canChange, groupStatus }: { groupId: number; canChange: boolean; groupStatus?: string }) {
  const client = useQueryClient();
  const versions = useRuleVersions(groupId);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!versions.data) return null;
  const s = boardSetting(versions.data.versions);
  const turningOn = s.state === 'OFF' || s.state === 'TURNS_ON';
  const beforeStart = groupStatus === 'DRAFT' || groupStatus === 'OPEN';
  const waiting = s.state === 'TURNS_ON' || s.state === 'TURNS_OFF';
  const words =
    s.state === 'ON'
      ? 'On. Members can see each other’s progress: who has paid, when, who is next and who is behind.'
      : s.state === 'OFF'
        ? 'Off. Members cannot see the circle board; only officers can.'
        : s.state === 'TURNS_ON'
          ? `Off now. It turns on ${formatDay(s.on)}, when the new rules take effect.`
          : `On now. It turns off ${formatDay(s.on)}, when the new rules take effect.`;

  const apply = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await ajoStaffApi.publishRules(groupId, { memberVisibility: turningOn ? 'FULL' : 'OFF' }, { immediate: true });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success(turningOn ? 'The circle board is on. Members have been told.' : 'The circle board is off. Members have been told.');
      setAsking(false);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-line p-4" aria-label="Circle board">
      <h2 className="font-semibold">Circle board</h2>
      <p className="mt-1 text-sm">{words}</p>
      <p className="mt-1 text-xs text-ink-faint">
        {beforeStart
          ? 'The circle has not started, so you can change this right now, or publish it as new rules with the usual 7 days’ notice.'
          : 'This is part of the circle’s rules, so a change is published as a new version and takes effect after 7 days’ notice, once members have been told.'}
      </p>
      {canChange && (
        <div className="mt-2 flex flex-wrap gap-2">
          {beforeStart && (
            <Button size="xs" color="green" onClick={() => setAsking(true)}>
              {turningOn ? 'Turn it on now' : 'Turn it off now'}
            </Button>
          )}
          {!beforeStart || !waiting ? (
            <Button component={Link} href={`/dashboard/ajo/${groupId}/rules`} variant="default" size="xs">
              {turningOn ? 'Turn it on in Rules (with notice)' : 'Change in Rules'}
            </Button>
          ) : null}
        </div>
      )}

      <Modal opened={asking} onClose={() => setAsking(false)} title={turningOn ? 'Turn the circle board on now?' : 'Turn the circle board off now?'} centered>
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            {turningOn
              ? 'The board turns on straight away, with no notice period, because the circle has not started. Members are told. A person’s name shows on the board only after they have accepted rules that include the board; until then they appear as “Member 3”.'
              : 'The board turns off straight away. Members are told. Officers can still see it.'}
          </p>
          {waiting && <p className="text-sm text-ink-muted">A rule change is already waiting. It is brought forward too, so any other change in it takes effect now as well.</p>}
          {problem && (
            <p role="alert" className="text-sm text-danger">
              {problem}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button color="green" onClick={apply} loading={busy}>
              {turningOn ? 'Turn it on now' : 'Turn it off now'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
