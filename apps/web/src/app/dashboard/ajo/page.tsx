'use client';

import Link from 'next/link';
import { Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { OnboardingResume } from '@/components/ajo/OnboardingResume';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { frequencyText, MODEL_LABEL, formatDay } from '@/lib/ajo/format';
import { useGroups } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';
import { useAjoNav } from '@/lib/ajo/useAjoNav';
import { useAuthStore } from '@/store/authStore';

/** THO1: every group in the association with its status, seats and contribution. */
export default function AjoGroupsPage() {
  const groups = useGroups();
  const { canWrite } = useAjoAccess();
  const { manage } = useAjoCan();
  const nav = useAjoNav();
  const isAdmin = useAuthStore((st) => st.user?.role === 'admin' && !st.user?.platformRole);

  return (
    <div className="space-y-6">
      <OnboardingResume />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink">Thrift circles</h1>
          <p className="mt-1 text-ink-muted">Savings circles run by your association.</p>
        </div>
        {nav.thriftOnly && isAdmin && <Button component={Link} href="/onboarding/thrift?rerun=true" variant="subtle" size="xs">Setup guide</Button>}
        {manage && canWrite && (
          <Button component={Link} href="/dashboard/ajo/new" leftSection={<IconPlus size={16} />} color="green">
            New circle
          </Button>
        )}
      </div>

      {groups.isLoading ? (
        <AjoLoading />
      ) : groups.isError ? (
        <AjoError error={groups.error} onRetry={() => groups.refetch()} />
      ) : groups.data && groups.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Circle</th>
                <th className="px-4 py-2 font-medium">Kind</th>
                <th className="px-4 py-2 text-right font-medium">Each pays</th>
                <th className="px-4 py-2 font-medium">Seats</th>
                <th className="px-4 py-2 font-medium">Starts</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.data.map((g) => (
                <tr key={g.id} className="border-t border-line-soft">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/ajo/${g.id}`} className="font-medium text-success-link hover:underline">
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{MODEL_LABEL[g.model]} · {frequencyText(g)}</td>
                  <td className="px-4 py-3 text-right"><Money kobo={g.contributionKobo} /></td>
                  <td className="px-4 py-3 tabular-nums">{g.seats.taken} of {g.seats.total}</td>
                  <td className="px-4 py-3">{formatDay(g.startDate)}</td>
                  <td className="px-4 py-3"><StatusBadge status={g.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <AjoEmpty title="No circles yet." hint={manage ? 'Create the first circle to start recording contributions.' : 'An officer with permission to manage Ajo creates the circles.'} action={manage && canWrite ? <Button component={Link} href="/dashboard/ajo/new" color="green">New circle</Button> : undefined} />
      )}
    </div>
  );
}
