'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { MODEL_LABEL, formatDay } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { useAjoNav } from '@/lib/ajo/useAjoNav';

/**
 * Every circle one person is, or was, in: the circle, their place in it, and what they owe. For officers, on the person's page.
 * Renders nothing when the person is in no circle, or when the viewer does not run circles.
 */
export function PersonCircles({ memberId }: { memberId: number }) {
  const nav = useAjoNav();
  const circles = useQuery({ queryKey: ['ajo', 'staff', 'person-circles', memberId], queryFn: () => ajoStaffApi.personCircles(memberId), enabled: nav.staff && memberId > 0, retry: false });
  if (!nav.staff || !circles.data || circles.data.length === 0) return null;
  return (
    <section className="rounded-xl border border-line p-4 sm:p-6" aria-label="Circles">
      <h2 className="text-lg font-semibold text-ink">Circles</h2>
      <ul className="mt-3 divide-y divide-line-soft">
        {circles.data.map((c) => (
          <li key={c.membershipId} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <Link href={`/dashboard/ajo/${c.group.id}/members`} className="font-medium text-success-link hover:underline">
                {c.group.name}
              </Link>
              <p className="text-xs text-ink-muted">
                {MODEL_LABEL[c.group.model] ?? c.group.model} · started {formatDay(c.group.startDate)}
                {c.payoutPositions.length > 0 ? ` · payout position ${c.payoutPositions.join(', ')}` : ''}
              </p>
              {Number(c.totalOwedKobo) > 0 && (
                <p className="text-xs text-danger">
                  Owes <Money kobo={c.totalOwedKobo} />
                </p>
              )}
            </div>
            <StatusBadge status={c.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
