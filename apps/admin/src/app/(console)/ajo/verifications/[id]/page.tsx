'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Alert, Button, Card, Checkbox, Group, Skeleton, Stack, Table, Text } from '@mantine/core';
import { bff } from '@/lib/bff';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState } from '@/components/ErrorState';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDestructive } from '@/components/ConfirmDestructive';
import { formatDate } from '@/lib/format';
import { REVIEW_ROLES, ajoKeys, errMessage, jsonPost, useAdminRole, type VerificationDetail } from '@/lib/ajo-admin';

const card = { backgroundColor: 'var(--admin-surface)', border: '1px solid var(--admin-border)' } as const;

const CHECKS = [
  { key: 'nameMatchesAccount', label: 'The name matches the payout account name' },
  { key: 'phoneConfirmed', label: 'The phone number is confirmed' },
  { key: 'addressFilled', label: 'The address is filled in' },
] as const;

type Checklist = Record<(typeof CHECKS)[number]['key'], boolean>;

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed">{label}</Text>
      {value ? <Text size="sm" fw={500} ta="right">{value}</Text> : <Text size="sm" c="dimmed" ta="right">Not entered</Text>}
    </Group>
  );
}

export default function VerificationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const { role } = useAdminRole();
  const canDecide = role !== null && (REVIEW_ROLES as readonly string[]).includes(role);
  const [checks, setChecks] = useState<Checklist>({ nameMatchesAccount: false, phoneConfirmed: false, addressFilled: false });
  const [rejecting, setRejecting] = useState(false);

  const q = useQuery({ queryKey: ajoKeys.verification(id), queryFn: () => bff<VerificationDetail>(`admin/ajo/verifications/${id}`), enabled: Number.isFinite(id) });
  const d = q.data;

  useEffect(() => {
    if (d && d.status !== 'PENDING') {
      setChecks({ nameMatchesAccount: !!d.checklist.nameMatchesAccount, phoneConfirmed: !!d.checklist.phoneConfirmed, addressFilled: !!d.checklist.addressFilled });
    }
  }, [d]);

  const decide = useMutation({
    mutationFn: (input: { decision: 'VERIFIED' | 'REJECTED'; reason?: string }) => bff(`admin/ajo/verifications/${id}/decision`, jsonPost({ ...input, checklist: checks })),
    onSuccess: (_r, v) => {
      notifications.show({ color: 'green', message: v.decision === 'VERIFIED' ? 'Verified.' : 'Rejected. The group admin has been told why.' });
      setRejecting(false);
      void qc.invalidateQueries({ queryKey: ['ajo', 'verification'] });
      void qc.invalidateQueries({ queryKey: ['ajo', 'verifications'] });
    },
    onError: (e) => notifications.show({ color: 'red', message: errMessage(e) }),
  });

  if (q.isLoading) return <Skeleton h={320} radius="lg" />;
  if (q.isError || !d) return <ErrorState message="Failed to load this verification" onRetry={() => q.refetch()} />;

  const pending = d.status === 'PENDING';
  const allPass = CHECKS.every((c) => checks[c.key]);
  const noAccount = !d.current.payoutAccount;

  return (
    <Stack gap="md" maw={760}>
      <PageHeader
        title={d.current.name}
        description={<>In {d.association.name}. <Link href="/ajo/verifications">Back to the queue</Link></>}
        actions={<StatusBadge status={d.status} size="md" />}
      />

      <Card style={card} p="lg" radius="lg">
        <Stack gap="sm">
          <Text fw={600}>What the person submitted</Text>
          <Field label="Full name" value={d.current.name} />
          <Field label="Phone" value={d.current.phone} />
          <Field label="Residential address" value={d.current.address} />
          <Field label="Payout account name" value={d.current.payoutAccountName} />
          <Field label="Payout account" value={d.current.payoutAccount ? `${d.current.payoutAccount.bankName} ${d.current.payoutAccount.masked}` : null} />
        </Stack>
      </Card>

      {noAccount && pending && (
        <Alert color="orange" title="No payout account yet">
          There is no account name to compare, so this person cannot be decided until they or an officer enter one.
        </Alert>
      )}

      <Card style={card} p="lg" radius="lg">
        <Stack gap="sm">
          <Text fw={600}>Checklist</Text>
          {CHECKS.map((c) => (
            <Checkbox
              key={c.key}
              label={c.label}
              checked={checks[c.key]}
              disabled={!pending || !canDecide}
              onChange={(e) => { const next = e.currentTarget.checked; setChecks((prev) => ({ ...prev, [c.key]: next })); }}
            />
          ))}
          {!pending && d.status === 'REJECTED' && d.rejectionReason && (
            <Alert color="red" title="Reason shown to the group admin">{d.rejectionReason}</Alert>
          )}
          {!pending && d.reviewedAt && <Text size="xs" c="dimmed">Decided {formatDate(d.reviewedAt)}</Text>}
          {pending && !canDecide && <Text size="sm" c="dimmed">You can view this review. Only a super admin or compliance admin can decide it.</Text>}
          {pending && canDecide && (
            <Group justify="flex-end" mt="xs">
              <Button color="red" variant="light" disabled={noAccount} onClick={() => setRejecting(true)}>Reject…</Button>
              <Button disabled={noAccount || !allPass} loading={decide.isPending} onClick={() => decide.mutate({ decision: 'VERIFIED' })}>Verify</Button>
            </Group>
          )}
          {pending && canDecide && !allPass && <Text size="xs" c="dimmed">Verify unlocks when all three checks pass. If one fails, reject with a reason.</Text>}
        </Stack>
      </Card>

      {d.history.length > 0 && (
        <Card style={card} p="lg" radius="lg">
          <Text fw={600} mb="sm">Earlier reviews of this person</Text>
          <Table withRowBorders>
            <Table.Tbody>
              {d.history.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td><StatusBadge status={h.status} /></Table.Td>
                  <Table.Td>{formatDate(h.reviewedAt ?? h.createdAt)}</Table.Td>
                  <Table.Td>{h.rejectionReason ?? ''}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <ConfirmDestructive
        opened={rejecting}
        onClose={() => setRejecting(false)}
        title="Reject this person"
        description="The reason is shown to the group admin so they know what to fix. Write at least 10 characters. Nobody can be paid out until they are verified."
        confirmLabel="Reject"
        loading={decide.isPending}
        onConfirm={async (reason) => {
          await decide.mutateAsync({ decision: 'REJECTED', reason });
        }}
      />
    </Stack>
  );
}
