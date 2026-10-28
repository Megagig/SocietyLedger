'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button, FileInput, TextInput } from '@mantine/core';
import { IconArrowLeft, IconCheck, IconCopy } from '@tabler/icons-react';
import { useAjoAccess } from '@/components/ajo/AjoGate';
import { AjoEmpty, AjoError, AjoLoading } from '@/components/ajo/AjoStates';
import { Money } from '@/components/ajo/Money';
import { validateProof } from '@/components/ajo/proof';
import { ajoApi, ajoErrorMessage } from '@/lib/ajo/api';
import { formatKobo, koboPositive, nairaToKobo } from '@/lib/ajo/format';
import { useMyMemberships, useReportTransfer } from '@/lib/ajo/hooks';
import type { GroupBankDTO } from '@/lib/ajo/types';
import { toast } from '@/lib/toast';

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const today = () => new Date().toISOString().slice(0, 10);

/** THM3: pay into the group's own bank account, then report the transfer with the slip. SocietyLedger never holds the money. */
export default function PayContributionPage() {
  const params = useParams<{ membershipId: string }>();
  const membershipId = Number(params.membershipId) || 0;
  const { canWrite } = useAjoAccess();
  const mine = useMyMemberships();
  const item = mine.data?.find((m) => m.membershipId === membershipId);
  const report = useReportTransfer(item?.group.id ?? 0);

  // The full account number is shown only when asked for and is never put in the query cache.
  const [bank, setBank] = useState<GroupBankDTO | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);
  const [copied, setCopied] = useState(false);

  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [proof, setProof] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const keyRef = useRef(newKey());

  if (mine.isLoading) return <AjoLoading />;
  if (mine.isError) return <AjoError error={mine.error} onRetry={() => mine.refetch()} />;
  if (!item) return <AjoEmpty title="We could not find that group." action={<Link href="/dashboard/my-thrift" className="text-green-700 underline">Back to my groups</Link>} />;

  const back = `/dashboard/my-thrift/${membershipId}`;
  if (!canWrite) return <AjoEmpty title="Payments are switched off." hint="The Ajo add-on has expired, so nothing can be added until it is renewed." action={<Link href={back} className="text-green-700 underline">Back</Link>} />;
  if (item.status !== 'ACTIVE') return <AjoEmpty title="You can pay once the group has approved you." hint="Check the group page to see what it is still waiting for." action={<Link href={back} className="text-green-700 underline">Back</Link>} />;

  const showBank = async () => {
    setLoadingBank(true);
    setBankError(null);
    try {
      setBank(await ajoApi.groupBank(item.group.id));
    } catch (error) {
      setBankError(ajoErrorMessage(error, 'Could not load the group’s bank details.'));
    } finally {
      setLoadingBank(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the number and copy it yourself.');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const kobo = nairaToKobo(amount);
    if (kobo === null || kobo <= BigInt(0)) return setProblem('Enter the amount you paid, for example 5,000 or 5000.50.');
    if (paidOn > today()) return setProblem('The payment date cannot be in the future.');
    if (!proof) return setProblem('Attach the slip or a screenshot of the transfer, so the officer can confirm it.');
    const fileProblem = validateProof(proof);
    if (fileProblem) return setProblem(fileProblem);
    setProblem(null);
    try {
      await report.mutateAsync({ membershipId, amountKobo: kobo, bankReference: reference.trim() || undefined, paidOn, proof, idempotencyKey: keyRef.current });
      keyRef.current = newKey();
      setDone(true);
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'Could not report your payment.'));
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-900 dark:bg-green-950/30">
        <IconCheck size={32} className="mx-auto text-green-600" />
        <p className="text-lg font-semibold text-green-900 dark:text-green-100">Reported.</p>
        <p className="text-sm text-green-800 dark:text-green-200">It counts once an officer confirms it against the bank statement. You will get a receipt when they do.</p>
        <Button component={Link} href={back} variant="light" color="green">
          Back to my group
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href={back} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:underline dark:text-gray-400">
          <IconArrowLeft size={14} /> {item.group.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">Pay {item.group.name}</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          {koboPositive(item.overdueKobo) ? <>You have <strong className="text-red-600"><Money kobo={item.overdueKobo} /></strong> overdue. </> : 'Nothing is overdue. '}
          {item.nextDue ? <>Your next payment is <strong><Money kobo={item.nextDue.remainingKobo} /></strong>.</> : null}
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700" aria-label="Where to pay">
        <h2 className="font-semibold">1. Send the money to the group&apos;s account</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">This is the group&apos;s own bank account. SocietyLedger does not hold your money.</p>
        {bank ? (
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">Bank</dt><dd className="font-medium">{bank.bankName}</dd></div>
            <div><dt className="text-gray-500">Account name</dt><dd className="font-medium">{bank.accountName}</dd></div>
            <div>
              <dt className="text-gray-500">Account number</dt>
              <dd className="flex items-center gap-2 font-mono text-lg font-semibold tabular-nums">
                {bank.accountNumber}
                <Button variant="subtle" size="compact-xs" leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />} onClick={() => copy(bank.accountNumber)}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </dd>
            </div>
          </dl>
        ) : (
          <div>
            <Button variant="light" onClick={showBank} loading={loadingBank}>
              Show the account details
            </Button>
            {bankError && <p role="alert" className="mt-2 text-sm text-red-600">{bankError}</p>}
          </div>
        )}
      </section>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700" aria-label="Report your payment">
        <h2 className="font-semibold">2. Tell us you have paid</h2>
        <TextInput label="Amount you paid (₦)" placeholder="5,000.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.currentTarget.value)} required />
        <div className="flex flex-wrap gap-2">
          {koboPositive(item.overdueKobo) && <Button type="button" variant="default" size="compact-xs" onClick={() => setAmount((Number(item.overdueKobo) / 100).toFixed(2))}>Overdue: {formatKobo(item.overdueKobo)}</Button>}
          {item.nextDue && <Button type="button" variant="default" size="compact-xs" onClick={() => setAmount((Number(item.nextDue?.remainingKobo ?? 0) / 100).toFixed(2))}>Next payment: {formatKobo(item.nextDue.remainingKobo)}</Button>}
        </div>
        <TextInput label="Date you paid" type="date" max={today()} value={paidOn} onChange={(e) => setPaidOn(e.currentTarget.value)} required />
        <TextInput label="Bank reference (optional)" description="The reference or session ID on your slip." value={reference} onChange={(e) => setReference(e.currentTarget.value)} maxLength={80} />
        <FileInput label="Slip or screenshot" description="JPG, PNG, WebP or PDF, up to 5 MB." accept="image/jpeg,image/png,image/webp,application/pdf" value={proof} onChange={setProof} clearable required />
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
        <Button type="submit" color="green" fullWidth loading={report.isLoading}>
          Report my payment
        </Button>
      </form>
    </div>
  );
}
