'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Textarea } from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { ordinal } from '@/lib/ajo/format';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import { usePeople } from '@/lib/ajo/staffHooks';
import type { OrderDTO } from '@/lib/ajo/staffTypes';
import { toast } from '@/lib/toast';

type Place = { membershipId: number; shareNo: number; name: string };

/**
 * The admin places every share by hand: move people up and down, write the reason, save. First in the list is paid first. It starts from the
 * current order if there is one, otherwise from the approved people in the order they joined. Needs the permission to approve payouts.
 */
export function AdminOrderEditor({ groupId, order, rerun }: { groupId: number; order: OrderDTO; rerun: boolean }) {
  const client = useQueryClient();
  const people = usePeople(groupId);
  const [places, setPlaces] = useState<Place[]>([]);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const active = (people.data ?? []).filter((p) => p.status === 'ACTIVE');
    const known = new Map(order.slots.map((s) => [`${s.membershipId}:${s.shareNo}`, s.position]));
    const all: Place[] = active.flatMap((p) => Array.from({ length: p.shares }, (_, i) => ({ membershipId: p.membershipId, shareNo: i + 1, name: p.shares > 1 ? `${p.name} (share ${i + 1})` : p.name })));
    all.sort((a, b) => (known.get(`${a.membershipId}:${a.shareNo}`) ?? 1e6 + a.membershipId) - (known.get(`${b.membershipId}:${b.shareNo}`) ?? 1e6 + b.membershipId));
    setPlaces(all);
  }, [people.data, order.slots]);

  const move = (index: number, by: number) =>
    setPlaces((list) => {
      const next = [...list];
      const target = index + by;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = async () => {
    if (places.length < 2) return setProblem('A rotating pot needs at least 2 shares before the order can be set.');
    if (reason.trim().length < 10) return setProblem('Write the reason or basis for this order, at least 10 characters.');
    setBusy(true);
    setProblem(null);
    try {
      await ajoStaffApi.setOrder(groupId, { order: places.map(({ membershipId, shareNo }) => ({ membershipId, shareNo })), reason: reason.trim() });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success(rerun ? 'The order was set again.' : 'The order was set.');
      setReason('');
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-line p-5" aria-label="Set the payout order">
      <div>
        <h2 className="font-semibold">{rerun ? 'Set the order again' : 'Set the payout order'}</h2>
        <p className="mt-1 text-sm text-ink-muted">You place every share, first in the list is paid first. Every member sees the order, that you set it, and the reason you give.</p>
      </div>
      {order.pendingPeople > 0 && (
        <p className="text-sm text-warning-strong">
          {order.pendingPeople} {order.pendingPeople === 1 ? 'person has' : 'people have'} joined but {order.pendingPeople === 1 ? 'is' : 'are'} not approved yet, so {order.pendingPeople === 1 ? 'they are' : 'they are'} not in this list. Approve everyone first, then set the order once.
        </p>
      )}
      <ol className="divide-y divide-line-soft rounded-lg border border-line">
        {places.map((p, i) => (
          <li key={`${p.membershipId}:${p.shareNo}`} className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="w-12 font-semibold tabular-nums">{ordinal(i + 1)}</span>
              <span>{p.name}</span>
            </div>
            <div className="flex gap-1">
              <Button size="compact-xs" variant="default" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <IconArrowUp size={14} />
              </Button>
              <Button size="compact-xs" variant="default" aria-label={`Move ${p.name} down`} disabled={i === places.length - 1} onClick={() => move(i, 1)}>
                <IconArrowDown size={14} />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Textarea label="Reason or basis for this order" description="For example “agreed at the 12 Nov meeting: by need, then date joined”. Members can read this." autosize minRows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
      {problem && (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      )}
      <Button color="green" onClick={save} loading={busy}>
        {rerun ? 'Save the new order' : 'Save the order'}
      </Button>
    </section>
  );
}
