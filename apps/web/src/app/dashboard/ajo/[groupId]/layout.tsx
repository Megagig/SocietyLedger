'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconArrowLeft } from '@tabler/icons-react';
import { AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { MyMembershipBanner } from '@/components/ajo/MyMembershipBanner';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { frequencyText, MODEL_LABEL } from '@/lib/ajo/format';
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
    { href: `${base}/board`, label: 'Circle board', show: anyOfficer, rotating: true },
    { href: `${base}/order`, label: 'Payout order', show: anyOfficer, rotating: true },
    { href: `${base}/payments`, label: 'Payments', show: manage || reconcile },
    { href: `${base}/handovers`, label: 'Cash handovers', show: manage || reconcile, collector: true },
    { href: `${base}/collectors`, label: 'Collectors', show: manage, collector: true },
    { href: `${base}/cycle`, label: 'Savings cycle', show: anyOfficer, collector: true },
    { href: `${base}/payouts`, label: 'Payouts', show: anyOfficer },
    { href: `${base}/arrears`, label: 'Arrears and cases', show: manage || reconcile || approvePayout },
    { href: `${base}/rules`, label: 'Rules', show: manage },
    { href: `${base}/accountability`, label: 'Accountability', show: anyOfficer },
  ].filter((t) => t.show);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/ajo" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:underline">
          <IconArrowLeft size={14} /> Circles
        </Link>
        {group.isLoading ? (
          <div className="mt-2 h-9 w-64 animate-pulse rounded bg-surface-sunken" />
        ) : group.isError ? (
          <div className="mt-2"><AjoError error={group.error} onRetry={() => group.refetch()} /></div>
        ) : group.data ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-ink">{group.data.name}</h1>
            <StatusBadge status={group.data.status} />
            <span className="text-sm text-ink-muted">{MODEL_LABEL[group.data.model]} · {frequencyText(group.data)}</span>
          </div>
        ) : null}
      </div>

      {group.data && (
        <nav aria-label="Circle sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line">
          {tabs
            .filter((t) => !(t.rotating && group.data.model !== 'ROTATING_POT') && !(t.collector && group.data.model !== 'COLLECTOR_THRIFT'))
            .map((t) => {
              const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
              return (
                <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${active ? 'border-success-solid text-success-link' : 'border-transparent text-ink-muted hover:text-ink'}`}>
                  {t.label}
                </Link>
              );
            })}
        </nav>
      )}

      {group.data && <MyMembershipBanner groupId={groupId} />}

      {group.isLoading ? <AjoLoading /> : group.data ? children : null}
    </div>
  );
}
