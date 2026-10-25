'use client';

import { Group, Stack, Text, Title } from '@mantine/core';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { HelpLink } from '@/components/docs/HelpLink';
import { ProofQueuePanel } from '@/components/payments/ProofQueuePanel';

/** The payment proofs queue, reached from the admin sidebar and the Nigerian payments hub — same panel as Payment Verification. */
export default function PaymentVerificationQueue() {
  return (
    <div className="p-6">
      <Can
        permission={PERMISSIONS.PAYMENT_CONFIRM}
        fallback={
          <Text c="dimmed" ta="center" py="xl">
            You don&apos;t have permission to verify payments.
          </Text>
        }
      >
        <Stack gap="md">
          <Group gap="xs">
            <Title order={2}>Payment Verification Queue</Title>
            <HelpLink />
          </Group>
          <ProofQueuePanel />
        </Stack>
      </Can>
    </div>
  );
}
