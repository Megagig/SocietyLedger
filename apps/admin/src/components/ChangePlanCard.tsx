'use client';

import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { IconArrowsExchange } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { ReasonField } from '@/components/ReasonField';

interface PlanOption {
  id: number;
  name: string;
  code: string;
  priceMonthly: number | string;
}

function fmtNaira(n: number | string) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(n));
}

/** Platform-admin plan change: moves the tenant onto another plan with no payment (support / override path). */
export function ChangePlanCard({
  associationId,
  currentPlanName,
}: {
  associationId: number;
  currentPlanName?: string;
}) {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const plans = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => bff<{ plans: PlanOption[] }>('admin/plans'),
    enabled: opened,
  });

  const mut = useMutation({
    mutationFn: () =>
      bff(`admin/tenants/${associationId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: Number(planId), reason }),
      }),
    onSuccess: () => {
      notifications.show({ message: 'Plan changed — modules now follow the new plan', color: 'green' });
      qc.invalidateQueries({ queryKey: ['assoc-detail', associationId] });
      qc.invalidateQueries({ queryKey: ['assoc-modules', associationId] });
      qc.invalidateQueries({ queryKey: ['associations'] });
      handleClose();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  function handleClose() {
    setPlanId(null);
    setReason('');
    close();
  }

  const options = (plans.data?.plans ?? []).map((p) => ({
    value: String(p.id),
    label: `${p.name} — ${fmtNaira(p.priceMonthly)}/month`,
    disabled: p.name === currentPlanName,
  }));

  return (
    <>
      <Card
        style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
        p="lg"
        radius="lg"
      >
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed">
              Current plan
            </Text>
            <Group gap="xs">
              <Text fw={600}>{currentPlanName ?? 'No plan'}</Text>
              {currentPlanName ? (
                <Badge variant="light" size="sm">
                  Active
                </Badge>
              ) : null}
            </Group>
            <Text size="xs" c="dimmed">
              Changing the plan updates the tenant&apos;s tier and which modules it can use. No payment is taken.
            </Text>
          </Stack>
          <Button variant="default" size="sm" leftSection={<IconArrowsExchange size={14} />} onClick={open}>
            Change plan
          </Button>
        </Group>
      </Card>

      <Modal opened={opened} onClose={handleClose} title="Change plan" centered size="md">
        <Stack gap="md">
          <Select
            label="New plan"
            placeholder={plans.isLoading ? 'Loading plans…' : 'Select a plan'}
            data={options}
            value={planId}
            onChange={setPlanId}
            allowDeselect={false}
            size="sm"
          />
          <ReasonField value={reason} onChange={setReason} label="Reason for the change" />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={handleClose} disabled={mut.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!planId || reason.trim().length === 0}
              loading={mut.isPending}
              onClick={() => mut.mutate()}
            >
              Change plan
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
