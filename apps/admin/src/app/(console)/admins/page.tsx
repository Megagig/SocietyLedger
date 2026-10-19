'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Stack, Group, Button, Text, Badge, Modal, TextInput, Select, Card,
} from '@mantine/core';
import { IconPlus, IconTrash, IconUserShield } from '@tabler/icons-react';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { ErrorState } from '@/components/ErrorState';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';

// ── Types ─────────────────────────────────────────────────────────────────────

type PlatformRole = 'SUPER_ADMIN' | 'SUPPORT_AGENT' | 'FINANCE_ADMIN' | 'COMPLIANCE_ADMIN';

interface PlatformAdmin {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  platformRole: PlatformRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface PendingInvite {
  id: number;
  email: string;
  platformRole: PlatformRole;
  invitedBy: { id: number; email: string };
  expiresAt: string;
  createdAt: string;
}

interface AdminsResponse {
  admins: PlatformAdmin[];
  invites: PendingInvite[];
}

const ROLE_LABELS: Record<PlatformRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  SUPPORT_AGENT: 'Support Agent',
  FINANCE_ADMIN: 'Finance Admin',
  COMPLIANCE_ADMIN: 'Compliance Admin',
};

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

function adminName(a: PlatformAdmin) {
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ');
  return name || a.email;
}

// ── Invite modal ─────────────────────────────────────────────────────────────

function InviteAdminModal({ opened, onClose, onInvited }: {
  opened: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [platformRole, setPlatformRole] = useState<string | null>('SUPPORT_AGENT');

  const mut = useMutation({
    mutationFn: () => bff('admin/platform-admins/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, platformRole }),
    }),
    onSuccess: () => {
      notifications.show({ message: `Invite sent to ${email}`, color: 'green' });
      setEmail('');
      setPlatformRole('SUPPORT_AGENT');
      onClose();
      onInvited();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Invite platform admin" size="sm" centered>
      <Stack gap="md">
        <TextInput
          label="Email"
          placeholder="name@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
          size="sm"
        />
        <Select
          label="Role"
          value={platformRole}
          onChange={setPlatformRole}
          data={ROLE_OPTIONS}
          allowDeselect={false}
          size="sm"
        />
        <Group justify="flex-end">
          <Button variant="default" size="sm" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button
            size="sm"
            loading={mut.isPending}
            disabled={!email.trim() || !platformRole}
            onClick={() => mut.mutate()}
          >
            Send invite
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminsPage() {
  const qc = useQueryClient();
  const [inviteOpened, { open: openInvite, close: closeInvite }] = useDisclosure(false);
  const [revokeTarget, setRevokeTarget] = useState<PendingInvite | null>(null);
  const [revokeOpened, { open: openRevoke, close: closeRevoke }] = useDisclosure(false);

  const adminsQ = useQuery({
    queryKey: ['platform-admins'],
    queryFn: () => bff<AdminsResponse>('admin/platform-admins'),
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => bff(`admin/platform-admins/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notifications.show({ message: 'Invite revoked', color: 'green' });
      qc.invalidateQueries({ queryKey: ['platform-admins'] });
      closeRevoke();
      setRevokeTarget(null);
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: 'red' }),
  });

  const admins = adminsQ.data?.admins ?? [];
  const invites = adminsQ.data?.invites ?? [];

  return (
    <Stack gap="xl">
      <PageHeader
        title="Platform Admins"
        description="Manage who has access to the admin console"
        actions={
          <Button size="sm" leftSection={<IconPlus size={14} />} onClick={openInvite}>
            Invite admin
          </Button>
        }
      />

      {adminsQ.isError ? (
        <ErrorState message={(adminsQ.error as Error).message} onRetry={() => adminsQ.refetch()} />
      ) : (
        <>
          <DataTable
            loading={adminsQ.isLoading}
            rows={admins}
            rowKey={(r) => r.id}
            emptyMessage="No platform admins found"
            columns={[
              {
                key: 'admin',
                header: 'Admin',
                render: (r) => (
                  <Stack gap={0}>
                    <Text size="sm" fw={600}>{adminName(r)}</Text>
                    <Text size="xs" c="dimmed">{r.email}</Text>
                  </Stack>
                ),
              },
              {
                key: 'role',
                header: 'Role',
                render: (r) => (
                  <Badge variant="light" size="sm" color={r.platformRole === 'SUPER_ADMIN' ? 'violet' : 'blue'}>
                    {ROLE_LABELS[r.platformRole]}
                  </Badge>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <Badge variant="light" size="sm" color={r.isActive ? 'green' : 'gray'}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                ),
              },
              {
                key: 'lastLogin',
                header: 'Last login',
                render: (r) => (
                  <Text size="xs" c="dimmed">
                    {r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString('en-GB') : 'Never'}
                  </Text>
                ),
              },
            ]}
          />

          {invites.length > 0 && (
            <Stack gap="sm">
              <Text size="sm" fw={600}>Pending invites</Text>
              <Card
                style={{ backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
                p="sm"
                radius="md"
              >
                <Stack gap="xs">
                  {invites.map((inv) => (
                    <Group key={inv.id} justify="space-between" wrap="wrap">
                      <Group gap="xs">
                        <IconUserShield size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
                        <Text size="sm">{inv.email}</Text>
                        <Badge variant="light" size="xs">{ROLE_LABELS[inv.platformRole]}</Badge>
                        <Text size="xs" c="dimmed">invited by {inv.invitedBy.email}</Text>
                      </Group>
                      <Button
                        variant="subtle" size="compact-xs" color="red"
                        leftSection={<IconTrash size={12} />}
                        onClick={() => { setRevokeTarget(inv); openRevoke(); }}
                      >
                        Revoke
                      </Button>
                    </Group>
                  ))}
                </Stack>
              </Card>
            </Stack>
          )}
        </>
      )}

      <InviteAdminModal
        opened={inviteOpened}
        onClose={closeInvite}
        onInvited={() => qc.invalidateQueries({ queryKey: ['platform-admins'] })}
      />

      {revokeTarget && (
        <ConfirmDestructive
          opened={revokeOpened}
          onClose={() => { closeRevoke(); setRevokeTarget(null); }}
          onConfirm={() => revokeMut.mutate(revokeTarget.id)}
          loading={revokeMut.isPending}
          title="Revoke invite"
          description={`Revoke the pending invite for ${revokeTarget.email}?`}
        />
      )}
    </Stack>
  );
}
