'use client';

import { useState } from 'react';
import { Button, TextInput } from '@mantine/core';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { StatusBadge } from '@/components/ajo/StatusBadge';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatMoment } from '@/lib/ajo/format';
import { usePayoutAccount, useSavePayoutAccount, useVerification } from '@/lib/ajo/hooks';
import { toast } from '@/lib/toast';

/** THM5: where the circle pays you when it is your turn. Only the last four digits are ever shown back. */
export default function PayoutAccountPage() {
  const { canWrite } = useAjoAccess();
  const account = usePayoutAccount();
  const verification = useVerification();
  const save = useSavePayoutAccount();
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  if (account.isLoading) return <AjoLoading rows={2} />;
  if (account.isError) return <AjoError error={account.error} onRetry={() => account.refetch()} />;
  const current = account.data;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{10}$/.test(accountNumber.replace(/\s/g, ''))) return setProblem('A bank account number has 10 digits.');
    setProblem(null);
    try {
      const result = await save.mutateAsync({ bankName: bankName.trim(), accountNumber: accountNumber.replace(/\s/g, ''), accountName: accountName.trim() });
      toast.success(result.replayed ? 'Nothing changed.' : 'Payout account saved.');
      setAccountNumber('');
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'Could not save your payout account.'));
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">My payout account</h1>
        <p className="mt-1 text-ink-muted">This is where your circle pays you when it is your turn to collect. Use an account in your own name.</p>
      </div>

      {current && (
        <section className="rounded-lg border border-line p-4" aria-label="Current account">
          <p className="font-semibold">{current.bankName}</p>
          <p className="text-sm text-ink-soft">{current.accountName} · <span className="font-mono tabular-nums">{current.accountMasked}</span></p>
          <p className="mt-1 text-xs text-ink-faint">Last changed {formatMoment(current.changedAt)}</p>
          {current.inCoolOff && current.coolOffUntil && (
            <p role="status" className="mt-3 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
              You changed this recently, so you cannot be paid out until {formatMoment(current.coolOffUntil)}. This protects you if someone else gets into your account.
            </p>
          )}
        </section>
      )}

      {verification.data && (
        <section className="rounded-lg border border-line p-4" aria-label="Verification">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">SocietyLedger check</h2>
            <StatusBadge status={verification.data.status} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {verification.data.status === 'VERIFIED'
              ? 'You are verified and can be paid out.'
              : verification.data.status === 'REJECTED'
                ? `Not verified: ${verification.data.rejectionReason ?? 'no reason was given'}. Correct your details below and tell your circle officer.`
                : verification.data.status === 'PENDING'
                  ? 'SocietyLedger is checking your details. This does not stop you paying in.'
                  : 'Save your payout account and the check starts.'}
          </p>
        </section>
      )}

      {canWrite ? (
        <form onSubmit={submit} className="space-y-4" aria-label="Set payout account">
          <h2 className="font-semibold">{current ? 'Change my account' : 'Add my account'}</h2>
          <TextInput label="Bank" value={bankName} onChange={(e) => setBankName(e.currentTarget.value)} required minLength={2} maxLength={80} />
          <TextInput label="Account number" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(e) => setAccountNumber(e.currentTarget.value)} required />
          <TextInput label="Account name" description="Exactly as the bank has it." value={accountName} onChange={(e) => setAccountName(e.currentTarget.value)} required minLength={2} maxLength={120} />
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <Button type="submit" color="green" loading={save.isPending}>
            {current ? 'Change account' : 'Save account'}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">Changes are switched off while the add-on is expired.</p>
      )}
    </div>
  );
}
