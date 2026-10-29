'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { GuarantorPublicDTO } from '@/lib/ajo/staffTypes';
import { formatDay } from '@/lib/ajo/format';

const API = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/public/ajo/guarantor`;

type Loaded = { kind: 'loading' } | { kind: 'ready'; data: GuarantorPublicDTO } | { kind: 'refused'; message: string } | { kind: 'done'; memberName: string; groupName: string };

/**
 * THM6: a guarantor opens the link an officer sent, reads exactly what they are agreeing to, and says yes. There is no account and no
 * sign-in: the link is the proof. Looking at the page records nothing; only the button does, and only once the box is ticked.
 */
export default function GuarantorConsentPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<Loaded>({ kind: 'loading' });
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        setState(res.ok ? { kind: 'ready', data: body.data } : { kind: 'refused', message: body.message ?? 'This link could not be opened.' });
      })
      .catch(() => { if (!cancelled) setState({ kind: 'refused', message: 'We could not reach SocietyLedger. Check your connection and open the link again.' }); });
    return () => { cancelled = true; };
  }, [token]);

  const accept = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(`${API}/${encodeURIComponent(token)}/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agreed: true }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setState({ kind: 'done', memberName: body.data?.memberName ?? '', groupName: body.data?.groupName ?? '' });
      else setProblem(body.message ?? 'We could not record your agreement. Please try again.');
    } catch {
      setProblem('We could not reach SocietyLedger. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const shell = (body: React.ReactNode) => (
    <main className="flex min-h-screen items-center justify-center bg-surface-muted p-4">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-lg sm:p-8">{body}</div>
    </main>
  );

  if (state.kind === 'loading') return shell(<p role="status" className="text-center text-ink-muted">Opening your link…</p>);
  if (state.kind === 'refused') return shell(<div role="alert" className="space-y-2 text-center"><h1 className="text-xl font-bold text-ink">This link cannot be used</h1><p className="text-ink-soft">{state.message}</p></div>);
  if (state.kind === 'done') {
    return shell(
      <div className="space-y-2 text-center" role="status">
        <h1 className="text-xl font-bold text-success-link">Thank you. Your agreement is recorded.</h1>
        <p className="text-ink-soft">You are named as guarantor for {state.memberName}{state.groupName ? ` in ${state.groupName}` : ''}. You do not need to do anything else, and you can close this page.</p>
      </div>,
    );
  }

  const d = state.data;
  return shell(
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Guarantor agreement</h1>
        <p className="mt-1 text-sm text-ink-muted">Hello {d.guarantorName}. {d.memberName} has named you ({d.relationship}) as their guarantor in {d.groupName}. Please read this carefully.</p>
      </div>
      <blockquote className="rounded-lg border-l-4 border-success-solid bg-surface-muted p-4 text-ink">{d.wording}</blockquote>
      <label className="flex items-start gap-3 text-sm text-ink-soft">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I have read this, and I agree to be named as guarantor.</span>
      </label>
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
      <button type="button" disabled={!agreed || busy} onClick={accept} className="w-full rounded-lg bg-success-solid px-4 py-3 font-semibold text-on-solid hover:bg-success-hover disabled:opacity-50">{busy ? 'Recording…' : 'I agree'}</button>
      <p className="text-center text-xs text-ink-faint">This link works once and expires on {formatDay(d.expiresAt)}. If you do not know this person, close the page; nothing is recorded unless you press the button.</p>
    </div>,
  );
}
