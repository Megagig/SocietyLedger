'use client';

import { useState, type ReactNode } from 'react';
import { Button, Modal, PasswordInput, Textarea } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { ajoErrorCode, ajoErrorMessage } from '@/lib/ajo/api';
import { toast } from '@/lib/toast';

export type ActionValues = { reason: string; password: string };

type Props = {
  opened: boolean;
  onClose: () => void;
  title: string;
  /** What is about to happen, in plain words, with the names and amounts the person is deciding about. */
  summary?: ReactNode;
  confirmLabel: string;
  /** red for anything that cannot be quietly undone */
  color?: 'green' | 'red' | 'blue';
  /** Ask for a written reason of at least this many characters. */
  reasonMin?: number;
  reasonLabel?: string;
  /** Ask the person to type their password again (payout approval and reversal, closing a case). */
  needPassword?: boolean;
  /** Extra fields (a choice, a checkbox), and a check that runs before sending. */
  extra?: ReactNode;
  validate?: () => string | null;
  onConfirm: (values: ActionValues) => Promise<unknown>;
  successMessage: string;
};

/**
 * One confirmation for every sensitive Ajo action. It shows what is about to happen, collects a reason and/or the person's password,
 * says exactly why the server refused if it did, and never closes on failure. A wrong password stays in the dialog so it can be retyped.
 */
export function ActionDialog({ opened, onClose, title, summary, confirmLabel, color = 'green', reasonMin, reasonLabel = 'Reason', needPassword, extra, validate, onConfirm, successMessage }: Props) {
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();

  const reset = () => {
    setReason('');
    setPassword('');
    setProblem(null);
    setBusy(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (reasonMin && reason.trim().length < reasonMin) return setProblem(`${reasonLabel}: write at least ${reasonMin} characters. It stays on the record.`);
    if (needPassword && !password) return setProblem('Enter your password to confirm this.');
    const own = validate?.();
    if (own) return setProblem(own);
    setProblem(null);
    setBusy(true);
    try {
      await onConfirm({ reason: reason.trim(), password });
      // Whatever just changed, every Ajo screen fetches again so no figure is stale.
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success(successMessage);
      close();
    } catch (error) {
      setBusy(false);
      setProblem(ajoErrorMessage(error));
      if (ajoErrorCode(error) === 'REAUTH_FAILED') setPassword('');
    }
  };

  return (
    <Modal opened={opened} onClose={close} title={title} centered closeOnClickOutside={!busy}>
      <div className="space-y-4">
        {summary && <div className="text-sm text-ink-soft">{summary}</div>}
        {extra}
        {reasonMin ? <Textarea label={reasonLabel} minRows={2} autosize value={reason} onChange={(e) => setReason(e.currentTarget.value)} /> : null}
        {needPassword && <PasswordInput label="Your password" description="Typed again to be sure it is you." autoComplete="current-password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />}
        {problem && (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="default" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button color={color} onClick={submit} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
