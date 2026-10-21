'use client';

import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Group, Modal, Skeleton, Stack, Switch, Text } from '@mantine/core';
import { bff } from '@/lib/bff';
import { ErrorState } from '@/components/ErrorState';
import { ReasonField } from '@/components/ReasonField';

interface ModuleStatus {
  code: string;
  name: string;
  isCore?: boolean;
  isEnabled: boolean;
  source: 'tenant_override' | 'plan' | 'default';
  override?: { reason: string; expiresAt: string | null };
}

const SOURCE_LABEL: Record<ModuleStatus['source'], string> = {
  tenant_override: 'Manual override',
  plan: 'From plan',
  default: 'Platform default',
};

/**
 * Every platform module for a tenant with its effective state and where that state comes from
 * (plan, platform default, or a manual override). Toggling creates a tenant override; "Reset to plan"
 * removes it so the plan decides again.
 */
export function TenantModulesManager({ associationId }: { associationId: number }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<{ module: ModuleStatus; enable: boolean } | null>(null);
  const [reason, setReason] = useState('');

  const q = useQuery({
    queryKey: ['assoc-modules', associationId],
    queryFn: () => bff<{ modules: ModuleStatus[] }>(`admin/tenants/${associationId}/modules`),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['assoc-modules', associationId] });

  const setOverride = useMutation({
    mutationFn: ({ code, enable, why }: { code: string; enable: boolean; why: string }) =>
      bff(`admin/tenants/${associationId}/modules/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleCode: code, isEnabled: enable, reason: why, overrideType: 'SUPPORT' }),
      }),
    onSuccess: (_d, vars) => {
      notifications.show({ message: `${vars.code} ${vars.enable ? 'enabled' : 'disabled'}`, color: vars.enable ? 'green' : 'orange' });
      refresh();
      closeModal();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const removeOverride = useMutation({
    mutationFn: (code: string) => bff(`admin/tenants/${associationId}/modules/${code}/override`, { method: 'DELETE' }),
    onSuccess: () => {
      notifications.show({ message: 'Override removed — the plan decides again', color: 'blue' });
      refresh();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  function closeModal() {
    setPending(null);
    setReason('');
  }

  if (q.isLoading) {
    return (
      <Stack gap="sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} h={64} radius="md" />
        ))}
      </Stack>
    );
  }
  if (q.isError) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;

  const modules = q.data?.modules ?? [];

  return (
    <>
      <Stack gap="sm">
        {modules.map((m) => (
          <Card
            key={m.code}
            style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
            p="md"
            radius="md"
          >
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={2}>
                <Group gap="xs">
                  <Text size="sm" fw={600}>
                    {m.name}
                  </Text>
                  {m.isCore ? (
                    <Badge size="xs" variant="light" color="gray">
                      Core
                    </Badge>
                  ) : null}
                  <Badge size="xs" variant="light" color={m.source === 'tenant_override' ? 'violet' : 'gray'}>
                    {SOURCE_LABEL[m.source]}
                  </Badge>
                </Group>
                {m.override?.reason ? (
                  <Text size="xs" c="dimmed">
                    {m.override.reason}
                  </Text>
                ) : null}
              </Stack>
              <Group gap="sm" wrap="nowrap">
                {m.source === 'tenant_override' ? (
                  <Button
                    variant="subtle"
                    size="xs"
                    color="gray"
                    loading={removeOverride.isPending && removeOverride.variables === m.code}
                    onClick={() => removeOverride.mutate(m.code)}
                  >
                    Reset to plan
                  </Button>
                ) : null}
                <Switch
                  checked={m.isEnabled}
                  onChange={(e) => setPending({ module: m, enable: e.currentTarget.checked })}
                  aria-label={`${m.isEnabled ? 'Disable' : 'Enable'} ${m.name}`}
                />
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>

      <Modal
        opened={pending !== null}
        onClose={closeModal}
        title={pending ? `${pending.enable ? 'Enable' : 'Disable'} ${pending.module.name}` : ''}
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This overrides the plan for this association only. It takes effect immediately and is recorded in the action log.
          </Text>
          <ReasonField value={reason} onChange={setReason} label="Reason" />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" size="sm" onClick={closeModal} disabled={setOverride.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              color={pending?.enable ? 'green' : 'orange'}
              disabled={reason.trim().length === 0}
              loading={setOverride.isPending}
              onClick={() => pending && setOverride.mutate({ code: pending.module.code, enable: pending.enable, why: reason })}
            >
              {pending?.enable ? 'Enable module' : 'Disable module'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
