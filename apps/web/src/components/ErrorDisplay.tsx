import { Alert, Text, Button, Stack } from '@mantine/core';
import { IconAlertCircle, IconLock, IconRefresh } from '@tabler/icons-react';

interface ErrorDisplayProps {
  error: any;
  title?: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, title, onRetry }: ErrorDisplayProps) {
  // Handle 403 Permission Denied
  if (error?.response?.status === 403) {
    const data = error.response.data;
    return (
      <Alert
        icon={<IconLock size={20} />}
        title={title || 'Access Denied'}
        color="orange"
      >
        <Stack gap="sm">
          <Text size="sm">
            {data?.message || 'You do not have permission to access this resource.'}
          </Text>
          
          {data?.requiredPermission && (
            <Text size="sm" c="dimmed">
              Required permission: <strong>{data.requiredPermission}</strong>
            </Text>
          )}
          
          {data?.userRole && (
            <Text size="sm" c="dimmed">
              Your current role: <strong>{data.userRole}</strong>
            </Text>
          )}
          
          <Text size="sm" mt="xs">
            This feature is typically available to:
          </Text>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>Administrators</li>
            <li>Treasurers</li>
            <li>Financial Secretaries</li>
          </ul>
          
          <Text size="sm" mt="xs" c="dimmed">
            Contact your association administrator to request access.
          </Text>
        </Stack>
      </Alert>
    );
  }

  // Handle 401 Authentication Required
  if (error?.response?.status === 401) {
    return (
      <Alert
        icon={<IconAlertCircle size={20} />}
        title={title || 'Authentication Required'}
        color="red"
      >
        <Stack gap="sm">
          <Text size="sm">
            Your session has expired. Please log in again to continue.
          </Text>
          <Button
            component="a"
            href="/auth/login"
            size="sm"
            variant="light"
          >
            Go to Login
          </Button>
        </Stack>
      </Alert>
    );
  }

  // Handle 404 Not Found
  if (error?.response?.status === 404) {
    return (
      <Alert
        icon={<IconAlertCircle size={20} />}
        title={title || 'Not Found'}
        color="yellow"
      >
        <Stack gap="sm">
          <Text size="sm">
            {error.response.data?.message || 'The requested resource was not found.'}
          </Text>
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="light"
              leftSection={<IconRefresh size={16} />}
            >
              Try Again
            </Button>
          )}
        </Stack>
      </Alert>
    );
  }

  // Handle Network Errors
  if (error?.message === 'Network Error') {
    return (
      <Alert
        icon={<IconAlertCircle size={20} />}
        title={title || 'Connection Error'}
        color="red"
      >
        <Stack gap="sm">
          <Text size="sm">
            Unable to connect to the server. Please check your internet connection and try again.
          </Text>
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="light"
              leftSection={<IconRefresh size={16} />}
            >
              Retry
            </Button>
          )}
        </Stack>
      </Alert>
    );
  }

  // Handle Server Errors (500+)
  if (error?.response?.status >= 500) {
    return (
      <Alert
        icon={<IconAlertCircle size={20} />}
        title={title || 'Server Error'}
        color="red"
      >
        <Stack gap="sm">
          <Text size="sm">
            Something went wrong on our end. Our team has been notified and is working on a fix.
          </Text>
          <Text size="sm" c="dimmed">
            Please try again in a few moments.
          </Text>
          {onRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="light"
              leftSection={<IconRefresh size={16} />}
            >
              Try Again
            </Button>
          )}
        </Stack>
      </Alert>
    );
  }

  // Generic Error
  const errorMessage = error?.response?.data?.message || error?.message || 'An unexpected error occurred';
  
  return (
    <Alert
      icon={<IconAlertCircle size={20} />}
      title={title || 'Error'}
      color="red"
    >
      <Stack gap="sm">
        <Text size="sm">{errorMessage}</Text>
        {onRetry && (
          <Button
            onClick={onRetry}
            size="sm"
            variant="light"
            leftSection={<IconRefresh size={16} />}
          >
            Try Again
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
