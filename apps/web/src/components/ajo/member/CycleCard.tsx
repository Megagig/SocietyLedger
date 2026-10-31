'use client';

import { useState } from 'react';
import { Button, Radio, TextInput } from '@mantine/core';
import { AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { Money } from '@/components/ajo/Money';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { useCycle, useDecideCycle, useSetAmount } from '@/lib/ajo/cycleHooks';
import { formatDay, formatKobo, koboPositive, nairaToKobo } from '@/lib/ajo/format';
import { toast } from '@/lib/toast';

/**
 * A collector-thrift saver's own cycle (spec §16.5): the amount they chose and keep for the whole cycle, what they brought forward, and,
 * once the cycle is about to end, the choice to withdraw or continue. No answer means withdraw, and the page says so.
 */
export function CycleCard({ membershipId }: { membershipId: number }) {
  const { canWrite } = useAjoAccess();
  const q = useCycle(membershipId);
  const setAmount = useSetAmount(membershipId);
  const decide = useDecideCycle(membershipId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<'WITHDRAW' | 'CONTINUE' | null>(null);
  const [nextText, setNextText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  if (q.isLoading) return <AjoLoading rows={1} />;
  if (q.isError || !q.data) return <AjoError error={q.error} onRetry={() => q.refetch()} />;
  const c = q.data;
  const picked = choice ?? (c.choice === 'PENDING' ? null : c.choice);

  const saveAmount = async () => {
    const kobo = nairaToKobo(text);
    if (kobo === null) return setProblem('Enter the amount in naira, for example 1,000.');
    setProblem(null);
    try {
      await setAmount.mutateAsync(kobo.toString());
      toast.success('Your amount was saved.');
      setEditing(false);
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  const saveChoice = async () => {
    if (!picked) return setProblem('Choose to withdraw or to continue.');
    let nextAmountKobo: string | undefined;
    if (picked === 'CONTINUE') {
      const kobo = nextText.trim() ? nairaToKobo(nextText) : BigInt(c.nextAmountKobo ?? c.amountKobo);
      if (kobo === null) return setProblem('Enter the amount you will save next cycle, in naira.');
      nextAmountKobo = kobo.toString();
    }
    setProblem(null);
    try {
      await decide.mutateAsync({ choice: picked, nextAmountKobo });
      toast.success(picked === 'CONTINUE' ? 'You will continue into the next cycle.' : 'You will withdraw your savings when this cycle ends.');
    } catch (error) {
      setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-line p-5" aria-labelledby="cycle-heading">
      <div>
        <h2 id="cycle-heading" className="text-lg font-semibold text-ink">Your savings cycle</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Cycle {c.cycleNo}: {formatDay(c.startsOn)}
          {c.endsOn ? ` to ${formatDay(c.endsOn)}` : ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-line p-4">
          <p className="text-xs text-ink-faint">You save each time</p>
          <p className="text-xl font-semibold"><Money kobo={c.amountKobo} /></p>
          <p className="mt-1 text-xs text-ink-muted">{c.canChangeAmount ? `You choose this. The smallest is ${formatKobo(c.minAmountKobo)}.` : 'It stays the same for the whole cycle.'}</p>
        </div>
        {koboPositive(c.carriedKobo) && (
          <div className="rounded-lg border border-line p-4">
            <p className="text-xs text-ink-faint">Brought forward from your last cycle</p>
            <p className="text-xl font-semibold"><Money kobo={c.carriedKobo} /></p>
            <p className="mt-1 text-xs text-ink-muted">Your savings after the collector&apos;s fee. It is paid to you with this cycle&apos;s savings.</p>
          </div>
        )}
      </div>

      {canWrite && c.canChangeAmount && !editing && (
        <Button variant="default" size="xs" onClick={() => { setText(''); setEditing(true); }}>Change my amount</Button>
      )}
      {editing && (
        <div className="flex flex-wrap items-end gap-3">
          <TextInput label="New amount each time (₦)" inputMode="decimal" value={text} onChange={(e) => setText(e.currentTarget.value)} />
          <Button color="green" size="sm" loading={setAmount.isPending} onClick={saveAmount}>Save</Button>
          <Button variant="subtle" size="sm" onClick={() => { setEditing(false); setProblem(null); }}>Cancel</Button>
        </div>
      )}

      <div className="space-y-3 border-t border-line pt-4">
        <h3 className="text-base font-semibold text-ink">When this cycle ends</h3>
        {c.payoutStarted ? (
          <p className="text-sm text-ink">Your payout has started, so your choice can no longer change.</p>
        ) : c.canDecide ? (
          <>
            <Radio.Group value={picked ?? ''} onChange={(v) => setChoice(v as 'WITHDRAW' | 'CONTINUE')} name="cycle-choice" label="What would you like to do with your savings?">
              <div className="mt-2 space-y-2">
                <Radio value="WITHDRAW" label="Withdraw them: they are paid to your payout account" />
                <Radio value="CONTINUE" label="Continue into the next cycle: they stay in the circle" />
              </div>
            </Radio.Group>
            {picked === 'CONTINUE' && (
              <TextInput label="What will you save each time next cycle? (₦)" description={`Leave empty to keep ${formatKobo(c.nextAmountKobo ?? c.amountKobo)}.`} inputMode="decimal" value={nextText} onChange={(e) => setNextText(e.currentTarget.value)} className="max-w-xs" />
            )}
            <p className="text-sm text-ink-muted">{c.ifNoAnswer}</p>
            {canWrite && <Button color="green" loading={decide.isPending} onClick={saveChoice}>Save my choice</Button>}
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            {c.promptOpensOn ? `From ${formatDay(c.promptOpensOn)} you can choose whether to withdraw or continue. ` : ''}
            {c.ifNoAnswer}
          </p>
        )}
        {c.choice !== 'PENDING' && !c.payoutStarted && (
          <p className="text-sm text-ink">
            You have chosen to {c.choice === 'CONTINUE' ? `continue, saving ${formatKobo(c.nextAmountKobo ?? c.amountKobo)} each time` : 'withdraw'}
            {c.decidedVia === 'officer' ? ' (recorded for you by an officer)' : ''}.
          </p>
        )}
        {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
      </div>
    </section>
  );
}
