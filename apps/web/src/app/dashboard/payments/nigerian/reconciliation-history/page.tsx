'use client';

import Link from 'next/link';
import { Button, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Matches } from '@/components/payments/reconciliation/ReconciliationWorkbench';

/** Every match that was proposed, confirmed or turned down. */
export default function ReconciliationHistoryPage() {
  return (
    <div>
      <Button component={Link} href="/dashboard/payments/nigerian/reconciliation" variant="subtle" leftSection={<IconArrowLeft size={16} />} mb="md">
        Back to Reconciliation
      </Button>
      <Title order={2} mb="xs">
        Reconciliation history
      </Title>
      <Text c="dimmed" mb="lg">
        Matches waiting to be confirmed, confirmed matches, and ones that were turned down.
      </Text>
      <Matches />
    </div>
  );
}
