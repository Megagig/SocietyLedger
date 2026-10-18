'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Text, Badge, Loader, Alert, Button, Table, Group, Stack } from '@mantine/core';
import { IconArrowLeft, IconArrowUpRight, IconArrowDownRight, IconWallet } from '@tabler/icons-react';
import { getSavingsAccount, getSavingsTransactions } from '@/lib/api/cooperatives';
import { toast } from '@/lib/toast';

interface SavingsAccountDetail {
  id: number;
  accountNumber: string;
  accountType: string;
  balance: string;
  targetAmount: string | null;
  monthlyContribution: string | null;
  interestRate: string;
  accruedInterest: string;
  totalDeposits: string;
  totalWithdrawals: string;
  status: string;
  maturityDate: string | null;
  openedAt: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string };
}

interface SavingsTransaction {
  id: number;
  type: string;
  amount: string;
  balanceAfter: string;
  paymentMethod: string | null;
  reference: string | null;
  processedByName: string;
  createdAt: string;
}

export default function SavingsAccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = Number(params.id);

  const [account, setAccount] = useState<SavingsAccountDetail | null>(null);
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountRes, txnRes] = await Promise.all([
          getSavingsAccount(accountId),
          getSavingsTransactions({ savingsAccountId: accountId, limit: 50 }),
        ]);
        setAccount(accountRes.data);
        setTransactions(txnRes.data.transactions || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load savings account');
        toast.error(err.message || 'Failed to load savings account');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [accountId]);

  const formatCurrency = (amount: string | number) => `₦${Number(amount).toLocaleString()}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !account) {
    return (
      <Alert color="red" title="Unable to load savings account">
        {error || 'Savings account not found'}
      </Alert>
    );
  }

  return (
    <div>
      <Button
        variant="subtle"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => router.push('/dashboard/cooperatives/savings')}
        mb="md"
      >
        Back to Savings Accounts
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          {account.accountNumber}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {account.member.firstName} {account.member.lastName} ({account.member.membershipId})
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card withBorder padding="md">
          <Group justify="space-between" mb="xs">
            <Text size="sm" c="dimmed">Current Balance</Text>
            <IconWallet size={18} className="text-teal-600" />
          </Group>
          <Text size="xl" fw={700}>{formatCurrency(account.balance)}</Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed" mb="xs">Total Deposits</Text>
          <Text size="xl" fw={700} c="green">{formatCurrency(account.totalDeposits)}</Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed" mb="xs">Total Withdrawals</Text>
          <Text size="xl" fw={700} c="orange">{formatCurrency(account.totalWithdrawals)}</Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed" mb="xs">Status</Text>
          <Badge color={account.status === 'ACTIVE' ? 'green' : 'gray'} size="lg">{account.status}</Badge>
        </Card>
      </div>

      <Card withBorder padding="md" mb="xl">
        <Text fw={600} mb="sm">Account Details</Text>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Account Type</Text>
            <Text size="sm">{account.accountType}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Interest Rate</Text>
            <Text size="sm">{account.interestRate}%</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Accrued Interest</Text>
            <Text size="sm">{formatCurrency(account.accruedInterest)}</Text>
          </Group>
          {account.targetAmount && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Target Amount</Text>
              <Text size="sm">{formatCurrency(account.targetAmount)}</Text>
            </Group>
          )}
          {account.monthlyContribution && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Monthly Contribution</Text>
              <Text size="sm">{formatCurrency(account.monthlyContribution)}</Text>
            </Group>
          )}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Opened</Text>
            <Text size="sm">{formatDate(account.openedAt)}</Text>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding={0}>
        <div className="p-4">
          <Text fw={600}>Transaction History</Text>
        </div>
        {transactions.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">No transactions yet</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Balance After</Table.Th>
                <Table.Th>Method</Table.Th>
                <Table.Th>Processed By</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {transactions.map((txn) => (
                <Table.Tr key={txn.id}>
                  <Table.Td>{formatDate(txn.createdAt)}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {txn.type === 'DEPOSIT' ? (
                        <IconArrowDownRight size={14} className="text-green-600" />
                      ) : (
                        <IconArrowUpRight size={14} className="text-orange-600" />
                      )}
                      {txn.type}
                    </Group>
                  </Table.Td>
                  <Table.Td className={txn.type === 'DEPOSIT' ? 'text-green-600' : 'text-orange-600'}>
                    {formatCurrency(txn.amount)}
                  </Table.Td>
                  <Table.Td>{formatCurrency(txn.balanceAfter)}</Table.Td>
                  <Table.Td>{txn.paymentMethod || '—'}</Table.Td>
                  <Table.Td>{txn.processedByName}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
