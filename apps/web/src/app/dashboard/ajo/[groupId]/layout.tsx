'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconArrowLeft } from '@tabler/icons-react';
import { AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { FREQUENCY_LABEL, MODEL_LABEL } from '@/lib/ajo/format';
import { useGroupDetail } from '@/lib/ajo/staffHooks';
import { useAjoCan } from '@/lib/ajo/useAjoCan';

/** The workspace around one group: its name and status, and the tabs this person may use. The server checks every action again. */
export default function GroupWorkspaceLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId) || 0;
  const pathname = usePathname();
  const group = useGroupDetail(groupId);
  const { manage, reconcile, approvePayout, anyOfficer } = useAjoCan();
  const base = `/dashboard/ajo/${groupId}`;

  const tabs = [
    { href: base, label: 'Overview', show: true },
    { href: `${base}/members`, label: 'Members', show: manage },
    { href: `${base}/order`, label: 'Payout order', show: anyOfficer, rotating: true },
    { href: `${base}/payments`, label: 'Payments', show: manage || reconcile },
    { href: `${base}/handovers`, label: 'Cash handovers', show: manage || reconcile, collector: true },
    { href: `${base}/collectors`, label: 'Collectors', show: manage, collector: true },
    { href: `${base}/payouts`, label: 'Payouts', show: anyOfficer },
    { href: `${base}/arrears`, label: 'Arrears and cases', show: manage || reconcile || approvePayout },
    { href: `${base}/rules`, label: 'Rules', show: manage },
  ].filter((t) => t.show);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/ajo" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:underline dark:text-gray-400">
          <IconArrowLeft size={14} /> Groups
        </Link>
        {group.isLoading ? (
          <div className="mt-2 h-9 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        ) : group.isError ? (
          <div className="mt-2"><AjoError error={group.error} onRetry={() => group.refetch()} /></div>
        ) : group.data ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{group.data.name}</h1>
            <StatusBadge status={group.data.status} />
            <span className="text-sm text-gray-600 dark:text-gray-400">{MODEL_LABEL[group.data.model]} · {FREQUENCY_LABEL[group.data.frequency]}</span>
          </div>
        ) : null}
      </div>

      {group.data && (
        <nav aria-label="Group sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          {tabs
            .filter((t) => !(t.rotating && group.data.model !== 'ROTATING_POT') && !(t.collector && group.data.model !== 'COLLECTOR_THRIFT'))
            .map((t) => {
              const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${active ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}`}>
                  {t.label}
                </Link>
              );
            })}
        </nav>
      )}

      {group.isLoading ? <AjoLoading /> : group.data ? children : null}
    </div>
  );
}
