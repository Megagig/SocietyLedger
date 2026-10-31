'use client';

import { useState } from 'react';
import { Button, Textarea } from '@mantine/core';
import { Money } from '@/components/ajo/Money';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay } from '@/lib/ajo/format';
import { useMemberCases, useRespondToCase } from '@/lib/ajo/hooks';
import { toast } from '@/lib/toast';

const STATUS_WORDS: Record<string, string> = { OPEN: 'Open', PLAN_AGREED: 'Repayment plan agreed', RESOLVED: 'Resolved', CLOSED_UNRESOLVED: 'Closed' };

/**
 * A case the officers opened about this person's unpaid rounds: what is outstanding, any repayment plan, and a place to give their own
 * side, which the officers see on the file. Shown only when there is one. A person is never called a defaulter; the case describes a situation.
 */
export function MemberCases({ membershipId, canWrite }: { membershipId: number; canWrite: boolean }) {
  const cases = useMemberCases(membershipId);
  const respond = useRespondToCase();
  const [openId, setOpenId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  if (!cases.data || cases.data.length === 0) return null;

  const send = async (caseId: number) => {
    if (note.trim().length < 3) return setProblem('Write a few words about what happened.');
    try {
      await respond.mutateAsync({ caseId, note: note.trim() });
      toast.success('Your explanation was added to the file.');
      setNote('');
      setOpenId(null);
      setProblem(null);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <section className="space-y-3" aria-label="Cases about you">
      <h2 className="text-lg font-semibold text-ink">Cases about your unpaid rounds</h2>
      <ul className="space-y-3">
        {cases.data.map((c) => (
          <li key={c.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">Opened {formatDay(c.openedAt)}</p>
              <StatusBadge status={c.status} label={STATUS_WORDS[c.status] ?? c.status} />
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              Outstanding when it opened: <Money kobo={c.outstandingAtOpeningKobo} />. Outstanding now: <Money kobo={c.outstandingNowKobo} />.
            </p>
            {c.plans.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {c.plans.map((p) => (
                  <li key={p.id}>
                    Repayment plan: {p.status.toLowerCase()}, {p.schedule.length} payment{p.schedule.length === 1 ? '' : 's'}.
                  </li>
                ))}
              </ul>
            )}
            {c.resolution && <p className="mt-2 text-sm text-ink-soft">Outcome: {c.resolution}</p>}
            {c.memberResponse && <p className="mt-2 text-xs text-ink-faint">Your explanation: {c.memberResponse}</p>}
            {canWrite &&
              (c.status === 'OPEN' || c.status === 'PLAN_AGREED') &&
              (openId === c.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea label="Your side of this" description="The officers read this on the file." minRows={3} autosize maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
                  {problem && (
                    <p role="alert" className="text-sm text-danger">
                      {problem}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={() => {
                        setOpenId(null);
                        setProblem(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button color="green" loading={respond.isPending} onClick={() => send(c.id)}>
                      Send
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  className="mt-3"
                  variant="default"
                  size="xs"
                  onClick={() => {
                    setOpenId(c.id);
                    setNote('');
                  }}
                >
                  Add your explanation
                </Button>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
