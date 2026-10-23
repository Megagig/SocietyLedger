'use client';

import { useEffect, useState } from 'react';
import { Card, Title, Text, Group, Stack, Table, Badge, Tabs } from '@mantine/core';
import { CheckCircle, X, FileText, Clock } from 'lucide-react';
import { Can } from '@/hooks/usePermissions';
import { nigerianPaymentsApi, type BankTransfer } from '@/lib/api/nigerian-payments';
import { notifications } from '@mantine/notifications';
import { PERMISSIONS } from '@/lib/permissions';
import { HelpLink } from '@/components/docs/HelpLink';
import { ProofQueuePanel } from '@/components/payments/ProofQueuePanel';

export default function VerificationPage() {
  const [bankTransfers, setBankTransfers] = useState<BankTransfer[]>([]);
  const [waitingProofs, setWaitingProofs] = useState(0);

  const accessDeniedFallback = (
    <Stack align="center" gap="lg" py="xl">
      <Card withBorder padding="xl" w="100%" maw={600}>
        <Stack align="center" gap="md">
          <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'var(--mantine-color-red-1)' }}>
            <X size={48} color="var(--mantine-color-red-6)" />
          </div>
          <Title order={2} ta="center">Access Denied</Title>
          <Text size="sm" c="dimmed" ta="center">
            You don't have permission to access the payment verification page.
            Please contact your administrator if you believe you should have access.
          </Text>
          <Text size="xs" c="dimmed" ta="center">
            Required permission: PAYMENT_CONFIRM (payments.approve)
          </Text>
        </Stack>
      </Card>
    </Stack>
  );

  useEffect(() => {
    const loadTransfers = async () => {
      try {
        const transfersRes = await nigerianPaymentsApi.getBankTransfers({ status: 'PENDING', limit: 100 });
        setBankTransfers(transfersRes.data || []);
      } catch (error: any) {
        console.error('Error loading bank transfers:', error);
        notifications.show({ title: 'Error', message: 'Failed to load pending bank transfers', color: 'red' });
      }
    };
    loadTransfers();
  }, []);

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(num);
  };

  return (
    <Can permission={PERMISSIONS.PAYMENT_CONFIRM} fallback={accessDeniedFallback}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Payment Verification</Title>
            <Text size="sm" c="dimmed">
              Review and verify payment proofs and bank transfers
            </Text>
          </div>
          <HelpLink />
        </Group>

        {/* Stats */}
        <Group grow>
          <Card withBorder padding="lg">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Proofs waiting</Text>
              <FileText size={20} color="blue" />
            </Group>
            <Text size="xl" fw={700} mt="xs">
              {waitingProofs}
            </Text>
          </Card>
          <Card withBorder padding="lg">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Pending Transfers</Text>
              <Clock size={20} color="orange" />
            </Group>
            <Text size="xl" fw={700} mt="xs">
              {bankTransfers.length}
            </Text>
          </Card>
        </Group>

        <Tabs defaultValue="proofs">
          <Tabs.List>
            <Tabs.Tab value="proofs">Payment Proofs ({waitingProofs} waiting)</Tabs.Tab>
            <Tabs.Tab value="transfers">Bank Transfers ({bankTransfers.length})</Tabs.Tab>
          </Tabs.List>

          {/* Payment Proofs Tab */}
          <Tabs.Panel value="proofs" pt="md">
            <ProofQueuePanel onWaitingCount={setWaitingProofs} />
          </Tabs.Panel>

          {/* Bank Transfers Tab */}
          <Tabs.Panel value="transfers" pt="md">
            <Card withBorder padding="lg">
              {bankTransfers.length === 0 ? (
                <Stack align="center" py="xl">
                  <CheckCircle size={48} color="green" />
                  <Text size="sm" c="dimmed" ta="center">
                    No pending bank transfers
                  </Text>
                </Stack>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Reference</Table.Th>
                      <Table.Th>Sender</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Bank</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {bankTransfers.map((transfer) => (
                      <Table.Tr key={transfer.id}>
                        <Table.Td>
                          {new Date(transfer.transferDate).toLocaleDateString()}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {transfer.reference}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {transfer.senderAccountName || transfer.senderAccountNumber}
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500}>{formatCurrency(transfer.amount)}</Text>
                        </Table.Td>
                        <Table.Td>{transfer.senderBankName}</Table.Td>
                        <Table.Td>
                          <Badge color="yellow" size="sm">
                            PENDING
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Can>
  );
}
