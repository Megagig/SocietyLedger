'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Stack,
  Group,
  Badge,
  Button,
  Skeleton,
  Alert,
} from '@mantine/core';
import { IconMessage, IconSend, IconClock, IconAlertCircle, IconArrowRight } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { smsApi, SMSDashboardStats } from '@/lib/api/sms';
import { SMSBalanceCard } from '@/components/communications/SMSBalanceCard';
import { HelpLink } from '@/components/docs/HelpLink';

export default function CommunicationsDashboard() {
  const router = useRouter();

  const { data: dashboard, isLoading, error } = useQuery<SMSDashboardStats>({
    queryKey: ['sms-dashboard'],
    queryFn: () => smsApi.getDashboard(),
  });

  const { data: balance } = useQuery({
    queryKey: ['sms-credit-balance'],
    queryFn: () => smsApi.getBalance(),
  });

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="md">
          <Skeleton height={40} width={200} />
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {[...Array(4)].map((_, i) => (
              <Card key={i} padding="lg" radius="md" withBorder>
                <Skeleton height={100} />
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error loading dashboard">
          Failed to load SMS dashboard. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <div>
              <Title order={2}>Communications</Title>
              <Text c="dimmed">Send SMS messages and manage campaigns</Text>
            </div>
            <HelpLink />
          </Group>
          <Button
            leftSection={<IconSend size={18} />}
            rightSection={<IconArrowRight size={18} />}
            onClick={() => router.push('/dashboard/communications/quick-send')}
            size="lg"
          >
            Send Quick SMS
          </Button>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }}>
          {/* SMS Balance Card */}
          {balance && (
            <SMSBalanceCard
              balance={balance}
              onTopup={() => router.push('/dashboard/communications/credits')}
            />
          )}

          {/* Messages Sent */}
          <StatCard
            label="Messages Sent"
            value={dashboard?.totalMessagesSent || 0}
            icon={<IconMessage size={24} color="blue" />}
            color="blue"
          />

          {/* Delivered */}
          <StatCard
            label="Delivered"
            value={dashboard?.totalMessagesDelivered || 0}
            icon={<IconSend size={24} color="green" />}
            color="green"
          />

          {/* Failed */}
          <StatCard
            label="Failed"
            value={dashboard?.totalMessagesFailed || 0}
            icon={<IconAlertCircle size={24} color="red" />}
            color="red"
          />
        </SimpleGrid>

        {/* Delivery Rate */}
        {dashboard && dashboard.deliveryRate !== undefined && (
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" align="center">
              <Stack gap={0}>
                <Text size="sm" c="dimmed">Delivery Rate</Text>
                <Text size="xl" fw={700}>
                  {typeof dashboard?.deliveryRate === 'number' ? dashboard.deliveryRate.toFixed(1) : '0'}%
                </Text>
              </Stack>
              <Badge
                size="xl"
                variant="filled"
                color={dashboard?.deliveryRate >= 90 ? 'green' : dashboard?.deliveryRate >= 70 ? 'yellow' : 'red'}
              >
                {dashboard?.deliveryRate >= 90 ? 'Excellent' : dashboard?.deliveryRate >= 70 ? 'Good' : 'Needs Improvement'}
              </Badge>
            </Group>
          </Card>
        )}

        {/* Quick Actions */}
        <div>
          <Title order={3} mb="md">Quick Actions</Title>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            <ActionCard
              title="Send Quick SMS"
              description="Send a single or bulk SMS message"
              icon={<IconSend size={32} />}
              onClick={() => router.push('/dashboard/communications/quick-send')}
            />
            <ActionCard
              title="Create Campaign"
              description="Schedule and manage SMS campaigns"
              icon={<IconClock size={32} />}
              onClick={() => router.push('/dashboard/communications/campaigns/new')}
            />
            <ActionCard
              title="View History"
              description="See all sent messages and delivery status"
              icon={<IconMessage size={32} />}
              onClick={() => router.push('/dashboard/communications/history')}
            />
          </SimpleGrid>
        </div>

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
  color: 'blue' | 'green' | 'red' | 'orange';
}) {
  return (
    <Card padding="lg" radius="md" withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">{label}</Text>
          {icon}
        </Group>
        <Text size="xl" fw={700} c={color}>
          {value.toLocaleString()}
        </Text>
      </Stack>
    </Card>
  );
}

function ActionCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card
      padding="lg"
      radius="md"
      withBorder
      style={{ cursor: 'pointer', transition: 'all 0.2s' }}
      onClick={onClick}
      className="hover:bg-gray-0"
    >
      <Stack gap="sm">
        <Group gap="md">
          <div style={{ color: 'var(--mantine-color-blue-6)' }}>{icon}</div>
          <Stack gap={0}>
            <Text fw={600} size="lg">
              {title}
            </Text>
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          </Stack>
        </Group>
      </Stack>
    </Card>
  );
}
