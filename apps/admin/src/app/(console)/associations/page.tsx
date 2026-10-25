'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Stack, Group, Button, Anchor, Text, Pagination, Badge,
} from '@mantine/core';
import { IconBuilding, IconExternalLink } from '@tabler/icons-react';
import Link from 'next/link';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { ErrorState } from '@/components/ErrorState';
import { tenantUrl } from '@/lib/tenant-url';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Association {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  tier: string;
  status: string;
  createdAt: string;
  _count: { users: number; members: number; transactions: number };
  subscriptions: { plan: { name: string }; status: string }[];
}

interface AssociationsResponse {
  associations: Association[];
  total: number;
  totalPages: number;
  page: number;
}

// ── Tier badge ─────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  ENTERPRISE: 'violet',
  PROFESSIONAL: 'blue',
  STARTER: 'gray',
};

function TierBadge({ tier }: { tier: string }) {
  return (
    <Badge
      variant="light"
      size="sm"
      color={TIER_COLOR[tier] ?? 'gray'}
      radius="sm"
      tt="capitalize"
    >
      {tier.toLowerCase()}
    </Badge>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AssociationsPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [status, setStatus] = useState<string | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Suspend modal state
  const [suspendTarget, setSuspendTarget] = useState<Association | null>(null);
  const [suspendOpened, { open: openSuspend, close: closeSuspend }] = useDisclosure(false);

  // Reactivate modal state
  const [reactivateTarget, setReactivateTarget] = useState<Association | null>(null);
  const [reactivateOpened, { open: openReactivate, close: closeReactivate }] = useDisclosure(false);

  const q = useQuery({
    queryKey: ['associations', page, debouncedSearch, status, tier],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status) params.set('status', status);
      if (tier) params.set('tier', tier);
      return bff<AssociationsResponse>(`admin/associations?${params}`);
    },
  });

  const suspendMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      bff(`admin/associations/${id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      notifications.show({ message: 'Association suspended', color: 'orange' });
      qc.invalidateQueries({ queryKey: ['associations'] });
      closeSuspend();
    },
    onError: (err: Error) => {
      notifications.show({ message: err.message, color: 'red' });
    },
  });

  const reactivateMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      bff(`admin/associations/${id}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      notifications.show({ message: 'Association reactivated', color: 'green' });
      qc.invalidateQueries({ queryKey: ['associations'] });
      closeReactivate();
    },
    onError: (err: Error) => {
      notifications.show({ message: err.message, color: 'red' });
    },
  });

  const hasActiveFilters = !!(debouncedSearch || status || tier);

  const associations = q.data?.associations ?? [];
  const totalPages = q.data?.totalPages ?? 1;

  return (
    <Stack gap="xl">
      <PageHeader
        title="Associations"
        description="All platform tenants — active, suspended, and cancelled"
      />

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

      {q.isError ? (
        <ErrorState
          message={(q.error as Error).message}
          onRetry={() => q.refetch()}
        />
      ) : (
        <DataTable
          loading={q.isLoading}
          rows={associations}
          rowKey={(r) => r.id}
          emptyMessage="No associations found"
          columns={[
            {
              key: 'name',
              header: 'Association',
              render: (r) => (
                <Stack gap={0}>
                  <Anchor component={Link} href={`/associations/${r.id}`} size="sm" fw={600}>
                    {r.name}
                  </Anchor>
                  <Text size="xs" c="dimmed">ID {r.id}</Text>
                </Stack>
              ),
            },
            {
              key: 'subdomain',
              header: 'Subdomain',
              render: (r) => (
                <Anchor
                  href={tenantUrl(r.subdomain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                >
                  <Group gap={4} wrap="nowrap">
                    <Text size="sm" inherit>{r.subdomain}</Text>
                    <IconExternalLink size={12} />
                  </Group>
                </Anchor>
              ),
            },
            {
              key: 'tier',
              header: 'Tier',
              render: (r) => <TierBadge tier={r.tier} />,
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <StatusBadge status={r.status} size="sm" />,
            },
            {
              key: 'plan',
              header: 'Plan',
              render: (r) =>
                r.subscriptions?.[0] ? (
                  <Text size="sm">{r.subscriptions[0].plan.name}</Text>
                ) : (
                  <Text size="sm" c="dimmed">—</Text>
                ),
            },
            {
              key: 'counts',
              header: 'Users / Members',
              render: (r) => (
                <Text size="sm" c="dimmed">
                  {r._count.users.toLocaleString()} / {r._count.members.toLocaleString()}
                </Text>
              ),
            },
            {
              key: 'createdAt',
              header: 'Created',
              render: (r) => (
                <Text size="sm" c="dimmed">
                  {new Date(r.createdAt).toLocaleDateString('en-GB')}
                </Text>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => (
                <Group gap="xs" wrap="nowrap">
                  <Button
                    component={Link}
                    href={`/associations/${r.id}`}
                    variant="default"
                    size="xs"
                    leftSection={<IconBuilding size={12} />}
                  >
                    View
                  </Button>
                  {r.status === 'ACTIVE' ? (
                    <Button
                      variant="light"
                      color="orange"
                      size="xs"
                      onClick={() => { setSuspendTarget(r); openSuspend(); }}
                    >
                      Suspend
                    </Button>
                  ) : r.status === 'SUSPENDED' ? (
                    <Button
                      variant="light"
                      color="green"
                      size="xs"
                      onClick={() => { setReactivateTarget(r); openReactivate(); }}
                    >
                      Reactivate
                    </Button>
                  ) : null}
                </Group>
              ),
            },
          ]}
        />
      )}

      {totalPages > 1 && (
        <Group justify="flex-end">
          <Pagination
            total={totalPages}
            value={page}
            onChange={setPage}
            size="sm"
          />
        </Group>
      )}

      {/* Suspend modal */}
      <ConfirmDestructive
        opened={suspendOpened}
        onClose={() => { closeSuspend(); setSuspendTarget(null); }}
        onConfirm={(reason) => {
          if (!suspendTarget) return;
          suspendMut.mutate({ id: suspendTarget.id, reason });
        }}
        loading={suspendMut.isPending}
        title="Suspend Association"
        description={`Suspending "${suspendTarget?.name}" will immediately block all users on this tenant. You can reactivate it at any time.`}
      />

      {/* Reactivate modal */}
      <ConfirmDestructive
        opened={reactivateOpened}
        onClose={() => { closeReactivate(); setReactivateTarget(null); }}
        onConfirm={(reason) => {
          if (!reactivateTarget) return;
          reactivateMut.mutate({ id: reactivateTarget.id, reason });
        }}
        loading={reactivateMut.isPending}
        title="Reactivate Association"
        description={`Reactivating "${reactivateTarget?.name}" will restore access for all users on this tenant.`}
      />
    </Stack>
  );
}
