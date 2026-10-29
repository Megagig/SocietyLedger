'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  Stack, Card, Group, Text, Button, Switch, NumberInput,
  Skeleton, Alert, Divider, Badge, Select, TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconSettings } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { billingKeys, type BuilderPlan } from '@/lib/billing';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { AiSettingsSection } from './ai-section';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformSettings {
  maintenanceMode: boolean;
  allowNewSignups: boolean;
  /** Standalone thrift groups (Ajo only, no association) may sign up. Off until the owner opens it. */
  ajoStandaloneSignup?: boolean;
  requireEmailVerification: boolean;
  requireAdminApproval: boolean;
  enforceSubscriptionAccess: boolean;
  defaultTrialDays: number;
  maxAssociationsPerUser: number;
  onboardingPolicy: 'TRIAL' | 'COMPLIMENTARY' | 'BILLABLE';
  onboardingPlanCode: string;
  gracePeriodDays: number;
  expiryReminderDays: number[];
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
    // The API answers { settings, stats }; this page only edits the settings. Keeping the wrapper made Save send `{ settings, stats }`.
    queryFn: async () => (await bff<{ settings: PlatformSettings }>('admin/settings/platform')).settings,
  });

  const plansQ = useQuery({ queryKey: billingKeys.plans, queryFn: () => bff<BuilderPlan[]>('admin/billing/plans') });
  const [reminderText, setReminderText] = useState('');
  const [local, setLocal] = useState<PlatformSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (q.data && !dirty) {
      setLocal(q.data);
      setReminderText((q.data.expiryReminderDays ?? [7, 3, 1]).join(', '));
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
    if (q.data) { setLocal(q.data); setReminderText((q.data.expiryReminderDays ?? [7, 3, 1]).join(', ')); setDirty(false); }
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
                label="Allow standalone thrift groups to sign up"
                description="Lets a savings circle sign up on its own, with no association, and pay only for an Ajo tier. The page is at /signup/thrift. Needs “Allow new sign-ups” on as well."
                checked={local.ajoStandaloneSignup === true}
                onChange={(v) => update('ajoStandaloneSignup', v)}
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
                  <Text size="sm" fw={600}>Onboarding duration</Text>
                  <Text size="xs" c="dimmed">
                    How many days a new association gets under the onboarding policy below (the length of the free trial or the complimentary access). The clock starts when you approve the founding admin, not when they sign up.
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

          {/* Onboarding, expiry and reminders */}
          <SectionCard
            title="Onboarding, expiry and reminders"
            description="What a new association is given, how long access continues after a paid period ends, and when owners are reminded. Plans, prices and what they include are managed under Plans."
          >
            <Stack gap="lg">
              <Group justify="space-between" wrap="wrap" gap="md" align="flex-start">
                <Stack gap={2} style={{ flex: 1, minWidth: 260 }}>
                  <Text size="sm" fw={600}>Onboarding policy</Text>
                  <Text size="xs" c="dimmed">
                    Free trial: recorded as a trial. Complimentary: an unpaid subscription of the same length. Must pay first: no free time; the association chooses a plan and pays before it can start. In every case the period has a fixed end date.
                  </Text>
                </Stack>
                <Select
                  value={local.onboardingPolicy ?? 'TRIAL'}
                  onChange={(v) => update('onboardingPolicy', (v as PlatformSettings['onboardingPolicy']) ?? 'TRIAL')}
                  data={[
                    { value: 'TRIAL', label: 'Free trial' },
                    { value: 'COMPLIMENTARY', label: 'Complimentary access' },
                    { value: 'BILLABLE', label: 'Must pay first' },
                  ]}
                  allowDeselect={false}
                  size="sm"
                  w={220}
                />
              </Group>
              <Divider />
              <Group justify="space-between" wrap="wrap" gap="md" align="flex-start">
                <Stack gap={2} style={{ flex: 1, minWidth: 260 }}>
                  <Text size="sm" fw={600}>Plan given to new associations</Text>
                  <Text size="xs" c="dimmed">
                    New associations get whatever this plan includes at the time they register (its current published version). Changing the plan, or publishing a new version of it, never changes associations that already registered.
                  </Text>
                </Stack>
                <Select
                  value={local.onboardingPlanCode}
                  onChange={(v) => v && update('onboardingPlanCode', v)}
                  data={(plansQ.data ?? []).filter((p) => !p.isArchived && p.versions.some((v) => v.status === 'PUBLISHED')).map((p) => ({ value: p.code, label: p.name }))}
                  allowDeselect={false}
                  size="sm"
                  w={220}
                />
              </Group>
              <Divider />
              <Group justify="space-between" wrap="wrap" gap="md" align="flex-start">
                <Stack gap={2} style={{ flex: 1, minWidth: 260 }}>
                  <Text size="sm" fw={600}>Grace period after a paid period ends</Text>
                  <Text size="xs" c="dimmed">
                    Days an association can keep using the app after its paid period ends without renewing, so a late or delayed payment does not lock them out at once. After this, everything except billing and support is blocked. 0 turns it off. A free trial has no grace period.
                  </Text>
                </Stack>
                <NumberInput
                  value={local.gracePeriodDays ?? 3}
                  onChange={(v) => update('gracePeriodDays', typeof v === 'number' ? v : 0)}
                  min={0}
                  max={30}
                  step={1}
                  suffix=" days"
                  size="sm"
                  w={140}
                  allowDecimal={false}
                />
              </Group>
              <Divider />
              <Group justify="space-between" wrap="wrap" gap="md" align="flex-start">
                <Stack gap={2} style={{ flex: 1, minWidth: 260 }}>
                  <Text size="sm" fw={600}>Expiry reminders</Text>
                  <Text size="xs" c="dimmed">
                    How many days before a subscription or trial ends the association administrators are reminded, by email and in the app. Separate with commas, for example 7, 3, 1.
                  </Text>
                </Stack>
                <TextInput
                  value={reminderText}
                  onChange={(e) => {
                    setReminderText(e.currentTarget.value);
                    const days = e.currentTarget.value.split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= 60);
                    update('expiryReminderDays', Array.from(new Set(days)).sort((a, b) => b - a));
                  }}
                  size="sm"
                  w={220}
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
