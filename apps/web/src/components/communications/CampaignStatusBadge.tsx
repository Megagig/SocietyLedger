'use client';

import { Badge, BadgeProps } from '@mantine/core';
import { IconClock, IconSend, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

interface CampaignStatusBadgeProps extends Omit<BadgeProps, 'color' | 'leftSection'> {
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
}

export function CampaignStatusBadge({ status, ...props }: CampaignStatusBadgeProps) {
  const statusConfig = {
    draft: {
      color: 'gray' as const,
      label: 'Draft',
      icon: <IconClock size={12} />,
    },
    scheduled: {
      color: 'blue' as const,
      label: 'Scheduled',
      icon: <IconClock size={12} />,
    },
    in_progress: {
      color: 'cyan' as const,
      label: 'In Progress',
      icon: <IconSend size={12} />,
    },
    completed: {
      color: 'green' as const,
      label: 'Completed',
      icon: <IconCheck size={12} />,
    },
    cancelled: {
      color: 'orange' as const,
      label: 'Cancelled',
      icon: <IconX size={12} />,
    },
    failed: {
      color: 'red' as const,
      label: 'Failed',
      icon: <IconAlertCircle size={12} />,
    },
  };

  const config = statusConfig[status];

  return (
    <Badge
      color={config.color}
      variant="filled"
      leftSection={config.icon}
      {...props}
    >
      {config.label}
    </Badge>
  );
}
