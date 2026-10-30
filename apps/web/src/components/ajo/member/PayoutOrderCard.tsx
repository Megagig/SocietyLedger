'use client';

import { useQuery } from '@tanstack/react-query';
import { OrderTransparency } from '@/components/ajo/OrderTransparency';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoApi } from '@/lib/ajo/api';
import { ordinal } from '@/lib/ajo/format';

/**
 * The payout order for one of my rotating pots: where everyone stands, who collects when, and how it was decided (method, who, when, the
 * seed and a button to check a random draw, or the admin's reason). Visible to every member of the pot whether or not the Circle board is on.
 */
export function PayoutOrderCard({ groupId }: { groupId: number }) {
  const order = useQuery({ queryKey: ['ajo', 'order', groupId], queryFn: () => ajoApi.order(groupId), enabled: groupId > 0 });
  if (!order.data) return null;
  const data = order.data;
  return (
    <div className="space-y-4">
      <OrderTransparency groupId={groupId} order={data} />
      {data.drawn && data.slots.length > 0 && (
        <ol className="divide-y divide-line-soft rounded-lg border border-line" aria-label="The payout order">
          {data.slots.map((s) => (
            <li key={s.slotId} className={`flex items-center justify-between gap-3 px-4 py-2 ${s.mine ? 'bg-success-soft' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="w-12 font-semibold tabular-nums">{ordinal(s.position)}</span>
                <span>
                  {s.name}
                  {s.shareNo > 1 ? ` (share ${s.shareNo})` : ''}
                  {s.mine ? ' · you' : ''}
                </span>
              </div>
              {s.paid && <StatusBadge status="PAID" label="Collected" />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
