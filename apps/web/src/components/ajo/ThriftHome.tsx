'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@mantine/core';
import { IconCash, IconChartBar, IconPigMoney, IconPlus, IconUsers, IconWallet } from '@tabler/icons-react';
import { AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { formatDay, frequencyText } from '@/lib/ajo/format';
import { useMyMemberships } from '@/lib/ajo/hooks';
import { useGroups } from '@/lib/ajo/staffHooks';
import { useAjoNav } from '@/lib/ajo/useAjoNav';
import { useAuthStore } from '@/store/authStore';

const Card = ({ href, icon, title, text }: { href: string; icon: ReactNode; title: string; text: string }) => (
  <Link href={href} className="flex items-start gap-3 rounded-lg border border-line p-4 hover:bg-surface-muted">
    <span className="mt-0.5 text-success-strong">{icon}</span>
    <span>
      <span className="block font-semibold text-ink">{title}</span>
      <span className="block text-sm text-ink-muted">{text}</span>
    </span>
  </Link>
);

const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-lg border border-line p-4">
    <p className="text-sm text-ink-muted">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
  </div>
);

/**
 * The home of a standalone thrift group: what this person runs, collects or pays, and where to go next. A standalone group has no
 * association dashboard (dues, finances, meetings), so this takes its place on both home routes. Entries follow the person's permissions.
 */
export function ThriftHome() {
  const nav = useAjoNav();
  const name = useAuthStore((s) => s.user?.email?.split('@')[0] ?? '');
  const groups = useGroups();
  const mine = useMyMemberships();
  const staff = nav.staff;
  const contributor = nav.member;

  if ((staff && groups.isLoading) || (contributor && mine.isLoading)) return <AjoLoading />;
  if (staff && groups.isError) return <AjoError error={groups.error} onRetry={() => groups.refetch()} />;

  const list = groups.data ?? [];
  const running = list.filter((g) => g.status === 'ACTIVE').length;
  const joining = list.filter((g) => g.status === 'OPEN').length;
  const people = list.reduce((sum, g) => sum + g.seats.taken, 0);
  const circles = (mine.data ?? []).filter((m) => m.status !== 'LEFT');
  const owed = circles.reduce((sum, m) => sum + BigInt(m.overdueKobo || '0'), BigInt(0));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink">Thrift home</h1>
        <p className="mt-1 text-ink-muted">{name ? `Welcome back, ${name}.` : 'Welcome back.'}</p>
      </div>

      {staff && (
        <section className="space-y-3" aria-label="Your circles">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Circles running" value={running} />
            <Stat label="Open for joining" value={joining} />
            <Stat label="People across circles" value={people} />
          </div>
          {list.length === 0 && (
            <div className="rounded-lg border border-line p-5">
              <p className="font-semibold text-ink">No circle yet.</p>
              <p className="mt-1 text-sm text-ink-muted">Create your first circle, add its people, then start it.</p>
              <Button component={Link} href="/dashboard/ajo/new" color="green" className="mt-3" leftSection={<IconPlus size={16} />}>New circle</Button>
            </div>
          )}
        </section>
      )}

      {contributor && (
        <section className="space-y-3" aria-label="Your payments">
          <h2 className="text-lg font-semibold text-ink">Your circles</h2>
          {circles.length === 0 ? (
            <p className="text-sm text-ink-muted">You are not in a circle yet. When an officer adds you, it shows here.</p>
          ) : (
            <>
              {owed > BigInt(0) && <p className="text-sm font-medium text-danger">You are behind by <Money kobo={owed.toString()} /> across your circles.</p>}
              <ul className="space-y-2">
                {circles.map((m) => (
                  <li key={m.membershipId}>
                    <Link href={`/dashboard/my-thrift/${m.membershipId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-4 hover:bg-surface-muted">
                      <span>
                        <span className="block font-semibold text-ink">{m.group.name}</span>
                        <span className="block text-sm text-ink-muted">{frequencyText(m.group)}{m.nextDue ? <> · next payment <Money kobo={m.nextDue.remainingKobo} /> on {formatDay(m.nextDue.dueDate)}</> : ''}</span>
                      </span>
                      <StatusBadge status={m.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="space-y-3" aria-label="Where to next">
        <h2 className="text-lg font-semibold text-ink">Where to next</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff && <Card href="/dashboard/ajo" icon={<IconPigMoney size={22} />} title="Thrift circles" text="Run your circles, payments and payouts." />}
          {nav.collect && <Card href="/dashboard/ajo/collect" icon={<IconCash size={22} />} title="Collect" text="Today's list, cash you record and hand over." />}
          {contributor && <Card href="/dashboard/my-thrift" icon={<IconWallet size={22} />} title="My thrift" text="What you pay, what you are owed and your receipts." />}
          {contributor && <Card href="/dashboard/my-thrift/payout-account" icon={<IconWallet size={22} />} title="Payout account" text="Where your money is sent, and its checks." />}
          {nav.reports && <Card href="/dashboard/ajo/reports" icon={<IconChartBar size={22} />} title="Thrift reports" text="Contributions, collectors, defaults and the audit trail." />}
          {staff && <Card href="/dashboard/members" icon={<IconUsers size={22} />} title="People" text="Everyone in your group, and who can sign in." />}
        </div>
      </section>
    </div>
  );
}
