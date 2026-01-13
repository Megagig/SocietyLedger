'use client';

import { Badge } from '@mantine/core';

interface EventStatusBadgeProps {
  status: 'success' | 'failed' | 'pending' | 'retrying';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function EventStatusBadge({ status, size = 'sm' }: EventStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          color: 'green',
          label: 'Success',
        };
      case 'failed':
        return {
          color: 'red',
          label: 'Failed',
        };
      case 'pending':
        return {
          color: 'yellow',
          label: 'Pending',
        };
      case 'retrying':
        return {
          color: 'blue',
          label: 'Retrying',
        };
      default:
        return {
          color: 'gray',
          label: status,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge
      size={size}
      color={config.color}
      variant="light"
    >
      {config.label}
    </Badge>
  );
}
