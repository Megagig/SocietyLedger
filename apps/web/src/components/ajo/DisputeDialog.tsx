'use client';

import { useState } from 'react';
import { Button, FileInput, Modal, Textarea } from '@mantine/core';
import { ajoErrorMessage } from '@/lib/ajo/api';
import { formatDay, formatKobo } from '@/lib/ajo/format';
import { useRaiseDispute } from '@/lib/ajo/hooks';
import type { InstallmentDTO } from '@/lib/ajo/types';
import { toast } from '@/lib/toast';
import { validateProof } from './proof';

const MIN_CLAIM = 10;

/** THM8: "I paid" about one instalment, with a written claim and optional evidence. An officer decides; nothing is paid by raising it. */
export function DisputeDialog({ membershipId, installment, onClose }: { membershipId: number; installment: InstallmentDTO | null; onClose: () => void }) {
  const [claim, setClaim] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const raise = useRaiseDispute(membershipId);

  const close = () => {
    setClaim('');
    setEvidence(null);
    setProblem(null);
    onClose();
  };

  const submit = async () => {
    if (!installment) return;
    if (claim.trim().length < MIN_CLAIM) return setProblem(`Say what happened in at least ${MIN_CLAIM} characters, for example who you paid, how and when.`);
    const fileProblem = evidence ? validateProof(evidence) : null;
    if (fileProblem) return setProblem(fileProblem);
    setProblem(null);
    try {
      await raise.mutateAsync({ installmentId: installment.id, claim: claim.trim(), evidence });
      toast.success('Your claim was sent. An officer will look at it and decide.');
      close();
    } catch (error) {
      setProblem(ajoErrorMessage(error, 'Could not send your claim.'));
    }
  };

  return (
    <Modal opened={installment !== null} onClose={close} title="I already paid this" centered>
      {installment && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            The payment due on <strong>{formatDay(installment.dueDate)}</strong> ({formatKobo(installment.amountKobo)}) is showing as not paid. Tell the officers what happened. While they look, you will not be charged a late fee for it.
          </p>
          <Textarea label="What happened" placeholder="I gave ₦5,000.00 to the collector on Monday morning at the market." minRows={3} autosize value={claim} onChange={(e) => setClaim(e.currentTarget.value)} error={problem && problem.startsWith('Say what') ? problem : undefined} />
          <FileInput label="Evidence (optional)" description="A photo of the slip or a screenshot. JPG, PNG, WebP or PDF, up to 5 MB." accept="image/jpeg,image/png,image/webp,application/pdf" value={evidence} onChange={setEvidence} clearable />
          {problem && !problem.startsWith('Say what') && (
            <p role="alert" className="text-sm text-danger">
              {problem}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={submit} loading={raise.isLoading}>
              Send my claim
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
