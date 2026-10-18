'use client';

import { Card, Text, Group, ThemeIcon } from '@mantine/core';
import type { FC, ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  /** e.g. "+12 this week" */
  trend?: string;
  trendPositive?: boolean;
}

export const StatCard: FC<StatCardProps> = ({ label, value, icon, trend, trendPositive }) => (
  <Card
    style={{
      backgroundColor: 'var(--admin-surface)',
      border: '1px solid var(--admin-border)',
    }}
    p="lg"
    radius="lg"
  >
    <Group justify="space-between" mb="xs" align="flex-start">
      <Text size="sm" c="dimmed" fw={500}>{label}</Text>
      {icon && (
        <ThemeIcon size="md" variant="light" color="ledger" radius="md">
          {icon}
        </ThemeIcon>
      )}
    </Group>

    <Text fz={28} fw={700} lh={1.2}>{value}</Text>

    {trend && (
      <Text
        size="xs"
        mt={4}
        c={trendPositive === false ? 'red' : trendPositive ? 'green' : 'dimmed'}
      >
        {trend}
      </Text>
    )}
  </Card>
);
