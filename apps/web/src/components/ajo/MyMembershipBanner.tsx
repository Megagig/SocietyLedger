'use client';

import Link from 'next/link';
import { Button } from '@mantine/core';
import { useMyMemberships } from '@/lib/ajo/hooks';
import { useAjoNav } from '@/lib/ajo/useAjoNav';

/**
 * An officer is often a member of the same circle. On the officers' pages for a circle, this says so, and when their own membership is still
 * waiting on them (for example to accept the rules) it puts the action right there, instead of leaving it on a different part of the app.
 * Shows nothing when the signed-in person is not in this circle.
 */
export function MyMembershipBanner({ groupId }: { groupId: number }) {
  const nav = useAjoNav();
  const mine = useMyMemberships(nav.member);
  const item = (mine.data ?? []).find((m) => m.group.id === groupId && m.status !== 'LEFT');
  if (!item) return null;
  const base = `/dashboard/my-thrift/${item.membershipId}`;
  const needsRules = item.waitingFor.some((w) => w.requirement === 'RULE_ACCEPTANCE');

  if (item.waitingFor.length > 0) {
    return (
      <section className="space-y-2 rounded-lg border border-warning-line bg-warning-soft p-4" role="status" aria-label="Your own membership">
        <p className="font-semibold text-warning-strong">You are also a member of this circle, and your own membership is not active yet.</p>
        <ul className="list-disc pl-5 text-sm text-warning-strong">
          {item.waitingFor.map((w) => (
            <li key={w.requirement}>{w.text}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {needsRules && (
            <Button component={Link} href={`${base}/rules`} color="green" size="sm">
              Read and accept the rules
            </Button>
          )}
          <Button component={Link} href={base} variant="default" size="sm">
            Open my membership
          </Button>
        </div>
      </section>
    );
  }
  return (
    <p className="text-sm text-ink-muted">
      You are also a member of this circle.{' '}
      <Link href={base} className="font-medium text-success-link underline">
        Open my membership
      </Link>
    </p>
  );
}
