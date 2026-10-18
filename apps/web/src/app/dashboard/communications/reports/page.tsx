'use client';

import {
  Container,
  Title,
  Stack,
  Group,
  Card,
  SimpleGrid,
  Text,
  Button,
  Badge,
} from '@mantine/core';
import { IconChartBar, IconCreditCard, IconRefresh, IconArrowUp } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { smsApi, SMSCreditBalance, SMSCreditTransaction } from '@/lib/api/sms';
import { SMSBalanceCard } from '@/components/communications/SMSBalanceCard';

// G39/G76: the previous version of this page used fields that never
// existed on SMSCreditBalance/SMSCreditTransaction (totalCredits,
// creditsUsed, creditsRemaining, balanceAfter, lowercase transaction
// types) and had its own fake "Top Up" form posting to the endpoint
// removed in R1.4 (G41). Real purchases now go through /credits
// (ported from the orphaned set at R3.1) — this page is balance + history.
export default function SMSReportsPage() {
  const router = useRouter();

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery<SMSCreditBalance>({
    queryKey: ['sms-credits-balance'],
    queryFn: () => smsApi.getBalance(),
  });

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['sms-credits-history'],
    queryFn: () => smsApi.getCreditHistory({ page: 1, limit: 20 }),
  });

  const transactions = historyData?.transactions || [];

  const thisMonthTransactions = transactions.filter((t: SMSCreditTransaction) => {
    const transactionDate = new Date(t.createdAt);
    const now = new Date();
    return (
      transactionDate.getMonth() === now.getMonth() &&
      transactionDate.getFullYear() === now.getFullYear()
    );
  });

  const thisMonthUsage = thisMonthTransactions
    .filter((t: SMSCreditTransaction) => t.type === 'USAGE')
    .reduce((sum: number, t: SMSCreditTransaction) => sum + t.amount, 0);

  const thisMonthPurchased = thisMonthTransactions
    .filter((t: SMSCreditTransaction) => t.type === 'PURCHASE')
    .reduce((sum: number, t: SMSCreditTransaction) => sum + t.amount, 0);

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>SMS Usage Reports</Title>
            <Text c="dimmed">Track your SMS credit usage and transactions</Text>
          </div>
          <Button
            leftSection={<IconRefresh size={18} />}
            onClick={() => {
              refetchBalance();
              refetchHistory();
            }}
            variant="light"
          >
            Refresh
          </Button>
        </Group>

        {/* Balance Card */}
        {balance && (
          <SMSBalanceCard
            balance={balance}
            onTopup={() => router.push('/dashboard/communications/credits')}
          />
        )}

        {/* Quick Stats */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <StatCard
            label="Current Balance"
            value={balance?.balance || 0}
            icon={<IconCreditCard size={24} color="green" />}
            color="green"
          />
          <StatCard
            label="Total Purchased"
            value={balance?.totalPurchased || 0}
            icon={<IconArrowUp size={24} color="cyan" />}
            color="cyan"
          />
          <StatCard
            label="This Month Usage"
            value={thisMonthUsage}
            icon={<IconChartBar size={24} color="purple" />}
            color="purple"
          />
          <StatCard
            label="This Month Purchased"
            value={thisMonthPurchased}
            icon={<IconArrowUp size={24} color="orange" />}
            color="orange"
          />
        </SimpleGrid>

        {/* Buy More Credits */}
        <Card padding="lg" radius="md" withBorder>
          <Group justify="space-between" align="center">
            <div>
              <Title order={4} mb={4}>Need More Credits?</Title>
              <Text size="sm" c="dimmed">Purchase SMS credits securely via Paystack.</Text>
            </div>
            <Button
              leftSection={<IconCreditCard size={18} />}
              onClick={() => router.push('/dashboard/communications/credits')}
            >
              Buy Credits
            </Button>
          </Group>
        </Card>

        {/* Transaction History */}
        <Card padding="lg" radius="md" withBorder>
          <Group justify="space-between" align="center" mb="md">
            <Title order={3}>Credit Transactions</Title>
            <Badge variant="light" color="blue">
              {transactions.length} transactions
            </Badge>
          </Group>

          {transactions.length === 0 ? (
            <Stack align="center" py="xl">
              <Text size="lg" c="dimmed">
                No credit transactions found
              </Text>
            </Stack>
          ) : (
            <Stack gap="sm">
              {transactions.map((transaction: SMSCreditTransaction) => (
                <Group
                  key={transaction.id}
                  justify="space-between"
                  p="md"
                  bg={transaction.type === 'PURCHASE' || transaction.type === 'BONUS' ? 'green.0' : 'red.0'}
                  style={{ borderRadius: 8 }}
                >
                  <Stack gap="xs">
                    <Group>
                      <Text fw={500}>{transaction.type}</Text>
                      <Text size="sm" c="dimmed">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </Text>
                    </Group>
                    <Text size="lg" fw={600}>
                      {transaction.type === 'PURCHASE' || transaction.type === 'BONUS' ? '+' : '-'}
                      {transaction.amount.toLocaleString()} credits
                    </Text>
                  </Stack>
                  {transaction.description && (
                    <Badge
                      variant={transaction.type === 'PURCHASE' ? 'filled' : 'light'}
                      color={transaction.type === 'PURCHASE' || transaction.type === 'BONUS' ? 'green' : 'red'}
                    >
                      {transaction.description}
                    </Badge>
                  )}
                </Group>
              ))}
            </Stack>
          )}
        </Card>

        {/* Info */}
        <Card padding="md" radius="md" withBorder>
          <Title order={4} mb="md">Usage Tips</Title>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              • Monitor your credit usage regularly to avoid running out
            </Text>
            <Text size="sm" c="dimmed">
              • Use templates to reduce message composition time
            </Text>
            <Text size="sm" c="dimmed">
              • Track delivery rates to optimize recipient lists
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'cyan';
}) {
  return (
    <Card padding="lg" radius="md" withBorder>
      <Stack gap="xs">
        <Group gap="md">
          {icon}
          <Text size="sm" c="dimmed">{label}</Text>
        </Group>
        <Text size="xl" fw={700} c={color}>
          {value.toLocaleString()}
        </Text>
      </Stack>
    </Card>
  );
}
