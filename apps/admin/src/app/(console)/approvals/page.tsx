'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Stack, Group, Button, Text, Pagination, Badge,
  Checkbox, Modal, Textarea, ActionIcon, Tooltip,
} from '@mantine/core';
import { IconCheck, IconX, IconCheckbox } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { FilterBar } from '@/components/FilterBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ErrorState } from '@/components/ErrorState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Approval {
  id: number;
  approvalStatus: string;
  createdAt: string;
  user: {
    id: number;
    email: string;
    role: string;
    emailVerified: boolean;
    createdAt: string;
    association: { id: number; name: string; subdomain: string } | null;
  };
}

interface ApprovalsResponse {
  approvals: Approval[];
  total: number;
  totalPages: number;
}

// ── Reject modal ───────────────────────────────────────────────────────────────

function RejectModal({
  opened,
  onClose,
  onConfirm,
  loading,
}: {
  opened: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  function handleClose() {
    setReason('');
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Reject Approval" centered size="sm">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Optionally provide a reason. The applicant will not receive this reason automatically,
          but it will be recorded in the audit log.
        </Text>
        <Textarea
          label="Reason (optional)"
          placeholder="e.g. Duplicate account, unverified details…"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          minRows={2}
          size="sm"
        />
        <Group justify="flex-end">
          <Button variant="default" size="sm" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button color="red" size="sm" loading={loading} onClick={() => onConfirm(reason)}>
            Reject
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [statusFilter, setStatusFilter] = useState<string | null>('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Reject single modal
  const [rejectTarget, setRejectTarget] = useState<Approval | null>(null);
  const [rejectOpened, { open: openReject, close: closeReject }] = useDisclosure(false);

  // Bulk reject modal
  const [bulkRejectOpened, { open: openBulkReject, close: closeBulkReject }] = useDisclosure(false);

  const q = useQuery({
    queryKey: ['approvals', page, debouncedSearch, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      return bff<ApprovalsResponse>(`admin/approvals?${params}`);
    },
  });

  const approveMut = useMutation({
    mutationFn: (userId: number) =>
      bff(`admin/approvals/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      }),
    onSuccess: () => {
      notifications.show({ message: 'User approved', color: 'green' });
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason?: string }) =>
      bff(`admin/approvals/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectionReason: reason }),
      }),
    onSuccess: () => {
      notifications.show({ message: 'User rejected', color: 'orange' });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      closeReject();
      setRejectTarget(null);
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const bulkApproveMut = useMutation({
    mutationFn: (userIds: number[]) =>
      bff('admin/approvals/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, status: 'approved' }),
      }),
    onSuccess: (_, userIds) => {
      notifications.show({ message: `${userIds.length} users approved`, color: 'green' });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setSelected(new Set());
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const bulkRejectMut = useMutation({
    mutationFn: ({ userIds, reason }: { userIds: number[]; reason?: string }) =>
      bff('admin/approvals/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds, status: 'rejected', rejectionReason: reason }),
      }),
    onSuccess: (_, { userIds }) => {
      notifications.show({ message: `${userIds.length} users rejected`, color: 'orange' });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setSelected(new Set());
      closeBulkReject();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const approvals = q.data?.approvals ?? [];
  const totalPages = q.data?.totalPages ?? 1;
  const hasActiveFilters = !!(debouncedSearch || (statusFilter && statusFilter !== 'pending'));
  const allSelected = approvals.length > 0 && approvals.every((a) => selected.has(a.user.id));
  const selectedIds = Array.from(selected);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(approvals.map((a) => a.user.id)));
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="User Approvals"
        description="Review and approve or reject pending user registration requests"
        actions={
          selected.size > 0 ? (
            <Group gap="xs">
              <Text size="sm" c="dimmed">{selected.size} selected</Text>
              <Button
                size="sm"
                color="green"
                leftSection={<IconCheck size={14} />}
                loading={bulkApproveMut.isPending}
                onClick={() => bulkApproveMut.mutate(selectedIds)}
              >
                Approve all
              </Button>
              <Button
                size="sm"
                color="red"
                variant="light"
                leftSection={<IconX size={14} />}
                onClick={openBulkReject}
              >
                Reject all
              </Button>
            </Group>
          ) : undefined
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by email or association…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: (v) => { setStatusFilter(v); setPage(1); },
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ],
          },
        ]}
        hasActiveFilters={hasActiveFilters}
        onReset={() => { setSearch(''); setStatusFilter('pending'); setPage(1); }}
      />

      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : (
        <DataTable
          loading={q.isLoading}
          rows={approvals}
          rowKey={(r) => r.id}
          emptyMessage={statusFilter === 'pending' ? '✓ All caught up — no pending approvals' : 'No approvals found'}
          columns={[
            {
              key: 'select',
              header: '',
              width: 40,
              render: (r) => (
                <Checkbox
                  size="sm"
                  checked={selected.has(r.user.id)}
                  onChange={(e) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (e.currentTarget.checked) next.add(r.user.id);
                      else next.delete(r.user.id);
                      return next;
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ),
            },
            {
              key: 'email',
              header: 'Email',
              render: (r) => (
                <Stack gap={0}>
                  <Text size="sm" fw={600}>{r.user.email}</Text>
                  <Group gap="xs">
                    <Badge
                      size="xs"
                      variant="light"
                      color={r.user.emailVerified ? 'green' : 'red'}
                    >
                      {r.user.emailVerified ? 'Email verified' : 'Not verified'}
                    </Badge>
                  </Group>
                </Stack>
              ),
            },
            {
              key: 'association',
              header: 'Association',
              render: (r) =>
                r.user.association ? (
                  <Stack gap={0}>
                    <Text size="sm">{r.user.association.name}</Text>
                    <Text size="xs" c="dimmed">{r.user.association.subdomain}</Text>
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">—</Text>
                ),
            },
            {
              key: 'role',
              header: 'Role',
              render: (r) => (
                <Badge variant="light" size="sm" color={r.user.role === 'admin' ? 'violet' : 'gray'}>
                  {r.user.role}
                </Badge>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => <StatusBadge status={r.approvalStatus} size="sm" />,
            },
            {
              key: 'date',
              header: 'Registered',
              render: (r) => (
                <Text size="sm" c="dimmed">
                  {new Date(r.createdAt).toLocaleDateString('en-GB')}
                </Text>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) =>
                r.approvalStatus === 'pending' ? (
                  <Group gap="xs" wrap="nowrap">
                    <Tooltip label="Approve">
                      <ActionIcon
                        color="green"
                        variant="light"
                        size="sm"
                        loading={approveMut.isPending && approveMut.variables === r.user.id}
                        onClick={() => approveMut.mutate(r.user.id)}
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Reject">
                      <ActionIcon
                        color="red"
                        variant="light"
                        size="sm"
                        onClick={() => { setRejectTarget(r); openReject(); }}
                      >
                        <IconX size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">—</Text>
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

      {/* Single reject modal */}
      <RejectModal
        opened={rejectOpened}
        onClose={() => { closeReject(); setRejectTarget(null); }}
        loading={rejectMut.isPending}
        onConfirm={(reason) => {
          if (!rejectTarget) return;
          rejectMut.mutate({ userId: rejectTarget.user.id, reason: reason || undefined });
        }}
      />

      {/* Bulk reject modal */}
      <RejectModal
        opened={bulkRejectOpened}
        onClose={closeBulkReject}
        loading={bulkRejectMut.isPending}
        onConfirm={(reason) =>
          bulkRejectMut.mutate({ userIds: selectedIds, reason: reason || undefined })
        }
      />
    </Stack>
  );
}
