'use client';

import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { formatDay } from '@/lib/ajo/format';
import { useMyPayouts } from '@/lib/ajo/hooks';

const STATUS_WORDS: Record<string, string> = { PREPARED: 'Being prepared', APPROVED: 'Approved, waiting to be paid', PAID: 'Paid', VOID: 'Cancelled', REVERSED: 'Reversed' };

/** What this person has been, or is about to be, paid: the amount after any collector fee, where it goes (masked), and when. Shown only when there is one. */
export function MyPayouts() {
  const payouts = useMyPayouts();
  if (!payouts.data || payouts.data.length === 0) return null;
  return (
    <section className="space-y-3" aria-label="My payouts">
      <h2 className="text-lg font-semibold text-ink">My payouts</h2>
      <ul className="divide-y divide-line-soft rounded-lg border border-line">
        {payouts.data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">
                <Money kobo={p.netKobo} />
                {p.round ? <span className="text-ink-muted"> · round {p.round}</span> : null}
              </p>
              <p className="text-xs text-ink-muted">
                To {p.account.bankName ?? 'your account'} {p.account.masked}
                {p.paidAt ? ` · paid ${formatDay(p.paidAt)}` : ''}
                {p.paidReference ? ` · reference ${p.paidReference}` : ''}
              </p>
            </div>
            <StatusBadge status={p.status} label={STATUS_WORDS[p.status] ?? p.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
