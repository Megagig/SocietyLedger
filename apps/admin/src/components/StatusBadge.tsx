'use client';

import { Badge } from '@mantine/core';

type Status = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'PENDING' | 'TRIALING' | 'PAST_DUE' | string;

const STATUS_MAP: Record<string, { color: string; label?: string }> = {
  ACTIVE:    { color: 'green' },
  SUSPENDED: { color: 'orange' },
  CANCELLED: { color: 'red', label: 'Cancelled' },
  PENDING:   { color: 'orange' },
  TRIALING:  { color: 'blue', label: 'Trial' },
  PAST_DUE:  { color: 'red', label: 'Past Due' },
  approved:  { color: 'green', label: 'Approved' },
  rejected:  { color: 'red', label: 'Rejected' },
  pending:   { color: 'orange', label: 'Pending' },
};

interface StatusBadgeProps {
  status: Status;
  size?: 'xs' | 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_MAP[status] ?? { color: 'gray' };
  const label = config.label ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  return (
    <Badge color={config.color} size={size} radius="sm" variant="light">
      {label}
    </Badge>
  );
}
