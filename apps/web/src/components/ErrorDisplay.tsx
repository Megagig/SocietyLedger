import { Alert, Text, Button, Stack } from '@mantine/core';
import { IconAlertCircle, IconLock, IconRefresh } from '@tabler/icons-react';
import { accessCopy, classifyAccessError, moduleDisplayName } from '@societyledger/shared';

interface ErrorDisplayProps {
  error: any;
  title?: string;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, title, onRetry }: ErrorDisplayProps) {
  // Handle 403: a refusal because of the person's role or their association's plan reads the same here as everywhere else,
  // names who can fix it, and shows no internal detail (permission names, roles). Any other 403 is a rule with its own message.
  if (error?.response?.status === 403) {
    const data = error.response.data;
    const kind = classifyAccessError({ status: 403, code: data?.code, error: data?.error, message: data?.message });
    const copy = kind ? accessCopy(kind, { moduleName: moduleDisplayName(data?.module), surface: 'web' }) : null;
    return (
      <Alert
        icon={<IconLock size={20} />}
        title={title || copy?.title || 'Not allowed'}
        color="orange"
      >
        <Stack gap="sm">
          <Text size="sm">
            {copy?.description || data?.message || "You don't have permission to do this. Ask your association administrator if you need access."}
          </Text>
          {onRetry && (kind === 'plan' || kind === 'subscription' || kind === 'limit') && (
            <Button onClick={onRetry} size="sm" variant="light" leftSection={<IconRefresh size={16} />}>
              Check again
            </Button>
          )}
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
