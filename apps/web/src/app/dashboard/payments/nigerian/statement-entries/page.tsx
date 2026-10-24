'use client';

import Link from 'next/link';
import { Button, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Lines } from '@/components/payments/reconciliation/ReconciliationWorkbench';

/** The money received on imported statements that no charge has been matched to yet. */
export default function StatementEntriesPage() {
  return (
    <div>
      <Button component={Link} href="/dashboard/payments/nigerian/reconciliation" variant="subtle" leftSection={<IconArrowLeft size={16} />} mb="md">
        Back to Reconciliation
      </Button>
      <Title order={2} mb="xs">
        Unmatched lines
      </Title>
      <Text c="dimmed" mb="lg">
        Money received that no charge has been matched to. Choose the charge each line paid.
      </Text>
      <Lines />
    </div>
  );
}
