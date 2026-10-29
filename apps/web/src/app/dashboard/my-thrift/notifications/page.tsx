'use client';

import Link from 'next/link';
import { Switch } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { ajoErrorMessage } from '@/lib/ajo/api';
import api from '@/lib/axios';
import { toast } from '@/lib/toast';

type Prefs = { roundFunded: boolean; payoutRecorded: boolean; yourTurn: boolean; weeklySummary: boolean };
type Envelope<T> = { success: boolean; data: T };
const KEY = ['ajo', 'notification-preferences'] as const;

const CHOICES: Array<{ key: keyof Prefs; label: string; hint: string }> = [
  { key: 'roundFunded', label: 'When a round is fully paid', hint: 'For example: “Round 4 is fully paid. Musa I. receives ₦100,000.00 on 31 Oct.”' },
  { key: 'payoutRecorded', label: 'When a payout is recorded', hint: 'For example: “Payout to Musa I. was recorded as paid.”' },
  { key: 'yourTurn', label: 'When your turn is two rounds away', hint: 'For example: “Your turn is in 2 rounds (31 Dec).”' },
  { key: 'weeklySummary', label: 'A weekly summary of the circle', hint: 'Off unless you turn it on. Sent on Mondays: how many have paid, how many are behind, and when the next payout is.' },
];

/** A member's choices about circle notifications (spec §16.4.9). A reminder about your own overdue payment is not here: it always reaches you. */
export default function CircleNotificationsPage() {
  const client = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: async () => ((await api.get('/ajo/notification-preferences')) as { data: Envelope<Prefs> }).data.data });
  const save = useMutation({
    mutationFn: async (change: Partial<Prefs>) => ((await api.put('/ajo/notification-preferences', change)) as { data: Envelope<Prefs> }).data.data,
    onSuccess: (data) => client.setQueryData(KEY, data),
    onError: (error) => toast.error(ajoErrorMessage(error, 'Could not save that choice.')),
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/my-thrift" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:underline">
          <IconArrowLeft size={14} /> My circles
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-ink">Circle notifications</h1>
        <p className="mt-1 text-ink-muted">Choose what you are told about the circles you are in. Each one can be switched off.</p>
      </div>
      {q.isLoading ? (
        <AjoLoading rows={4} />
      ) : q.isError || !q.data ? (
        <AjoError error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <ul className="divide-y divide-line-soft rounded-lg border border-line">
          {CHOICES.map((c) => (
            <li key={c.key} className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-ink">{c.label}</p>
                <p className="text-sm text-ink-muted">{c.hint}</p>
              </div>
              <Switch aria-label={c.label} checked={(q.data as Prefs)[c.key]} disabled={save.isPending} onChange={(e) => save.mutate({ [c.key]: e.currentTarget.checked })} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-ink-muted">Reminders about your own payments, and notices from your circle&apos;s officers, are not affected by these choices.</p>
    </div>
  );
}
