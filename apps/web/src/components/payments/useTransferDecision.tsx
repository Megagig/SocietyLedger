'use client';

import { useState, type ReactElement } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { nigerianPaymentsApi } from '@/lib/api/nigerian-payments';

type Action = 'VERIFIED' | 'REJECTED';
type Target = { id: string | number; label: string; action: Action };

/**
 * Verifying or rejecting a bank transfer, in one place for every web page that offers it. A transfer is decided once; verifying
 * confirms the money reached the account (it records no payment — that happens when a member's proof is verified or a reconciliation
 * is confirmed); rejecting needs a reason. The API's message is shown as is when it refuses (for example, someone decided it first).
 */
export function useTransferDecision(onDecided: () => void): {
  start: (transfer: { id: string | number; reference?: string }, action: Action) => void;
  element: ReactElement;
} {
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setTarget(null);
    setReason('');
  };

  const submit = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      await nigerianPaymentsApi.verifyBankTransfer(target.id, {
        status: target.action,
        notes: target.action === 'REJECTED' ? reason.trim() : undefined,
      });
      notifications.show({
        title: target.action === 'VERIFIED' ? 'Transfer verified' : 'Transfer rejected',
        message: target.action === 'VERIFIED' ? 'The money is confirmed in your account.' : 'The reason has been saved on the transfer.',
        color: 'green',
      });
      close();
      onDecided();
    } catch (err: any) {
      notifications.show({ title: 'Could not save your decision', message: err.response?.data?.message || 'Try again.', color: 'red' });
      close();
      onDecided();
    } finally {
      setSubmitting(false);
    }
  };

  const verifying = target?.action === 'VERIFIED';

  const element = (
    <Modal opened={target !== null} onClose={close} title={verifying ? 'Verify this transfer?' : 'Reject this transfer?'} size="md">
      <Stack>
        {verifying ? (
          <Alert color="green">
            This confirms the money reached your account. It does not credit the member — do that by verifying their payment proof or matching
            the transfer in reconciliation. You can&apos;t undo it.
          </Alert>
        ) : (
          <>
            <Text size="sm">Use this when the transfer isn&apos;t genuine or isn&apos;t in your bank statement. You can&apos;t undo it.</Text>
            <Textarea
              label="Reason"
              placeholder="Why are you rejecting this transfer?"
              required
              minRows={3}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            />
          </>
        )}
        {target?.label && (
          <Text size="xs" c="dimmed">
            {target.label}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={close} disabled={submitting}>
            {verifying ? 'Not yet' : 'Keep it'}
          </Button>
          <Button color={verifying ? 'green' : 'red'} loading={submitting} disabled={!verifying && reason.trim().length < 3} onClick={submit}>
            {verifying ? 'Verify transfer' : 'Reject transfer'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  return {
    start: (transfer, action) => setTarget({ id: transfer.id, label: transfer.reference ? `Reference ${transfer.reference}` : '', action }),
    element,
  };
}
