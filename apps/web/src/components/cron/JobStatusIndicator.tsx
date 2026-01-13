import { Badge } from '@mantine/core';
import { 
  IconCheck, 
  IconX, 
  IconClock, 
  IconLoader,
  IconAlertTriangle
} from '@tabler/icons-react';

interface JobStatusIndicatorProps {
  status: 'active' | 'disabled' | 'running' | 'failed';
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function JobStatusIndicator({ status, size = 'md' }: JobStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          color: 'green',
          icon: <IconCheck size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />,
          label: 'Active',
        };
      case 'disabled':
        return {
          color: 'gray',
          icon: <IconX size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />,
          label: 'Disabled',
        };
      case 'running':
        return {
          color: 'blue',
          icon: <IconLoader size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} className="animate-spin" />,
          label: 'Running',
        };
      case 'failed':
        return {
          color: 'red',
          icon: <IconAlertTriangle size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />,
          label: 'Failed',
        };
      default:
        return {
          color: 'gray',
          icon: <IconClock size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} />,
          label: 'Unknown',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge
      color={config.color}
      variant="light"
      size={size}
      leftSection={config.icon}
    >
      {config.label}
    </Badge>
  );
}
