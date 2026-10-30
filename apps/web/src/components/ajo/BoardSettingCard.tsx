'use client';

import Link from 'next/link';
import { Button } from '@mantine/core';
import { boardSetting } from '@/lib/ajo/boardSetting';
import { formatDay } from '@/lib/ajo/format';
import { useRuleVersions } from '@/lib/ajo/staffHooks';

/**
 * A rotating pot's Circle board setting, where an officer looks for it: on or off, when a change takes effect, and the way to change it.
 * The setting lives in the rules, so changing it is publishing a new version, which takes effect after the notice period.
 */
export function BoardSettingCard({ groupId, canChange }: { groupId: number; canChange: boolean }) {
  const versions = useRuleVersions(groupId);
  if (!versions.data) return null;
  const s = boardSetting(versions.data.versions);
  const words =
    s.state === 'ON'
      ? 'On. Members can see each other’s progress: who has paid, when, who is next and who is behind.'
      : s.state === 'OFF'
        ? 'Off. Members cannot see the circle board; only officers can.'
        : s.state === 'TURNS_ON'
          ? `Off now. It turns on ${formatDay(s.on)}, when the new rules take effect.`
          : `On now. It turns off ${formatDay(s.on)}, when the new rules take effect.`;
  return (
    <section className="rounded-lg border border-line p-4" aria-label="Circle board">
      <h2 className="font-semibold">Circle board</h2>
      <p className="mt-1 text-sm">{words}</p>
      <p className="mt-1 text-xs text-ink-faint">This is part of the circle&apos;s rules, so a change is published as a new version and takes effect after 7 days&apos; notice, once members have been told.</p>
      {canChange && (
        <Button component={Link} href={`/dashboard/ajo/${groupId}/rules`} variant="default" size="xs" className="mt-2">
          {s.state === 'OFF' || s.state === 'TURNS_OFF' ? 'Turn it on in Rules' : 'Change in Rules'}
        </Button>
      )}
    </section>
  );
}
