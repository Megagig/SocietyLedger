'use client';

import { useState } from 'react';
import { Button } from '@mantine/core';
import { IconCircleCheck, IconAlertTriangle } from '@tabler/icons-react';
import { ajoApi, ajoErrorMessage } from '@/lib/ajo/api';
import { formatMoment } from '@/lib/ajo/format';
import type { OrderCheckDTO, OrderDTO } from '@/lib/ajo/staffTypes';

/**
 * How the payout order was made, in the open: the method, who made it and when, and then either the seed with a button that runs the draw
 * again and says whether it matches (a random draw), or the reason the admin gave (an admin-set order). Shown to every member of the pot
 * on their circle page, and to the officers on Payout order, whether or not the Circle board is on.
 */
export function OrderTransparency({ groupId, order }: { groupId: number; order: OrderDTO }) {
  const [check, setCheck] = useState<OrderCheckDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const random = order.method === 'RANDOM_DRAW';

  const verify = async () => {
    setBusy(true);
    setProblem(null);
    try {
      setCheck(await ajoApi.verifyOrder(groupId));
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-line p-4" aria-label="How the payout order was decided">
      <div>
        <h2 className="text-lg font-semibold text-ink">How the payout order was decided</h2>
        <p className="mt-1 text-sm text-ink-muted">{random ? 'This circle uses an automatic draw. It is random, recorded with its seed, and anyone can check it.' : 'This circle’s admin sets the order by hand and records the reason.'}</p>
      </div>

      {!order.drawn ? (
        <p className="text-sm text-ink-muted">{random ? 'The order has not been drawn yet. It is drawn once everyone has joined, before the circle starts.' : 'The admin has not set the order yet.'}</p>
      ) : random ? (
        <div className="space-y-2 text-sm">
          <p className="text-ink-soft">
            Drawn {formatMoment(order.drawnAt)}
            {order.madeBy ? ` by ${order.madeBy}` : ''}. Seed <code className="rounded bg-surface-muted px-1">{order.seed}</code>
            {order.stale ? ' (out of date: the people changed after this draw)' : ''}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" variant="default" onClick={verify} loading={busy}>
              Verify this draw
            </Button>
            {check && check.matches === true && (
              <span className="inline-flex items-center gap-1 text-success-strong" role="status">
                <IconCircleCheck size={16} /> Matches: running the draw again from the seed gives exactly this order.
              </span>
            )}
            {check && check.matches === false && (
              <span className="inline-flex items-center gap-1 text-danger" role="status">
                <IconAlertTriangle size={16} /> {check.reason}
              </span>
            )}
            {check && check.matches === null && <span className="text-ink-muted">{check.reason}</span>}
          </div>
          {problem && (
            <p role="alert" className="text-danger">
              {problem}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="text-ink-soft">
            Set by <strong>{order.madeBy ?? 'the admin'}</strong> on {formatMoment(order.drawnAt)}
            {order.stale ? ' (out of date: the people changed after this was set)' : ''}.
          </p>
          <p className="rounded-md bg-surface-muted p-3 text-ink-soft">
            <span className="font-medium text-ink">Reason given: </span>
            {order.reason}
          </p>
          <p className="text-xs text-ink-faint">Nothing random backs an order set by hand, so there is no seed to check. The reason above is the basis the group can read.</p>
        </div>
      )}
    </section>
  );
}
