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
  Modal
} from '@mantine/core';
import { 
  IconRefresh, 
  IconEdit, 
  IconTrash, 
  IconArrowLeft,
  IconBuildingBank,
  IconUser,
  IconCalendar,
  IconReceipt,
  IconClock
} from '@tabler/icons-react';
import nigerianPaymentsApi, { BankTransfer } from '@/lib/api/nigerian-payments';
import { TransferStatusBadge } from '@/components/payments/nigerian/TransferStatusBadge';

export default function BankTransferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const transferId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [transfer, setTransfer] = useState<BankTransfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

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
    setShowEditModal(true);
  };

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this bank transfer?')) {
      return;
    }
    router.push('/dashboard/payments/nigerian/transfers');
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
        <Button leftSection={<IconEdit size={20} />} onClick={handleEdit}>
          Edit Transfer
        </Button>
      </Group>

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
            <Button leftSection={<IconTrash size={20} />} color="red" onClick={handleDelete}>
              Delete Transfer
            </Button>
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
        <Text>
          Edit functionality coming soon. This will allow you to modify the transfer details.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={() => setShowEditModal(false)}>
            Close
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
