'use client';

import { Card, Text, Title, Button, Badge, Stack, Group } from '@mantine/core';
import { IconCreditCard, IconTrendingUp, IconArrowUp } from '@tabler/icons-react';
import { SMSCreditBalance } from '@/lib/api/sms';

interface SMSBalanceCardProps {
  balance: SMSCreditBalance;
  onTopup?: () => void;
  loading?: boolean;
}

export function SMSBalanceCard({ balance, onTopup, loading }: SMSBalanceCardProps) {
  const usagePercentage = balance.totalPurchased > 0
    ? ((balance.totalUsed / balance.totalPurchased) * 100).toFixed(1)
    : '0';

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={3}>SMS Credits</Title>
          <Badge variant="light" color="blue" size="lg">
            {balance?.balance?.toLocaleString() || '0'} remaining
          </Badge>
        </Group>

        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Total Purchased</Text>
            <Text fw={500}>{balance?.totalPurchased?.toLocaleString() || '0'}</Text>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">Total Used</Text>
            <Text fw={500} c="orange">
              {balance?.totalUsed?.toLocaleString() || '0'}
            </Text>
          </Group>

          <Group justify="space-between">
            <Text size="sm" c="dimmed">Usage Rate</Text>
            <Group gap="xs">
              <Text fw={500}>{usagePercentage}%</Text>
              <IconTrendingUp size={16} color={parseFloat(usagePercentage) > 80 ? 'red' : 'green'} />
            </Group>
          </Group>

          {balance.lastTopUpAt && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Last Top-up</Text>
              <Text size="sm">
                {new Date(balance.lastTopUpAt).toLocaleDateString()}
              </Text>
            </Group>
          )}
        </Stack>

        <Button
          leftSection={<IconCreditCard size={18} />}
          rightSection={<IconArrowUp size={18} />}
          onClick={onTopup}
          loading={loading}
          fullWidth
        >
          Top Up Credits
        </Button>
      </Stack>
    </Card>
  );
}
