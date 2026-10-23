'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  Card, 
  Title, 
  Text, 
  Group, 
  Button, 
  Stack,
  Badge,
  Loader,
  Alert,
  SimpleGrid,
  Modal,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconRefresh,
  IconEdit,
  IconCheck,
  IconX,
  IconArrowLeft,
  IconBuildingBank,
  IconUser,
  IconCalendar,
  IconReceipt,
  IconClock
} from '@tabler/icons-react';
import nigerianPaymentsApi, { BankTransfer } from '@/lib/api/nigerian-payments';
import { TransferStatusBadge } from '@/components/payments/nigerian/TransferStatusBadge';
import { useTransferDecision } from '@/components/payments/useTransferDecision';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';

export default function BankTransferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const transferId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [transfer, setTransfer] = useState<BankTransfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({ reference: '', amount: '', senderAccountName: '', narration: '', notes: '' });
  // Verify / Reject: confirmation (or a required reason), the real API call, and a reload afterwards.
  const decision = useTransferDecision(() => loadTransfer());

  useEffect(() => {
    loadTransfer();
  }, [transferId]);

  const loadTransfer = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await nigerianPaymentsApi.getBankTransfer(transferId);
      setTransfer(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load bank transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (!transfer) return;
    setEdit({
      reference: transfer.reference,
      amount: String(transfer.amount),
      senderAccountName: transfer.senderAccountName ?? '',
      narration: transfer.narration ?? '',
      notes: transfer.notes ?? '',
    });
    setShowEditModal(true);
  };

  // Only a waiting transfer can be edited, and the status can't be changed here — verifying and rejecting are their own actions.
  const handleSaveEdit = async () => {
    if (!transfer) return;
    const amount = Number(edit.amount.replace(/,/g, ''));
    if (!edit.reference.trim() || !(amount > 0)) {
      notifications.show({ title: 'Check the details', message: 'Enter a reference and an amount above ₦0.', color: 'red' });
      return;
    }
    setSaving(true);
    try {
      await nigerianPaymentsApi.updateBankTransfer(transferId, {
        reference: edit.reference.trim(),
        amount,
        senderAccountName: edit.senderAccountName.trim() || undefined,
        narration: edit.narration.trim() || undefined,
        notes: edit.notes.trim() || undefined,
      });
      notifications.show({ title: 'Success', message: 'Transfer updated', color: 'green' });
      setShowEditModal(false);
      loadTransfer();
    } catch (err: any) {
      notifications.show({ title: 'Could not save', message: err.response?.data?.message || 'Try again.', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="xl" />
      </div>
    );
  }

  if (error && !transfer) {
    return (
      <div className="p-6">
        <Group justify="space-between" mb="md">
          <Title order={2}>Bank Transfer Details</Title>
          <Button leftSection={<IconRefresh size={20} />} onClick={loadTransfer}>
            Retry
          </Button>
        </Group>
        <Alert color="red" title="Error" icon={<IconRefresh />}>
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Group justify="space-between" mb="md">
        <Button leftSection={<IconArrowLeft size={20} />} variant="subtle" onClick={() => router.push('/dashboard/payments/nigerian/transfers')}>
          Back to Transfers
        </Button>
        {transfer?.status === 'PENDING' && (
          <Can permission={PERMISSIONS.PAYMENT_CREATE}>
            <Button leftSection={<IconEdit size={20} />} onClick={handleEdit}>
              Edit Transfer
            </Button>
          </Can>
        )}
      </Group>
      {decision.element}

      {error && (
        <Alert color="red" title="Error" icon={<IconRefresh />} mb="md" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {transfer && (
        <>
          {/* Transfer Summary Card */}
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" mb="xl">
            <Card shadow="sm" padding="lg" withBorder>
              <Stack align="center" gap="xs">
                <Text size="xl" fw={700} c="green">
                  ₦{transfer.amount.toLocaleString()}
                </Text>
                <Text size="sm" c="dimmed">
                  Transfer Amount
                </Text>
              </Stack>
            </Card>

            <Card shadow="sm" padding="lg" withBorder>
              <Stack align="center" gap="xs">
                <TransferStatusBadge status={transfer.status} />
              </Stack>
              <Text size="sm" c="dimmed" ta="center" mt="xs">
                Transfer Status
              </Text>
            </Card>

            <Card shadow="sm" padding="lg" withBorder>
              <Stack align="center" gap="xs">
                <Text size="xl" fw={700} c="blue">
                  {new Date(transfer.transferDate).toLocaleDateString()}
                </Text>
                <Text size="sm" c="dimmed">
                  Transfer Date
                </Text>
              </Stack>
            </Card>

            <Card shadow="sm" padding="lg" withBorder>
              <Stack align="center" gap="xs">
                <Text size="xl" fw={700} c="orange">
                  {new Date(transfer.createdAt).toLocaleString()}
                </Text>
                <Text size="sm" c="dimmed">
                  Created At
                </Text>
              </Stack>
            </Card>

            <Card shadow="sm" padding="lg" withBorder>
              <Stack align="center" gap="xs">
                <Text size="xl" fw={700} c="purple">
                  {transfer.verifiedAt ? new Date(transfer.verifiedAt).toLocaleString() : '-'}
                </Text>
                <Text size="sm" c="dimmed">
                  Verified At
                </Text>
              </Stack>
            </Card>
          </SimpleGrid>

          {/* Sender Information */}
          <Title order={3} mb="md">Sender Information</Title>
          <Card shadow="sm" padding="lg" withBorder mb="xl">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
              <Group gap="xs">
                <Text size="sm" c="dimmed">Sender Bank:</Text>
                <Text fw={600}>{transfer.senderBankName}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Sender Account:</Text>
                <Text fw={500} className="font-mono">{transfer.senderAccountNumber}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Sender Account Name:</Text>
                <Text fw={500}>{transfer.senderAccountName || '-'}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Narration:</Text>
                <Text>{transfer.narration || '-'}</Text>
              </Group>
            </SimpleGrid>
          </Card>

          {/* Receiving Bank Information */}
          <Title order={3} mb="md">Receiving Bank Information</Title>
          <Card shadow="sm" padding="lg" withBorder mb="xl">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
              <Group gap="xs">
                <Text size="sm" c="dimmed">Bank Name:</Text>
                <Text fw={600}>{transfer.receivingBankAccount?.bankName || '-'}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Account Name:</Text>
                <Text fw={600}>{transfer.receivingBankAccount?.accountName || '-'}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Account Number:</Text>
                <Text fw={500} className="font-mono">{transfer.receivingBankAccount?.accountNumber || '-'}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Bank Code:</Text>
                <Text fw={500}>{transfer.receivingBankAccount?.bankCode || '-'}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Description:</Text>
                <Text>{transfer.receivingBankAccount?.description || '-'}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Is Default:</Text>
                <Badge color={transfer.receivingBankAccount?.isDefault ? 'green' : 'gray'} variant="light">
                  {transfer.receivingBankAccount?.isDefault ? 'Yes' : 'No'}
                </Badge>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Status:</Text>
                <Badge color={transfer.receivingBankAccount?.isActive ? 'green' : 'red'} variant="light">
                  {transfer.receivingBankAccount?.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </Group>
            </SimpleGrid>
          </Card>

          {/* Member Information */}
          <Title order={3} mb="md">Member Information</Title>
          <Card shadow="sm" padding="lg" withBorder mb="xl">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
              {transfer.member ? (
                <>
                  <Group gap="xs">
                    <div className="text-blue-600">
                      <IconUser size={32} />
                    </div>
                    <div>
                      <Text size="sm" c="dimmed">Member Name:</Text>
                      <Text fw={600}>{transfer.member.firstName} {transfer.member.lastName}</Text>
                      <Text size="xs" c="dimmed">
                        ({transfer.member.memberId})
                      </Text>
                    </div>
                  </Group>

                  <Group gap="xs">
                    <Text size="sm" c="dimmed">Member ID:</Text>
                    <Text fw={500} className="font-mono">{transfer.member.memberId}</Text>
                  </Group>
                </>
              ) : (
                <Text size="sm" c="dimmed">No member linked to this transfer</Text>
              )}
            </SimpleGrid>
          </Card>

          {/* Reference Information */}
          <Title order={3} mb="md">Reference Information</Title>
          <Card shadow="sm" padding="lg" withBorder mb="xl">
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
              <Group gap="xs">
                <Text size="sm" c="dimmed">Reference:</Text>
                <Text fw={500} className="font-mono">{transfer.reference}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Created:</Text>
                <Text>{new Date(transfer.createdAt).toLocaleString()}</Text>
              </Group>

              <Group gap="xs">
                <Text size="sm" c="dimmed">Updated:</Text>
                <Text>{new Date(transfer.updatedAt).toLocaleString()}</Text>
              </Group>

              {transfer.verifiedBy && (
                <Group gap="xs">
                  <Text size="sm" c="dimmed">Verified By:</Text>
                  <Text>{transfer.verifiedBy}</Text>
                </Group>
              )}
            </SimpleGrid>
          </Card>

          {/* Actions */}
          <Group justify="flex-end" mt="xl">
            <Button leftSection={<IconRefresh size={20} />} onClick={loadTransfer} variant="subtle">
              Refresh
            </Button>
            {transfer.status === 'PENDING' && (
              <Can permission={PERMISSIONS.PAYMENT_CONFIRM}>
                <Button leftSection={<IconX size={20} />} color="red" variant="light" onClick={() => decision.start(transfer, 'REJECTED')}>
                  Reject
                </Button>
                <Button leftSection={<IconCheck size={20} />} color="green" onClick={() => decision.start(transfer, 'VERIFIED')}>
                  Verify transfer
                </Button>
              </Can>
            )}
          </Group>
        </>
      )}

      {/* Edit Modal */}
      <Modal
        opened={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Bank Transfer"
        size="lg"
      >
        <Stack>
          <TextInput label="Reference" required value={edit.reference} onChange={(e) => setEdit({ ...edit, reference: e.currentTarget.value })} />
          <TextInput label="Amount (₦)" required value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.currentTarget.value })} />
          <TextInput label="Sender's account name" value={edit.senderAccountName} onChange={(e) => setEdit({ ...edit, senderAccountName: e.currentTarget.value })} />
          <TextInput label="Narration" value={edit.narration} onChange={(e) => setEdit({ ...edit, narration: e.currentTarget.value })} />
          <Textarea label="Notes" minRows={2} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.currentTarget.value })} />
        </Stack>
        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={() => setShowEditModal(false)} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSaveEdit}>
            Save changes
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
