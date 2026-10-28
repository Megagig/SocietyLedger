'use client';

import Link from 'next/link';
import { Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { FREQUENCY_LABEL, MODEL_LABEL, formatDay } from '@/lib/ajo/format';
import { useGroups } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';

/** THO1: every group in the association with its status, seats and contribution. */
export default function AjoGroupsPage() {
  const groups = useGroups();
  const { canWrite } = useAjoAccess();
  const { manage } = useAjoCan();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Thrift groups</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">Savings circles run by your association.</p>
        </div>
        {manage && canWrite && (
          <Button component={Link} href="/dashboard/ajo/new" leftSection={<IconPlus size={16} />} color="green">
            New group
          </Button>
        )}
      </div>

      {groups.isLoading ? (
        <AjoLoading />
      ) : groups.isError ? (
        <AjoError error={groups.error} onRetry={() => groups.refetch()} />
      ) : groups.data && groups.data.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">Group</th>
                <th className="px-4 py-2 font-medium">Kind</th>
                <th className="px-4 py-2 text-right font-medium">Each pays</th>
                <th className="px-4 py-2 font-medium">Seats</th>
                <th className="px-4 py-2 font-medium">Starts</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.data.map((g) => (
                <tr key={g.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/ajo/${g.id}`} className="font-medium text-green-700 hover:underline dark:text-green-400">
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{MODEL_LABEL[g.model]} · {FREQUENCY_LABEL[g.frequency]}</td>
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
        <AjoEmpty title="No groups yet." hint={manage ? 'Create the first group to start recording contributions.' : 'An officer with permission to manage Ajo creates the groups.'} action={manage && canWrite ? <Button component={Link} href="/dashboard/ajo/new" color="green">New group</Button> : undefined} />
      )}
    </div>
  );
}
