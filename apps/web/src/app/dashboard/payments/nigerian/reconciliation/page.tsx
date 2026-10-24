'use client';

import Link from 'next/link';
import { Button, Group, Text, Title } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { ReconciliationWorkbench } from '@/components/payments/reconciliation/ReconciliationWorkbench';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';

/** Reconciliation: which charge each line of money received paid. Another officer confirms every match. */
export default function ReconciliationPage() {
  return (
    <div>
      <Group justify="space-between" mb="lg" wrap="wrap">
        <div>
          <Title order={2}>Reconciliation</Title>
          <Text c="dimmed">Match the money in your bank statement to charges. Nothing is recorded until another officer confirms.</Text>
        </div>
        <Can permission={PERMISSIONS.TRANSACTION_CREATE}>
          <Button component={Link} href="/dashboard/payments/nigerian/statements" leftSection={<IconUpload size={16} />}>
            Import a statement
          </Button>
        </Can>
      </Group>
      <ReconciliationWorkbench />
    </div>
  );
}
