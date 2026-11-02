'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@mantine/core';
import { IconInfoCircle, IconLock, IconPigMoney, IconPlus, IconTrash, IconUpload } from '@tabler/icons-react';
import { useAccountTypes, useCoopBankAccounts, useCoopDashboard, useSubmitPayment } from '@/lib/coop/hooks';
import { coopErrorMessage } from '@/lib/coop/api';
import { getMyCooperativeProfile } from '@/lib/api/cooperatives';
import { useScopedQuery } from '@/lib/query';
import { CoopError, CoopLoading } from '@/components/coop/CoopStates';
import { Naira } from '@/components/coop/Naira';
import { PageHead } from '@/components/coop/PageHead';
import { StatTile, type TileTone } from '@/components/coop/StatTile';
import { toast } from '@/lib/toast';
import { formatNairaFull } from '@/utils/format';
import type { AccountClass, AccountType } from '@/lib/coop/types';

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CLASS_WORD: Record<AccountClass, string> = { CONTRIBUTION: 'Contribution', SHARES: 'Shares', SPECIAL: 'Special' };
const SAVINGS_TONE: Record<AccountClass, TileTone> = { CONTRIBUTION: 'success', SHARES: 'info', SPECIAL: 'warning' };

const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

const fieldClass =
  'mt-1 h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:border-success focus:outline-none focus:ring-2 focus:ring-success-focus';

interface Line {
  typeId: number;
  name: string;
  amount: number;
  period: string; // YYYY-MM
}

const periodLabel = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]} ${year}`;
};

/**
 * Savings: what the member holds in each savings type, and the way to pay in. A payment is one bank transfer with one receipt, covering one
 * or more lines (a savings type, an amount, and the month it is for). Nothing is added to the savings until an officer confirms it.
 */
export default function MySavingsPage() {
  const types = useAccountTypes();
  const banks = useCoopBankAccounts();
  const dashboard = useCoopDashboard();
  const submit = useSubmitPayment();
  const profile = useScopedQuery({ domain: 'cooperatives', personal: true, parts: ['profile'], queryFn: async () => (await getMyCooperativeProfile()).data });
  const fileInput = useRef<HTMLInputElement>(null);

  const [typeId, setTypeId] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState(thisMonth());
  const [lines, setLines] = useState<Line[]>([]);
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [bankAccountId, setBankAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.amount, 0), [lines]);
  const chosen: AccountType | undefined = types.data?.find((t) => String(t.id) === typeId);
  const locked = Number(profile.data?.lockedSavings ?? 0);

  const pickType = (value: string) => {
    setTypeId(value);
    const t = types.data?.find((x) => String(x.id) === value);
    // The association's usual monthly amount for the type saves the member typing it.
    if (t?.defaultMonthlyAmount) setAmount(String(Number(t.defaultMonthlyAmount)));
  };

  const addLine = () => {
    const value = Number(amount);
    if (!chosen) return toast.error('Choose a savings type');
    if (!value || value <= 0) return toast.error('Enter an amount above zero');
    if (!period) return toast.error('Choose the month this payment is for');
    setLines((current) => {
      // The same type for the same month is one line: add the amounts together.
      const existing = current.find((l) => l.typeId === chosen.id && l.period === period);
      if (existing) return current.map((l) => (l === existing ? { ...l, amount: l.amount + value } : l));
      return [...current, { typeId: chosen.id, name: chosen.name, amount: value, period }];
    });
    setAmount('');
  };

  const send = async () => {
    if (lines.length === 0) return toast.error('Add at least one payment line');
    if (!proof) return toast.error('Attach your bank receipt (a photo or PDF)');
    if (proof.size > MAX_PROOF_BYTES) return toast.error('The receipt must be 5MB or smaller');
    try {
      await submit.mutateAsync({
        lines: lines.map((l) => ({ accountTypeId: l.typeId, amount: l.amount, periodMonth: Number(l.period.split('-')[1]), periodYear: Number(l.period.split('-')[0]) })),
        paymentDate,
        bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
        reference: reference.trim() || undefined,
        memberNote: note.trim() || undefined,
        file: proof,
      });
      toast.success('Payment submitted. It will show in your savings once an officer confirms it.');
      setLines([]);
      setProof(null);
      setReference('');
      setNote('');
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      toast.error(coopErrorMessage(error, 'We could not submit the payment.'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHead
        title="Savings"
        subtitle="Your savings by type, and the way to pay in."
        actions={
          <Button component={Link} href="/dashboard/cooperatives/my-pending-payments" variant="default">
            My pending payments
          </Button>
        }
      />

      {dashboard.isLoading ? (
        <CoopLoading rows={1} height={96} />
      ) : dashboard.isError ? (
        <CoopError error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <section aria-label="Your savings" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dashboard.data?.savingsTiles.map((tile) => (
            <StatTile key={tile.accountTypeId} label={tile.name} value={tile.balance} tone={SAVINGS_TONE[tile.accountClass]} icon={<IconPigMoney size={20} />} hint={tile.description ?? CLASS_WORD[tile.accountClass]} />
          ))}
        </section>
      )}

      {locked > 0 && (
        <div role="note" className="flex items-start gap-3 rounded-lg border border-info-line bg-info-soft p-4 text-sm text-info-strong">
          <IconLock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <Naira value={locked} /> of your savings is held as security for your loan. It stays in your account and is released as you repay the loan.
          </p>
        </div>
      )}

      <section aria-labelledby="pay-heading" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
        <h2 id="pay-heading" className="text-xl font-semibold text-ink">
          Payment confirmation
        </h2>
        <p className="mt-1 text-sm text-ink-muted">Select savings types, add amounts, attach the proof of payment, and submit.</p>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted">
          <IconInfoCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          One bank transfer, one receipt. If you paid in two separate transfers, submit them as two payments.
        </p>

        {types.isLoading ? (
          <div className="mt-4">
            <CoopLoading rows={1} height={64} />
          </div>
        ) : types.isError ? (
          <div className="mt-4">
            <CoopError error={types.error} onRetry={() => types.refetch()} />
          </div>
        ) : (
          <>
            <div className="mt-5 grid items-end gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
              <label className="block text-sm font-medium text-ink-soft">
                Description
                <select value={typeId} onChange={(e) => pickType(e.target.value)} className={fieldClass}>
                  <option value="">Select savings type</option>
                  {types.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({CLASS_WORD[t.accountClass]})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink-soft">
                Amount (₦)
                <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={fieldClass} />
              </label>
              <label className="block text-sm font-medium text-ink-soft">
                Month-Year
                <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={fieldClass} />
              </label>
              <Button onClick={addLine} leftSection={<IconPlus size={16} />} color="green" className="h-11">
                Add
              </Button>
            </div>

            <div className="relative mt-4 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-surface-muted text-left text-ink-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">For</th>
                    <th scope="col" className="px-4 py-2 font-medium">Description</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Amount (₦)</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                        List is empty.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => (
                      <tr key={`${line.typeId}-${line.period}`} className="border-t border-line-soft">
                        <td className="px-4 py-2">{periodLabel(line.period)}</td>
                        <td className="px-4 py-2">{line.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatNairaFull(line.amount)}</td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="subtle" color="red" size="xs" aria-label={`Remove ${line.name} for ${periodLabel(line.period)}`} onClick={() => setLines((c) => c.filter((l) => l !== line))}>
                            <IconTrash size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface-muted font-semibold text-ink">
                    <td className="px-4 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNairaFull(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <label className="block text-sm font-medium text-ink-soft">
                Date you paid
                <input type="date" value={paymentDate} max={todayISO()} onChange={(e) => setPaymentDate(e.target.value)} className={fieldClass} />
              </label>
              <label className="block text-sm font-medium text-ink-soft">
                Paid into
                <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={fieldClass}>
                  <option value="">Choose the account you paid into</option>
                  {banks.data?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} · {b.accountNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-ink-soft">
                Reference (optional)
                <input type="text" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} className={fieldClass} />
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium text-ink-soft">
              Note to the officers (optional)
              <textarea value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} className={`${fieldClass} h-auto py-2`} />
            </label>

            <div className="mt-5">
              <p className="text-sm font-medium text-ink-soft">Attach evidence of payment</p>
              <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong p-6 text-center text-ink-muted focus-within:ring-2 focus-within:ring-success-focus hover:bg-surface-muted">
                <IconUpload size={28} aria-hidden="true" />
                <span className="text-sm">{proof ? proof.name : 'Click to upload an image or PDF (up to 5MB)'}</span>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/gif,application/pdf" className="sr-only" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <Button color="green" size="md" onClick={send} loading={submit.isPending} disabled={lines.length === 0 || !proof}>
                Submit payment
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
