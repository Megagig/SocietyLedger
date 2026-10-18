'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Stack, Group, Button, Text, Pagination,
  Badge, Switch, Anchor,
} from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

type TenantAction = 'suspend' | 'reactivate' | 'soft-delete' | 'restore' | 'force-logout' | 'permanent-delete';

interface Tenant {
  id: number;
  name: string;
  subdomain: string;
  tier: string;
  status: string;
  isDeleted: boolean;
  createdAt: string;
  userCount: number;
  memberCount: number;
  plan: { name: string; code: string } | null;
}

interface TenantsResponse {
  tenants: Tenant[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ── Action config ──────────────────────────────────────────────────────────────

const ACTION_META: Record<
  TenantAction,
  { title: string; description: (t: Tenant) => string; color: string; confirmValue?: boolean }
> = {
  suspend: {
    title: 'Suspend Tenant',
    description: (t) => `Suspending "${t.name}" will block all users immediately. You can reactivate at any time.`,
    color: 'orange',
  },
  reactivate: {
    title: 'Reactivate Tenant',
    description: (t) => `Reactivating "${t.name}" will restore access for all users on this tenant.`,
    color: 'green',
  },
  'soft-delete': {
    title: 'Delete Tenant',
    description: (t) => `Deleting "${t.name}" will hide it from all views. This is reversible — you can restore it later.`,
    color: 'red',
  },
  restore: {
    title: 'Restore Tenant',
    description: (t) => `Restoring "${t.name}" will make it visible and re-enable access.`,
    color: 'green',
  },
  'force-logout': {
    title: 'Force Logout All Users',
    description: (t) => `This will immediately invalidate all active sessions for "${t.name}". Users will need to log in again.`,
    color: 'orange',
  },
  'permanent-delete': {
    title: 'Permanently Delete Tenant',
    description: (t) =>
      `This is IRREVERSIBLE. All data for "${t.name}" — users, members, transactions, and files — will be permanently destroyed.`,
    color: 'red',
    confirmValue: true,
  },
};

// ── Tier badge ─────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = { ENTERPRISE: 'violet', PROFESSIONAL: 'blue', STARTER: 'gray' };

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [status, setStatus] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);

  // Action modal state
  const [actionTarget, setActionTarget] = useState<{ tenant: Tenant; action: TenantAction } | null>(null);
  const [actionOpened, { open: openAction, close: closeAction }] = useDisclosure(false);

  const q = useQuery({
    queryKey: ['tenants', page, debouncedSearch, status, tier, showDeleted],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status) params.set('status', status);
      if (tier) params.set('tier', tier);
      if (showDeleted) params.set('includeDeleted', 'true');
      return bff<TenantsResponse>(`admin/tenants?${params}`);
    },
  });

  const actionMut = useMutation({
    mutationFn: ({ tenant, action, reason }: { tenant: Tenant; action: TenantAction; reason: string }) => {
      if (action === 'permanent-delete') {
        return bff(`admin/tenants/${tenant.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmationToken: tenant.subdomain, reason }),
        });
      }
      return bff(`admin/tenants/${tenant.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: (_, { action }) => {
      const msgs: Record<TenantAction, string> = {
        suspend: 'Tenant suspended',
        reactivate: 'Tenant reactivated',
        'soft-delete': 'Tenant deleted',
        restore: 'Tenant restored',
        'force-logout': 'All users logged out',
        'permanent-delete': 'Tenant permanently deleted',
      };
      notifications.show({ message: msgs[action], color: action === 'reactivate' || action === 'restore' ? 'green' : 'orange' });
      qc.invalidateQueries({ queryKey: ['tenants'] });
      closeAction();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  function triggerAction(tenant: Tenant, action: TenantAction) {
    setActionTarget({ tenant, action });
    openAction();
  }

  const hasActiveFilters = !!(debouncedSearch || status || tier);
  const tenants = q.data?.tenants ?? [];
  const totalPages = q.data?.pagination.totalPages ?? 1;
  const meta = actionTarget ? ACTION_META[actionTarget.action] : null;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Tenant Operations"
        description="Manage tenant lifecycle — suspend, delete, restore, and force-logout"
      />

      <Group justify="space-between" wrap="wrap">
        <FilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search by name or subdomain…"
          filters={[
            {
              key: 'status',
              label: 'Status',
              value: status,
              onChange: (v) => { setStatus(v); setPage(1); },
              options: [
                { value: 'ACTIVE', label: 'Active' },
                { value: 'SUSPENDED', label: 'Suspended' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ],
            },
            {
              key: 'tier',
              label: 'Tier',
              value: tier,
              onChange: (v) => { setTier(v); setPage(1); },
              options: [
                { value: 'STARTER', label: 'Starter' },
                { value: 'PROFESSIONAL', label: 'Professional' },
                { value: 'ENTERPRISE', label: 'Enterprise' },
              ],
            },
          ]}
          hasActiveFilters={hasActiveFilters}
          onReset={() => { setSearch(''); setStatus(null); setTier(null); setPage(1); }}
        />
        <Switch
          label="Show deleted"
          checked={showDeleted}
          onChange={(e) => { setShowDeleted(e.currentTarget.checked); setPage(1); }}
          size="sm"
        />
      </Group>

      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          loading={q.isLoading}
          rows={tenants}
          rowKey={(r) => r.id}
          emptyMessage="No tenants found"
          columns={[
            {
              key: 'name',
              header: 'Tenant',
              render: (r) => (
                <Stack gap={0} style={{ opacity: r.isDeleted ? 0.5 : 1 }}>
                  <Anchor component={Link} href={`/associations/${r.id}`} size="sm" fw={600}>
                    {r.name}
                  </Anchor>
                  <Text size="xs" c="dimmed">{r.subdomain}</Text>
                  {r.isDeleted && (
                    <Text size="xs" c="red">deleted</Text>
                  )}
                </Stack>
              ),
            },
            {
              key: 'tier',
              header: 'Tier',
              render: (r) => (
                <Badge variant="light" size="sm" color={TIER_COLOR[r.tier] ?? 'gray'} tt="capitalize">
                  {r.tier.toLowerCase()}
                </Badge>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <StatusBadge status={r.status} size="sm" />,
            },
            {
              key: 'counts',
              header: 'Users / Members',
              render: (r) => (
                <Text size="sm" c="dimmed">
                  {r.userCount.toLocaleString()} / {r.memberCount.toLocaleString()}
                </Text>
              ),
            },
            {
              key: 'plan',
              header: 'Plan',
              render: (r) =>
                r.plan ? (
                  <Text size="sm">{r.plan.name}</Text>
                ) : (
                  <Text size="sm" c="dimmed">—</Text>
                ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => (
                <Group gap={4} wrap="wrap">
                  <Button
                    component={Link}
                    href={`/associations/${r.id}`}
                    variant="default"
                    size="xs"
                    leftSection={<IconBuilding size={12} />}
                  >
                    View
                  </Button>
                  {r.isDeleted ? (
                    <>
                      <Button variant="light" color="green" size="xs" onClick={() => triggerAction(r, 'restore')}>
                        Restore
                      </Button>
                      <Button variant="light" color="red" size="xs" onClick={() => triggerAction(r, 'permanent-delete')}>
                        Delete forever
                      </Button>
                    </>
                  ) : (
                    <>
                      {r.status === 'ACTIVE' ? (
                        <Button variant="light" color="orange" size="xs" onClick={() => triggerAction(r, 'suspend')}>
                          Suspend
                        </Button>
                      ) : (
                        <Button variant="light" color="green" size="xs" onClick={() => triggerAction(r, 'reactivate')}>
                          Reactivate
                        </Button>
                      )}
                      <Button variant="light" color="orange" size="xs" onClick={() => triggerAction(r, 'force-logout')}>
                        Logout all
                      </Button>
                      <Button variant="light" color="red" size="xs" onClick={() => triggerAction(r, 'soft-delete')}>
                        Delete
                      </Button>
                    </>
                  )}
                </Group>
              ),
            },
          ]}
        />
      )}

      {totalPages > 1 && (
        <Group justify="flex-end">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}

      {actionTarget && meta && (
        <ConfirmDestructive
          opened={actionOpened}
          onClose={() => { closeAction(); setActionTarget(null); }}
          onConfirm={(reason) => {
            if (!actionTarget) return;
            actionMut.mutate({ tenant: actionTarget.tenant, action: actionTarget.action, reason });
          }}
          loading={actionMut.isPending}
          title={meta.title}
          description={meta.description(actionTarget.tenant)}
          confirmValue={meta.confirmValue ? actionTarget.tenant.subdomain : undefined}
          confirmLabel={
            meta.confirmValue
              ? `Type "${actionTarget.tenant.subdomain}" to confirm permanent deletion`
              : undefined
          }
        />
      )}
    </Stack>
  );
}
