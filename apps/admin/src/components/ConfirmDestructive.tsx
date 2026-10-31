'use client';

import { useState } from 'react';
import { Modal, Button, Text, TextInput, Stack, Group } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { ReasonField } from './ReasonField';

interface ConfirmDestructiveProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  description: string;
  /** When set, user must type this value to confirm (e.g. subdomain for permanent delete) */
  confirmValue?: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDestructive({
  opened,
  onClose,
  onConfirm,
  title,
  description,
  confirmValue,
  confirmLabel,
  loading,
}: ConfirmDestructiveProps) {
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');

  const canSubmit =
    reason.trim().length > 0 &&
    (!confirmValue || typed.trim() === confirmValue);

  async function handleConfirm() {
    if (!canSubmit) return;
    try {
      await onConfirm(reason);
    } catch {
      // The action failed (the caller shows why): keep the reason the person typed so they can fix it and try again.
      return;
    }
    setReason('');
    setTyped('');
  }

  function handleClose() {
    setReason('');
    setTyped('');
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconAlertTriangle size={18} color="var(--admin-danger-zone-border)" />
          <Text fw={600} c="red">{title}</Text>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">{description}</Text>

        <ReasonField value={reason} onChange={setReason} />

        {confirmValue && (
          <TextInput
            label={confirmLabel ?? `Type "${confirmValue}" to confirm`}
            placeholder={confirmValue}
            value={typed}
            onChange={(e) => setTyped(e.currentTarget.value)}
            size="sm"
            error={typed.length > 0 && typed !== confirmValue ? 'Does not match' : undefined}
          />
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="default" size="sm" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="red"
            size="sm"
            disabled={!canSubmit}
            loading={loading}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
