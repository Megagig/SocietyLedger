'use client';

import { Badge, BadgeProps } from '@mantine/core';
import { IconClock, IconSend, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { SMSCampaignStatus } from '@/lib/api/sms';

interface CampaignStatusBadgeProps extends Omit<BadgeProps, 'color' | 'leftSection'> {
  status: SMSCampaignStatus;
}

export function CampaignStatusBadge({ status, ...props }: CampaignStatusBadgeProps) {
  const statusConfig: Record<SMSCampaignStatus, { color: BadgeProps['color']; label: string; icon: React.ReactNode }> = {
    DRAFT: {
      color: 'gray',
      label: 'Draft',
      icon: <IconClock size={12} />,
    },
    SCHEDULED: {
      color: 'blue',
      label: 'Scheduled',
      icon: <IconClock size={12} />,
    },
    IN_PROGRESS: {
      color: 'cyan',
      label: 'In Progress',
      icon: <IconSend size={12} />,
    },
    COMPLETED: {
      color: 'green',
      label: 'Completed',
      icon: <IconCheck size={12} />,
    },
    CANCELLED: {
      color: 'orange',
      label: 'Cancelled',
      icon: <IconX size={12} />,
    },
    FAILED: {
      color: 'red',
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
