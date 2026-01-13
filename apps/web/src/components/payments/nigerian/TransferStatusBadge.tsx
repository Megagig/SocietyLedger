'use client';

import { Badge } from '@mantine/core';

interface TransferStatusBadgeProps {
  status: 'PENDING' | 'VERIFIED' | 'MATCHED' | 'REJECTED';
}

export function TransferStatusBadge({ status }: TransferStatusBadgeProps) {
  const config = {
    PENDING: { color: 'yellow', label: 'Pending' },
    VERIFIED: { color: 'blue', label: 'Verified' },
    MATCHED: { color: 'green', label: 'Matched' },
    REJECTED: { color: 'red', label: 'Rejected' },
  };

  const { color, label } = config[status];

  return <Badge color={color} variant="light">{label}</Badge>;
}
