'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Modal, Textarea } from '@mantine/core';
import { Money } from '@/components/ajo/Money';
import { ajoErrorCode, ajoErrorMessage } from '@/lib/ajo/api';
import { ajoStaffApi } from '@/lib/ajo/staffApi';
import type { QueueContributionDTO } from '@/lib/ajo/staffTypes';
import { toast } from '@/lib/toast';

/**
 * Confirming a payment is where money becomes real, so the two situations that need a second look are asked about in words: a proof
 * that looks like one already used, and confirming a payment you recorded yourself (only allowed when you are the only person who can).
 */
export function ConfirmPaymentDialog({ item, name, onClose }: { item: QueueContributionDTO | null; name: string; onClose: () => void }) {
  const client = useQueryClient();
  const [ack, setAck] = useState(false);
  const [own, setOwn] = useState(false);
  const [note, setNote] = useState('');
  const [needs, setNeeds] = useState<{ duplicate: boolean; self: boolean; message: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => { setAck(false); setOwn(false); setNote(''); setNeeds(null); setProblem(null); setBusy(false); onClose(); };
  const submit = async () => {
    if (!item) return;
    setBusy(true);
    setProblem(null);
    try {
      await ajoStaffApi.confirm(item.id, { acknowledgeDuplicate: ack || undefined, confirmOwn: own || undefined, note: note.trim() || undefined });
      await client.invalidateQueries({ queryKey: ['ajo'] });
      toast.success('Confirmed. A receipt goes to the member.');
      close();
    } catch (error) {
      setBusy(false);
      const code = ajoErrorCode(error);
      if (code === 'DUPLICATE_ACK_REQUIRED') setNeeds({ duplicate: true, self: needs?.self ?? false, message: ajoErrorMessage(error) });
      else if (code === 'SELF_CONFIRM_NEEDS_NOTE') setNeeds({ duplicate: needs?.duplicate ?? false, self: true, message: ajoErrorMessage(error) });
      else setProblem(ajoErrorMessage(error));
    }
  };

  return (
    <Modal opened={item !== null} onClose={close} title="Confirm this payment" centered>
      {item && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">Confirm only after you have seen <strong><Money kobo={item.amountKobo} /></strong> from <strong>{name}</strong> in the circle&apos;s bank statement. Once confirmed it counts towards what they owe.</p>
          {needs?.duplicate && (
            <div className="space-y-2 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
              <p>{needs.message}</p>
              <Checkbox label="I checked, and this is a different payment." checked={ack} onChange={(e) => setAck(e.currentTarget.checked)} />
            </div>
          )}
          {needs?.self && (
            <div className="space-y-2 rounded-md bg-warning-soft p-3 text-sm text-warning-strong">
              <p>{needs.message}</p>
              <Checkbox label="I am the only person who can confirm here, and I checked it against the statement." checked={own} onChange={(e) => setOwn(e.currentTarget.checked)} />
              <Textarea label="How you checked" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
            </div>
          )}
          {problem && <p role="alert" className="text-sm text-danger">{problem}</p>}
          <div className="flex justify-end gap-2"><Button variant="default" onClick={close}>Cancel</Button><Button color="green" onClick={submit} loading={busy} disabled={(needs?.duplicate && !ack) || (needs?.self && (!own || note.trim().length < 5))}>Confirm payment</Button></div>
        </div>
      )}
    </Modal>
  );
}
