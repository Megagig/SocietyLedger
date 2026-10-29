'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatKobo } from '@/lib/ajo/format';

const API = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/ajo/statement`;

type Snapshot = { round: number; totalRounds: number; collectedKobo: string; expectedKobo: string; paidCount: number; expectedCount: number; payoutsRecordedCount: number; payoutsRecordedKobo: string; recordedBalanceKobo: string; members: number };
type Verified = { code: string; groupName: string; timezone: string; generatedAt: string; printed: Snapshot; current: Snapshot; matches: boolean };
type Loaded = { kind: 'loading' } | { kind: 'ready'; data: Verified } | { kind: 'refused'; message: string };

const lines = (s: Snapshot) => [
  ['Round', `${s.round} of ${s.totalRounds}`],
  ['Collected this round', `${formatKobo(s.collectedKobo)} of ${formatKobo(s.expectedKobo)} (${s.paidCount} of ${s.expectedCount} paid)`],
  ['Payouts recorded', `${s.payoutsRecordedCount}, ${formatKobo(s.payoutsRecordedKobo)}`],
  ['Recorded balance', formatKobo(s.recordedBalanceKobo)],
];

/**
 * Anyone holding a circle statement can type its code here (or open the link printed on it) and see when it was made and whether the
 * circle's figures still match. It shows circle totals only, never a name, and there is no sign-in.
 */
export default function VerifyCircleStatementPage() {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<Loaded>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/${encodeURIComponent(code)}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        setState(res.ok ? { kind: 'ready', data: body.data } : { kind: 'refused', message: body.message ?? 'That code was not found.' });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'refused', message: 'We could not reach SocietyLedger. Check your connection and try again.' }); });
    return () => { cancelled = true; };
  }, [code]);

  const shell = (body: React.ReactNode) => (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="w-full max-w-xl rounded-2xl bg-surface p-6 shadow-lg sm:p-8">{body}</div>
    </main>
  );

  if (state.kind === 'loading') return shell(<p role="status" className="text-center text-ink-muted">Checking the code…</p>);
  if (state.kind === 'refused') return shell(<div role="alert" className="space-y-2 text-center"><h1 className="text-xl font-bold text-ink">We could not find that statement</h1><p className="text-ink-soft">{state.message}</p></div>);

  const d = state.data;
  const made = new Date(d.generatedAt).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: d.timezone });
  return shell(
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-muted">Circle statement {d.code}</p>
        <h1 className="text-2xl font-bold text-ink">{d.groupName}</h1>
        <p className="text-sm text-ink-muted">Made {made} ({d.timezone})</p>
      </div>
      <p role="status" className={`rounded-lg p-3 text-sm ${d.matches ? 'bg-success-soft text-success-strong' : 'bg-warning-soft text-warning-strong'}`}>
        {d.matches ? 'This statement matches the circle’s record today.' : 'The circle’s record has changed since this statement was made. That is normal: payments are confirmed and payouts recorded all the time. The figures below show both.'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {([['On the statement', d.printed], ['In the record now', d.current]] as const).map(([title, s]) => (
          <section key={title} className="space-y-2 rounded-lg border border-line p-4">
            <h2 className="font-semibold text-ink">{title}</h2>
            <dl className="space-y-1 text-sm">
              {lines(s).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-ink-faint">{k}</dt><dd className="text-ink">{v}</dd></div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="text-xs text-ink-faint">From SocietyLedger records. Your group&apos;s bank statement is the final word. This page shows circle totals only, never a person&apos;s name.</p>
    </div>,
  );
}
