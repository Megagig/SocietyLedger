import { Badge } from '@mantine/core';

interface ExportStatusBadgeProps {
  status: 'processing' | 'completed' | 'expired' | 'failed';
}

export function ExportStatusBadge({ status }: ExportStatusBadgeProps) {
  const statusConfig = {
    processing: {
      color: 'blue',
      label: 'Processing',
    },
    completed: {
      color: 'green',
      label: 'Completed',
    },
    expired: {
      color: 'gray',
      label: 'Expired',
    },
    failed: {
      color: 'red',
      label: 'Failed',
    },
  };

  const config = statusConfig[status];

  return (
    <Badge color={config.color} variant="filled">
      {config.label}
    </Badge>
  );
}
