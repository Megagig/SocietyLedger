'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button, Checkbox, NativeSelect, TextInput } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { CSV_TEMPLATE, MAX_CSV_ROWS, contributorRowProblem, normalizeNigerianPhone, readContributorCsv, type ContributorRow } from '@/lib/ajo/contributorCsv';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { BulkResultDTO, GroupDetailDTO, GroupListItemDTO } from '@/lib/ajo/staffTypes';
import { useAjoStatus } from '@/lib/ajo/hooks';
import { toast } from '@/lib/toast';
import { StatusBadge } from '@/components/ajo/StatusBadge';

const blank = (): ContributorRow => ({ firstName: '', lastName: '', phone: '', address: '', email: '', shares: '' });
const isBlank = (r: ContributorRow) => Object.values(r).every((v) => v.trim() === '');

/**
 * Step 3: create the people, put them in the circle and approve them. A new group has nobody on file yet, so this is where they are
 * made: typed one by one or read from a CSV. The server answers for every row on its own and a repeated list adds nobody twice.
 */
export function StepContributors({ circles, circleId, onChooseCircle, group, guarantorRequired, onDone, onSkip }: {
  circles: GroupListItemDTO[];
  circleId: number | null;
  onChooseCircle: (id: number) => void;
  group: GroupDetailDTO | undefined;
  guarantorRequired: boolean;
  onDone: () => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const client = useQueryClient();
  const status = useAjoStatus();
  const [rows, setRows] = useState<ContributorRow[]>([blank(), blank(), blank()]);
  const [approve, setApprove] = useState(true);
  const [onBehalf, setOnBehalf] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<(BulkResultDTO & { invited: number }) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rotating = group?.model === 'ROTATING_POT';
  const maxShares = rotating ? group?.maxSharesPerMember ?? 1 : null;
  const filled = rows.filter((r) => !isBlank(r));
  const problems = filled.map((r) => contributorRowProblem(r, maxShares));
  const seen = new Map<string, number>();
  const dupes = filled.map((r, i) => {
    const k = normalizeNigerianPhone(r.phone);
    if (!k) return null;
    const first = seen.get(k);
    if (first === undefined) { seen.set(k, i); return null; }
    return `${filled[first].firstName} ${filled[first].lastName}`.trim() || `row ${first + 1}`;
  });
  const goodRows = filled.filter((_, i) => !problems[i] && !dupes[i]);
  const limit = status.data?.kind === 'ok' ? status.data.status.contributors : null;
  const room = limit && limit.remaining !== null ? limit.remaining : null;
  const overLimit = approve && room !== null && goodRows.length > room;

  const setCell = (i: number, key: keyof ContributorRow, value: string) => setRows((prev) => prev.map((r, at) => (at === i ? { ...r, [key]: value } : r)));
  const removeRow = (i: number) => setRows((prev) => (prev.length > 1 ? prev.filter((_, at) => at !== i) : [blank()]));

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    if (file.size > 1024 * 1024) return setProblem('That file is too big for a list of names. Check it is a CSV.');
    const read = readContributorCsv(await file.text());
    if (!read.ok) return setProblem(read.message);
    setProblem(null);
    setRows((prev) => [...prev.filter((r) => !isBlank(r)), ...read.rows].slice(0, MAX_CSV_ROWS));
    toast.success(`${read.rows.length} ${read.rows.length === 1 ? 'person' : 'people'} read from the file. Check them below.`);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'contributors-template.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!circleId) return setProblem('Create a circle first (step 2), or skip this step.');
    if (goodRows.length === 0) return setProblem('Add at least one person with a name and phone number.');
    if (overLimit) return setProblem(`Your plan has room for ${room} more contributor${room === 1 ? '' : 's'}. Remove some, or move to a bigger tier first.`);
    setProblem(null);
    setBusy(true);
    try {
      const items = goodRows.map((r) => ({ firstName: r.firstName, lastName: r.lastName, phone: r.phone, address: r.address, email: r.email, ...(maxShares !== null && r.shares.trim() ? { shares: Number(r.shares) } : {}) }));
      const result = await ajoStaffApi.bulkAdd(circleId, { items, approve, acceptRulesOnBehalf: onBehalf });
      // Login links go only to people who were really added and gave an email address.
      let invited = 0;
      if (sendEmail) {
        for (const r of result.results) {
          const email = goodRows[r.row - 1]?.email.trim();
          if (r.memberId && email && (r.status === 'added' || r.status === 'already_in_group')) {
            try { await ajoStaffApi.inviteToLogin(r.memberId, email); invited++; } catch { /* they can be invited later from Members */ }
          }
        }
      }
      await client.invalidateQueries({ queryKey: ['ajo'] });
      setOutcome({ ...result, invited });
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'We could not add these people. Nothing was lost; try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (outcome) {
    const bad = outcome.results.filter((r) => r.status === 'invalid' || r.status === 'failed' || (r.message && !r.active));
    const draft = group?.status === 'DRAFT';
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
          <p className="text-lg font-semibold text-green-900 dark:text-green-100">{outcome.summary.added} added · {outcome.summary.approved} approved · {outcome.summary.active} active{draft && outcome.summary.approved > 0 ? ' (they become active when you open the circle)' : ''}</p>
          {outcome.summary.alreadyIn > 0 && <p className="text-sm text-green-800 dark:text-green-200">{outcome.summary.alreadyIn} {outcome.summary.alreadyIn === 1 ? 'was' : 'were'} already in the circle and nothing was repeated.</p>}
          {outcome.invited > 0 && <p className="text-sm text-green-800 dark:text-green-200">{outcome.invited} login link{outcome.invited === 1 ? '' : 's'} sent by email.</p>}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">&quot;0 active&quot; is not an error. A person becomes active once the group has approved them, they have accepted the rules{guarantorRequired ? ', their guarantor is recorded' : ''}{group?.requirePhoneConfirm ? ', they have confirmed their phone' : ''}, and the circle is open. Before anyone can be paid out, SocietyLedger also checks their name, phone, address and payout account.</p>
        {bad.length > 0 && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm dark:border-yellow-800 dark:bg-yellow-950/30">
            <p className="font-medium">{bad.length} need attention</p>
            <ul className="mt-1 list-disc pl-5">{bad.map((r) => <li key={r.row}>{r.name}: {r.message}</li>)}</ul>
          </div>
        )}
        <div className="flex justify-between">
          <Button variant="default" onClick={() => setOutcome(null)}>Add more people</Button>
          <Button color="green" onClick={() => { setBusy(true); onDone().finally(() => setBusy(false)); }} loading={busy}>Continue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {circles.length > 1 && <NativeSelect label="Add them to" data={circles.map((g) => ({ value: String(g.id), label: g.name }))} value={String(circleId ?? '')} onChange={(e) => onChooseCircle(Number(e.currentTarget.value))} />}
      {!circleId && <p className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200">You have no circle yet. Go back to step 2, or skip this step and add people later.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} aria-label="Upload a CSV list" />
        <Button variant="light" onClick={() => fileRef.current?.click()}>Upload a list (CSV)</Button>
        <Button variant="subtle" onClick={downloadTemplate}>Download the template</Button>
        <span className="text-xs text-gray-500">Up to {MAX_CSV_ROWS} people at a time.</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <tr><th className="px-2 py-2 font-medium">First name</th><th className="px-2 py-2 font-medium">Last name</th><th className="px-2 py-2 font-medium">Phone</th><th className="px-2 py-2 font-medium">Home address</th><th className="px-2 py-2 font-medium">Email</th>{rotating && <th className="px-2 py-2 font-medium">Shares</th>}<th className="px-2 py-2" /></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const at = filled.indexOf(r);
              const why = at >= 0 ? problems[at] ?? (dupes[at] ? `${dupes[at]} already uses this number.` : null) : null;
              return (
                <tr key={i} className="border-t border-gray-100 align-top dark:border-gray-700">
                  {(['firstName', 'lastName', 'phone', 'address', 'email'] as const).map((k) => (
                    <td key={k} className="px-1 py-1"><TextInput aria-label={k} size="xs" value={r[k]} onChange={(e) => setCell(i, k, e.currentTarget.value)} error={k === 'phone' && why ? true : undefined} /></td>
                  ))}
                  {rotating && <td className="px-1 py-1 w-20"><TextInput aria-label="shares" size="xs" value={r.shares} onChange={(e) => setCell(i, 'shares', e.currentTarget.value)} placeholder="1" /></td>}
                  <td className="px-1 py-1 whitespace-nowrap"><Button size="compact-xs" variant="subtle" color="red" onClick={() => removeRow(i)} aria-label="Remove this row">×</Button>{why && <span className="ml-1 text-xs text-red-600">{why}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="subtle" size="xs" onClick={() => setRows((p) => [...p, blank()].slice(0, MAX_CSV_ROWS))}>Add a row</Button>
        <p className="text-xs text-gray-500">Home address is optional now, but it is needed before a person can be paid out.</p>
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <Checkbox checked={approve} onChange={(e) => setApprove(e.currentTarget.checked)} label={`I know these people and approve them for ${group?.name ?? 'the circle'}`} description="This is the group's approval. It also asks SocietyLedger to check them." />
        <Checkbox checked={onBehalf} onChange={(e) => setOnBehalf(e.currentTarget.checked)} label="I have explained the group rules to them and they agreed" description="Recorded on their behalf, with your name. If you leave this off, each person accepts the rules themselves after signing in, or you record it later from Members." />
        <Checkbox checked={sendEmail} onChange={(e) => setSendEmail(e.currentTarget.checked)} label="Email a login link to everyone who has an email address" description="So they can see their schedule and receipts. Text messages cost SMS credits, so they are not sent from here." />
      </div>

      {guarantorRequired && <p className="text-sm text-gray-600 dark:text-gray-400">Each person needs a guarantor before they become active. Add guarantors from Members.</p>}
      {group?.requirePhoneConfirm && <p className="text-sm text-gray-600 dark:text-gray-400">Each person will confirm their phone with a code when they join.</p>}
      <p className="text-xs text-gray-500">Want to be a contributor yourself? Add yourself as a row. Another officer has to approve you, because nobody can approve their own membership.</p>

      {limit && <p className="text-sm text-gray-700 dark:text-gray-300">{limit.count} of {limit.limit ?? 'unlimited'} contributors on your plan{room !== null ? ` · room for ${room} more` : ''}. {overLimit && <Link href="/dashboard/subscription" className="font-medium text-green-700 underline">See bigger tiers</Link>}</p>}
      {overLimit && <p role="alert" className="text-sm text-red-600">That is more people than your plan has room for. Remove some, untick approval, or move to a bigger tier.</p>}
      {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="subtle" onClick={() => { setBusy(true); onSkip().finally(() => setBusy(false)); }} disabled={busy}>Add people later</Button>
        <div className="flex items-center gap-2">
          <StatusBadge status="PENDING" label={`${goodRows.length} ready`} />
          <Button color="green" onClick={submit} loading={busy} disabled={!circleId}>Add {goodRows.length || ''} {goodRows.length === 1 ? 'person' : 'people'}</Button>
        </div>
      </div>
    </div>
  );
}
