'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Title,
  Text,
  Grid,
  Badge,
  Button,
  Group,
  Stack,
  Paper,
  ThemeIcon,
  SimpleGrid,
  Table,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconBuildingBank,
  IconArrowsExchange,
  IconFileImport,
  IconChecks,
  IconPhoto,
  IconAlertCircle,
  IconRefresh,
  IconArrowRight,
  IconCurrencyNaira,
} from '@tabler/icons-react';
import Link from 'next/link';
import { getUnmatchedDashboard, getBankAccounts, getBankTransfers, getPaymentProofs } from '@/lib/api/nigerian-payments';

export default function NigerianPaymentsPage() {
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['unmatched-dashboard'],
    queryFn: getUnmatchedDashboard,
  });

  const { data: bankAccountsData } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => getBankAccounts(true),
  });

  const { data: pendingTransfersData } = useQuery({
    queryKey: ['pending-transfers'],
    queryFn: () => getBankTransfers({ status: 'PENDING', limit: 5 }),
  });

  const { data: pendingProofsData } = useQuery({
    queryKey: ['pending-proofs'],
    queryFn: () => getPaymentProofs({ status: 'PENDING', limit: 5 }),
  });

  const dashboard = dashboardData?.data;
  const bankAccounts = bankAccountsData?.data?.accounts || [];
  const pendingTransfers = pendingTransfersData?.data?.transfers || [];
  const pendingProofs = pendingProofsData?.data?.proofs || [];

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  const quickLinks = [
    {
      title: 'Bank Accounts',
      description: 'Manage receiving bank accounts',
      icon: IconBuildingBank,
      href: '/dashboard/finance/payments/nigerian/bank-accounts',
      color: 'blue',
    },
    {
      title: 'Bank Transfers',
      description: 'Track and verify bank transfers',
      icon: IconArrowsExchange,
      href: '/dashboard/finance/payments/nigerian/bank-transfers',
      color: 'green',
    },
    {
      title: 'Statement Import',
      description: 'Import bank statements for reconciliation',
      icon: IconFileImport,
      href: '/dashboard/finance/payments/nigerian/statements',
      color: 'violet',
    },
    {
      title: 'Reconciliation',
      description: 'Match payments to transactions',
      icon: IconChecks,
      href: '/dashboard/finance/payments/nigerian/reconciliation',
      color: 'teal',
    },
    {
      title: 'Payment Proofs',
      description: 'Review uploaded payment proofs',
      icon: IconPhoto,
      href: '/dashboard/finance/payments/nigerian/proofs',
      color: 'orange',
    },
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <div>
          <Title order={2}>Nigerian Payment Features</Title>
          <Text c="dimmed">Bank transfer tracking, reconciliation, and payment verification</Text>
        </div>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={() => refetchDashboard()}
        >
          Refresh
        </Button>
      </Group>

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Unmatched Payments
              </Text>
              <Text size="xl" fw={700}>
                {dashboard?.totalUnmatched || 0}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="red">
              <IconAlertCircle size={20} />
            </ThemeIcon>
          </Group>
          <Text size="sm" c="dimmed" mt="sm">
            {formatCurrency(dashboard?.totalUnmatchedAmount || 0)} total
          </Text>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Pending Transfers
              </Text>
              <Text size="xl" fw={700}>
                {dashboard?.pendingBankTransfers || 0}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="blue">
              <IconArrowsExchange size={20} />
            </ThemeIcon>
          </Group>
          <Text size="sm" c="dimmed" mt="sm">
            Awaiting verification
          </Text>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Pending Proofs
              </Text>
              <Text size="xl" fw={700}>
                {dashboard?.pendingPaymentProofs || 0}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="orange">
              <IconPhoto size={20} />
            </ThemeIcon>
          </Group>
          <Text size="sm" c="dimmed" mt="sm">
            Awaiting review
          </Text>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Bank Accounts
              </Text>
              <Text size="xl" fw={700}>
                {bankAccounts.length}
              </Text>
            </div>
            <ThemeIcon size="lg" radius="md" variant="light" color="green">
              <IconBuildingBank size={20} />
            </ThemeIcon>
          </Group>
          <Text size="sm" c="dimmed" mt="sm">
            Active accounts
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Quick Links */}
      <Title order={4}>Quick Actions</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
        {quickLinks.map((link) => (
          <Card
            key={link.href}
            component={Link}
            href={link.href}
            padding="lg"
            radius="md"
            withBorder
            style={{ cursor: 'pointer' }}
          >
            <Group>
              <ThemeIcon size="xl" radius="md" variant="light" color={link.color}>
                <link.icon size={24} />
              </ThemeIcon>
              <div style={{ flex: 1 }}>
                <Text fw={500}>{link.title}</Text>
                <Text size="xs" c="dimmed">
                  {link.description}
                </Text>
              </div>
              <IconArrowRight size={16} color="gray" />
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Grid>
        {/* Recent Unmatched */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={5}>Recent Unmatched Payments</Title>
              <Button
                variant="subtle"
                size="xs"
                component={Link}
                href="/dashboard/finance/payments/nigerian/reconciliation"
              >
                View All
              </Button>
            </Group>
            {dashboard?.recentUnmatched && dashboard.recentUnmatched.length > 0 ? (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Reference</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Date</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {dashboard.recentUnmatched.slice(0, 5).map((item, index) => (
                    <Table.Tr key={`${item.type}-${item.id}-${index}`}>
                      <Table.Td>
                        <Badge
                          size="sm"
                          color={item.type === 'bank_transfer' ? 'blue' : 'violet'}
                        >
                          {item.type === 'bank_transfer' ? 'Transfer' : 'Statement'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" truncate style={{ maxWidth: 120 }}>
                          {item.reference || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {formatCurrency(item.amount)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {new Date(item.date).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No unmatched payments
              </Text>
            )}
          </Card>
        </Grid.Col>

        {/* Pending Payment Proofs */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={5}>Pending Payment Proofs</Title>
              <Button
                variant="subtle"
                size="xs"
                component={Link}
                href="/dashboard/finance/payments/nigerian/proofs"
              >
                View All
              </Button>
            </Group>
            {pendingProofs.length > 0 ? (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Member</Table.Th>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Uploaded</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pendingProofs.map((proof: any) => (
                    <Table.Tr key={proof.id}>
                      <Table.Td>
                        <Text size="sm">
                          {proof.member?.firstName} {proof.member?.lastName}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" truncate style={{ maxWidth: 100 }}>
                          {proof.filename}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {new Date(proof.uploadedAt).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" ta="center" py="xl">
                No pending proofs
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Bank Accounts Summary */}
      <Card padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={5}>Bank Accounts</Title>
          <Button
            variant="subtle"
            size="xs"
            component={Link}
            href="/dashboard/finance/payments/nigerian/bank-accounts"
          >
            Manage
          </Button>
        </Group>
        {bankAccounts.length > 0 ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {bankAccounts.map((account: any) => (
              <Paper key={account.id} p="md" radius="md" withBorder>
                <Group justify="space-between" mb="xs">
                  <Text fw={500}>{account.bankName}</Text>
                  {account.isDefault && (
                    <Badge size="xs" color="green">
                      Default
                    </Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed">
                  {account.accountName}
                </Text>
                <Text size="sm" fw={500} mt="xs">
                  {account.accountNumber}
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            No bank accounts configured.{' '}
            <Link href="/dashboard/finance/payments/nigerian/bank-accounts">
              Add one now
            </Link>
          </Text>
        )}
      </Card>
    </Stack>
  );
}
