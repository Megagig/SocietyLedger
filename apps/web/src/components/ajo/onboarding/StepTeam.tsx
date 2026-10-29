'use client';

import { useState } from 'react';
import { Button, NativeSelect, TextInput } from '@mantine/core';
import { THRIFT_ONBOARDING_TEAM_ROLES } from '@societyledger/shared';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { TeamInviteResult } from '@/lib/ajo/staffTypes';

type Invite = { firstName: string; lastName: string; email: string; role: string };
const blank = (role = 'ajo_officer'): Invite => ({ firstName: '', lastName: '', email: '', role });

const SAYS: Record<TeamInviteResult['status'], string> = {
  invited: 'Invited. They have an email.',
  invited_email_failed: 'Invited, but the email could not be sent. Resend it from Members.',
  already_member: 'Already on file. Invite them from Members.',
  failed: 'Could not be invited.',
};

/**
 * Step 4 (optional): bring in the people who help. A collector-thrift circle needs a collector with a login, and payouts need a second
 * person to approve. The collector role is only offered when the circle is a collector-thrift one.
 */
export function StepTeam({ collectorCircle, hasCollector, onDone, onSkip }: { collectorCircle: boolean; hasCollector: boolean; onDone: () => Promise<void>; onSkip: () => Promise<void> }) {
  const roles = THRIFT_ONBOARDING_TEAM_ROLES.filter((r) => collectorCircle || r.value !== 'ajo_collector');
  const [invites, setInvites] = useState<Invite[]>([blank(collectorCircle ? 'ajo_collector' : 'ajo_officer')]);
  const [results, setResults] = useState<TeamInviteResult[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (i: number, k: keyof Invite, v: string) => setInvites((p) => p.map((x, at) => (at === i ? { ...x, [k]: v } : x)));
  const filled = invites.filter((i) => i.firstName.trim() || i.lastName.trim() || i.email.trim());

  const send = async () => {
    if (filled.length === 0) return setProblem('Add at least one person, or continue without inviting anyone.');
    const bad = filled.find((i) => !i.firstName.trim() || !i.lastName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim()));
    if (bad) return setProblem('Each person needs a first name, a last name and a valid email address.');
    setProblem(null);
    setBusy(true);
    try {
      const out = await ajoStaffApi.inviteTeam(filled.map((i) => ({ ...i, firstName: i.firstName.trim(), lastName: i.lastName.trim(), email: i.email.trim() })));
      setResults(out.results);
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'We could not send the invites. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const next = () => { setBusy(true); onDone().finally(() => setBusy(false)); };

  if (results) {
    return (
      <div className="space-y-4">
        <ul className="divide-y divide-line-soft rounded-lg border border-line text-sm">{results.map((r) => <li key={r.email} className="flex justify-between gap-2 px-3 py-2"><span>{r.email}</span><span className="text-ink-muted">{r.message ?? SAYS[r.status]}</span></li>)}</ul>
        {collectorCircle && <p className="text-sm text-ink-muted">Once a collector accepts the invite, assign contributors to them from the circle&apos;s Collectors page.</p>}
        <div className="flex justify-end"><Button color="green" onClick={next} loading={busy}>Continue</Button></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {collectorCircle && !hasCollector && <p className="rounded-md bg-warning-soft p-3 text-sm text-warning-strong">Your circle needs a collector. Invite one now, or add one later from Collectors.</p>}
      <p className="text-sm text-ink-muted">One person prepares a payout and another approves it. With only one admin, every approval needs an extra confirmation, so a co-admin helps.</p>
      <ul className="text-sm text-ink-muted">{roles.map((r) => <li key={r.value}><strong>{r.label}:</strong> {r.description}</li>)}</ul>
      {invites.map((inv, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-5">
          <TextInput placeholder="First name" aria-label="First name" value={inv.firstName} onChange={(e) => set(i, 'firstName', e.currentTarget.value)} />
          <TextInput placeholder="Last name" aria-label="Last name" value={inv.lastName} onChange={(e) => set(i, 'lastName', e.currentTarget.value)} />
          <TextInput className="sm:col-span-2" placeholder="Email" aria-label="Email" type="email" value={inv.email} onChange={(e) => set(i, 'email', e.currentTarget.value)} />
          <NativeSelect aria-label="Role" data={roles.map((r) => ({ value: r.value, label: r.label }))} value={inv.role} onChange={(e) => set(i, 'role', e.currentTarget.value)} />
        </div>
      ))}
      <Button variant="subtle" size="xs" onClick={() => setInvites((p) => [...p, blank(collectorCircle ? 'ajo_collector' : 'ajo_officer')].slice(0, 20))}>Add another person</Button>
      {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
      <div className="flex justify-between">
        <Button variant="subtle" onClick={() => { setBusy(true); onSkip().finally(() => setBusy(false)); }} disabled={busy}>Skip this step</Button>
        <Button color="green" onClick={send} loading={busy}>Send invites</Button>
      </div>
    </div>
  );
}
