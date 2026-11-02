'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button } from '@mantine/core';
import { CoopButton } from '@/components/coop/CoopButton';
import { IconInbox, IconUpload } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateFor } from '@societyledger/query';
import { getMyCooperativeProfile, submitLoanRepaymentRequest } from '@/lib/api/cooperatives';
import { coopErrorMessage } from '@/lib/coop/api';
import { useCoopBankAccounts } from '@/lib/coop/hooks';
import { useQueryScope, useScopedQuery } from '@/lib/query';
import { CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { toast } from '@/lib/toast';
import { formatNairaFull } from '@/utils/format';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const todayISO = () => new Date().toISOString().slice(0, 10);
const fieldClass =
  'mt-1 h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus';

interface LoanRow {
  id: number;
  loanNumber: string;
  outstandingBalance: string;
  nextPaymentAmount: string | null;
  nextPaymentDate: string | null;
  loanProduct: { name: string };
}

/**
 * Loan Repayment: declare a payment you made towards one of your loans, with the bank receipt. "Optimal" fills in the instalment that is due;
 * "Max" fills in everything still owed. The repayment is only recorded once an officer confirms the money arrived.
 */
export default function LoanRepaymentPage() {
  const queryClient = useQueryClient();
  const { tenant } = useQueryScope();
  const profile = useScopedQuery({ domain: 'cooperatives', personal: true, parts: ['profile'], queryFn: async () => (await getMyCooperativeProfile()).data });
  const banks = useCoopBankAccounts();
  const fileInput = useRef<HTMLInputElement>(null);

  const [loanId, setLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);

  const submit = useMutation({
    mutationFn: submitLoanRepaymentRequest,
    onSuccess: () => invalidateFor(queryClient, tenant, 'cooperative.changed'),
  });

  const loans: LoanRow[] = (profile.data?.activeLoans as LoanRow[] | undefined) ?? [];
  const loan = loans.find((l) => String(l.id) === loanId);
  const owed = Number(loan?.outstandingBalance ?? 0);
  const optimal = loan?.nextPaymentAmount ? Math.min(Number(loan.nextPaymentAmount), owed) : null;

  const send = async () => {
    const value = Number(amount);
    if (!loan) return toast.error('Choose the loan you are paying');
    if (!value || value <= 0) return toast.error('Enter the amount you paid');
    if (value > owed) return toast.error(`That is more than the ${formatNairaFull(owed)} still owed on this loan`);
    if (!proof) return toast.error('Attach your bank receipt (a photo or PDF)');
    if (proof.size > MAX_PROOF_BYTES) return toast.error('The receipt must be 5MB or smaller');
    try {
      await submit.mutateAsync({ loanId: loan.id, amount: value, paymentDate, bankAccountId: bankAccountId ? Number(bankAccountId) : undefined, reference: reference.trim() || undefined, memberNote: note.trim() || undefined, file: proof });
      toast.success('Payment submitted. It will be recorded once an officer confirms it.');
      setAmount('');
      setProof(null);
      setReference('');
      setNote('');
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : coopErrorMessage(error, 'We could not submit the payment.'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHead title="Loan repayment" subtitle="Manage and settle your outstanding loan obligations." />

      {profile.isLoading ? (
        <CoopLoading rows={2} />
      ) : profile.isError ? (
        <CoopError error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <section className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <div className="grid items-start gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium text-ink-soft">
              Choose loan portfolio
              <select value={loanId} onChange={(e) => { setLoanId(e.target.value); setAmount(''); }} className={fieldClass}>
                <option value="">--select--</option>
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.loanProduct.name} · {l.loanNumber} · owes {formatNairaFull(l.outstandingBalance)}
                  </option>
                ))}
              </select>
              {loans.length === 0 && <span className="mt-1 block text-xs text-ink-muted">No data available</span>}
            </label>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="repay-amount" className="text-sm font-medium text-ink-soft">Repayment amount</label>
                <span className="flex gap-1">
                  <CoopButton tone="info-soft" size="compact-xs" disabled={!loan || optimal === null} onClick={() => optimal !== null && setAmount(String(optimal))}>
                    Optimal
                  </CoopButton>
                  <CoopButton tone="soft" size="compact-xs" disabled={!loan} onClick={() => setAmount(String(owed))}>
                    Max
                  </CoopButton>
                </span>
              </div>
              <input id="repay-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} disabled={!loan} onChange={(e) => setAmount(e.target.value)} placeholder="NGN 0.00" className={fieldClass} />
              {loan && (
                <p className="mt-1 text-xs text-ink-muted">
                  Still owed <Naira value={loan.outstandingBalance} />
                  {optimal !== null && <> · Instalment due <Naira value={optimal} /></>}
                </p>
              )}
            </div>

            <label className="block text-sm font-medium text-ink-soft">
              Date you paid
              <input type="date" value={paymentDate} max={todayISO()} onChange={(e) => setPaymentDate(e.target.value)} className={fieldClass} />
            </label>
          </div>

          {!loan ? (
            <div className="mt-6 rounded-lg bg-surface-muted p-8 text-center">
              <IconInbox size={32} className="mx-auto mb-2 text-ink-subtle" aria-hidden="true" />
              <p className="font-semibold text-ink">Select a loan portfolio</p>
              <p className="mt-1 text-sm text-ink-muted">Choose a loan from the list above to view repayment details and make a payment.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium text-ink-soft">
                  Paid into
                  <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={fieldClass}>
                    <option value="">The account you paid into</option>
                    {banks.data?.map((b) => (
                      <option key={b.id} value={b.id}>{b.bankName} · {b.accountNumber}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium text-ink-soft">
                  Reference (optional)
                  <input type="text" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} className={fieldClass} />
                </label>
              </div>
              <label className="block text-sm font-medium text-ink-soft">
                Note to the officers (optional)
                <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={`${fieldClass} h-auto py-2`} />
              </label>
              <div>
                <p className="text-sm font-medium text-ink-soft">Attach evidence of payment</p>
                <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong p-6 text-center text-ink-muted focus-within:ring-2 focus-within:ring-success-focus hover:bg-surface-muted">
                  <IconUpload size={28} aria-hidden="true" />
                  <span className="text-sm">{proof ? proof.name : 'Click to upload an image or PDF (up to 5MB)'}</span>
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/gif,application/pdf" className="sr-only" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button component={Link} href="/dashboard/cooperatives/my-pending-payments" variant="subtle">See my pending payments</Button>
                <CoopButton tone="primary" onClick={send} loading={submit.isPending} disabled={!amount || !proof}>Submit payment</CoopButton>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
