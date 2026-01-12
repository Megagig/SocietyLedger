'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Stack,
  Group,
  Card,
  SimpleGrid,
  Text,
  NumberInput,
  Button,
  Select,
  Badge,
  Alert,
} from '@mantine/core';
import { IconChartBar, IconCreditCard, IconRefresh, IconArrowUp } from '@tabler/icons-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { smsApi, SMSCreditBalance, SMSCreditTransaction, TopupCreditsRequest } from '@/lib/api/sms';
import { SMSBalanceCard } from '@/components/communications/SMSBalanceCard';

export default function SMSReportsPage() {
  const [topupAmount, setTopupAmount] = useState<number | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'bank_transfer'>('paystack');

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery<SMSCreditBalance>({
    queryKey: ['sms-credits-balance'],
    queryFn: () => smsApi.getBalance(),
  });

  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['sms-credits-history'],
    queryFn: () => smsApi.getCreditHistory({ page: 1, limit: 20 }),
  });

  const transactions = historyData?.transactions || [];

  const topupMutation = useMutation({
    mutationFn: (data: TopupCreditsRequest) => smsApi.topupCredits(data),
    onSuccess: () => {
      notifications.show({
        title: 'Credits Added',
        message: `Successfully added ${topupAmount} SMS credits`,
        color: 'green',
      });
      refetchBalance();
      refetchHistory();
      setTopupAmount(undefined);
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Failed to Add Credits',
        message: error.response?.data?.message || 'An error occurred',
        color: 'red',
      });
    },
  });

  const handleTopup = () => {
    if (!topupAmount || topupAmount <= 0) {
      notifications.show({
        title: 'Invalid Amount',
        message: 'Please enter a valid amount',
        color: 'yellow',
      });
      return;
    }

    topupMutation.mutate({
      amount: topupAmount,
      paymentMethod,
    });
  };

  const usagePercentage = balance
    ? ((balance.creditsUsed / balance.totalCredits) * 100).toFixed(1)
    : '0';

  const thisMonthTransactions = transactions.filter((t: SMSCreditTransaction) => {
    const transactionDate = new Date(t.createdAt);
    const now = new Date();
    return (
      transactionDate.getMonth() === now.getMonth() &&
      transactionDate.getFullYear() === now.getFullYear()
    );
  });

  const thisMonthUsage = thisMonthTransactions
    .filter((t: SMSCreditTransaction) => t.type === 'usage')
    .reduce((sum: number, t: SMSCreditTransaction) => sum + t.amount, 0);

  const thisMonthPurchased = thisMonthTransactions
    .filter((t: SMSCreditTransaction) => t.type === 'purchase')
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
            onTopup={() => setTopupAmount(1000)}
          />
        )}

        {/* Quick Stats */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <StatCard
            label="Total Credits"
            value={balance?.totalCredits || 0}
            icon={<IconCreditCard size={24} color="blue" />}
            color="blue"
          />
          <StatCard
            label="Credits Used"
            value={balance?.creditsUsed || 0}
            icon={<IconChartBar size={24} color="orange" />}
            color="orange"
          />
          <StatCard
            label="Credits Remaining"
            value={balance?.creditsRemaining || 0}
            icon={<IconCreditCard size={24} color="green" />}
            color="green"
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
            icon={<IconArrowUp size={24} color="cyan" />}
            color="cyan"
          />
        </SimpleGrid>

        {/* Top Up */}
        <Card padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">Top Up SMS Credits</Title>
          <Stack gap="md">
            <Group>
              <NumberInput
                label="Amount"
                placeholder="Enter amount"
                value={topupAmount}
                onChange={(value) => setTopupAmount(value as number)}
                min={100}
                step={100}
                required
                style={{ flex: 1 }}
              />
              <Select
                label="Payment Method"
                placeholder="Select payment method"
                data={[
                  { value: 'paystack', label: 'Paystack (Card)' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                ]}
                value={paymentMethod}
                onChange={(value) => setPaymentMethod(value as any)}
                style={{ width: 200 }}
              />
            </Group>

            <Alert color="blue" variant="light">
              <Text size="sm">
                Minimum top-up amount: 100 credits. Each SMS segment costs 1 credit.
              </Text>
            </Alert>

            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={() => setTopupAmount(undefined)}
              >
                Cancel
              </Button>
              <Button
                leftSection={<IconArrowUp size={18} />}
                onClick={handleTopup}
                loading={topupMutation.isPending}
                disabled={!topupAmount || topupAmount <= 0}
              >
                Top Up
              </Button>
            </Group>
          </Stack>
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
                  bg={transaction.type === 'purchase' ? 'green.0' : 'red.0'}
                  style={{ borderRadius: 8 }}
                >
                  <Stack gap="xs">
                    <Group>
                      <Text fw={500}>{transaction.type.toUpperCase()}</Text>
                      <Text size="sm" c="dimmed">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </Text>
                    </Group>
                    <Text size="lg" fw={600}>
                      {transaction.type === 'purchase' ? '+' : '-'}
                      {transaction.amount.toLocaleString()} credits
                    </Text>
                  </Stack>
                  <Badge
                    variant={transaction.type === 'purchase' ? 'filled' : 'light'}
                    color={transaction.type === 'purchase' ? 'green' : 'red'}
                  >
                    {transaction.description}
                  </Badge>
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
              • Purchase credits in bulk for better rates (contact support for volume discounts)
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
