'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  Stack, Card, Group, Text, Button, Switch, NumberInput,
  Skeleton, Alert, Divider, Badge,
} from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconSettings } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { AiSettingsSection } from './ai-section';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformSettings {
  maintenanceMode: boolean;
  allowNewSignups: boolean;
  requireEmailVerification: boolean;
  requireAdminApproval: boolean;
  enforceSubscriptionAccess: boolean;
  defaultTrialDays: number;
  maxAssociationsPerUser: number;
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
      p="xl"
      radius="lg"
    >
      <Stack gap="xs" mb="lg">
        <Text fw={700} size="md">{title}</Text>
        {description && <Text size="sm" c="dimmed">{description}</Text>}
      </Stack>
      {children}
    </Card>
  );
}

// ── Toggle row ─────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  danger,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
      <Stack gap={2} style={{ flex: 1 }}>
        <Group gap="xs">
          <Text size="sm" fw={600}>{label}</Text>
          {danger && checked && (
            <Badge color="orange" size="xs" variant="light">Active</Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed">{description}</Text>
      </Stack>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
        color={danger ? 'orange' : 'blue'}
        size="sm"
      />
    </Group>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformSettingsPage() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => bff<PlatformSettings>('admin/settings/platform'),
  });

  const [local, setLocal] = useState<PlatformSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data && !dirty) {
      setLocal(q.data);
    }
  }, [q.data, dirty]);

  const saveMut = useMutation({
    mutationFn: (settings: PlatformSettings) =>
      bff('admin/settings/platform', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      }),
    onSuccess: () => {
      notifications.show({ message: 'Platform settings saved', color: 'green' });
      qc.invalidateQueries({ queryKey: ['platform-settings'] });
      setDirty(false);
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  function update<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setLocal((prev) => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  }

  function reset() {
    if (q.data) { setLocal(q.data); setDirty(false); }
  }

  if (q.isError) {
    return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Platform Settings"
        description="Global configuration for the SocietyLedger platform"
        actions={
          dirty ? (
            <Group gap="sm">
              <Button variant="default" size="sm" onClick={reset} disabled={saveMut.isPending}>
                Discard
              </Button>
              <Button
                size="sm"
                leftSection={<IconCheck size={14} />}
                loading={saveMut.isPending}
                onClick={() => local && saveMut.mutate(local)}
              >
                Save changes
              </Button>
            </Group>
          ) : undefined
        }
      />

      {dirty && (
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
          You have unsaved changes. Save or discard before leaving.
        </Alert>
      )}

      {q.isLoading || !local ? (
        <Stack gap="md">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} h={200} radius="lg" />)}
        </Stack>
      ) : (
        <>
          {/* Critical settings */}
          <SectionCard
            title="Platform access"
            description="Control who can access the platform and how sign-ups are handled."
          >
            <Stack gap="md">
              <ToggleRow
                label="Maintenance mode"
                description="Blocks all non-admin access. Enable only for planned maintenance windows."
                checked={local.maintenanceMode}
                onChange={(v) => update('maintenanceMode', v)}
                danger
              />
              <Divider />
              <ToggleRow
                label="Allow new sign-ups"
                description="When disabled, the public registration flow is closed. Existing tenants are unaffected."
                checked={local.allowNewSignups}
                onChange={(v) => update('allowNewSignups', v)}
              />
              <Divider />
              <ToggleRow
                label="Require email verification"
                description="New accounts must verify their email address before they can log in."
                checked={local.requireEmailVerification}
                onChange={(v) => update('requireEmailVerification', v)}
              />
              <Divider />
              <ToggleRow
                label="Require admin approval"
                description="New accounts must be approved by a platform admin before gaining access. Visible in the Approvals screen."
                checked={local.requireAdminApproval}
                onChange={(v) => update('requireAdminApproval', v)}
              />
              <Divider />
              <ToggleRow
                label="Block associations whose trial or subscription has ended"
                description="When on, an association is blocked (admins and members) as soon as its free trial or paid plan runs out, until a payment is made. Switch off only to let everyone in while you sort out a billing problem."
                checked={local.enforceSubscriptionAccess !== false}
                onChange={(v) => update('enforceSubscriptionAccess', v)}
                danger
              />
            </Stack>
          </SectionCard>

          {/* Limits */}
          <SectionCard
            title="Defaults & limits"
            description="Numeric defaults applied to all new tenants unless overridden per-association."
          >
            <Stack gap="lg">
              <Group justify="space-between" wrap="wrap" gap="md">
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="sm" fw={600}>Default trial days</Text>
                  <Text size="xs" c="dimmed">
                    How many days of free Enterprise access a new association gets. The clock starts when you approve the founding admin, not when they sign up.
                  </Text>
                </Stack>
                <NumberInput
                  value={local.defaultTrialDays}
                  onChange={(v) => update('defaultTrialDays', typeof v === 'number' ? v : 0)}
                  min={1}
                  max={90}
                  step={1}
                  suffix=" days"
                  size="sm"
                  w={140}
                  allowDecimal={false}
                />
              </Group>
              <Divider />
              <Group justify="space-between" wrap="wrap" gap="md">
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="sm" fw={600}>Max associations per user</Text>
                  <Text size="xs" c="dimmed">
                    Maximum number of associations a single user account can own or admin.
                  </Text>
                </Stack>
                <NumberInput
                  value={local.maxAssociationsPerUser}
                  onChange={(v) => update('maxAssociationsPerUser', typeof v === 'number' ? v : 1)}
                  min={1}
                  max={100}
                  step={1}
                  size="sm"
                  w={140}
                  allowDecimal={false}
                />
              </Group>
            </Stack>
          </SectionCard>

          <AiSettingsSection />

          {/* Maintenance mode banner */}
          {local.maintenanceMode && (
            <Alert
              icon={<IconSettings size={16} />}
              color="orange"
              variant="filled"
            >
              <Text fw={700} size="sm">Maintenance mode is ON</Text>
              <Text size="xs" mt={4}>
                All non-admin users are currently blocked from accessing the platform.
                Remember to turn this off when maintenance is complete.
              </Text>
            </Alert>
          )}
        </>
      )}
    </Stack>
  );
}
