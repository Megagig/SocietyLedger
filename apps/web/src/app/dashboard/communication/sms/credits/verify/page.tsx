'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  Title,
  Text,
  Stack,
  LoadingOverlay,
  Alert,
  Button,
  Group,
} from '@mantine/core';
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';

export default function VerifyCreditsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference');
  
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'failed' | 'pending'>('pending');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setError('Payment reference is missing');
      setLoading(false);
      return;
    }

    verifyPayment();
  }, [reference]);

  const verifyPayment = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sms/credits/verify/${reference}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to verify payment');
      }

      setStatus(result.data.status === 'success' ? 'success' : 'failed');
      setData(result.data);
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Failed to verify payment');
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Stack gap="lg" align="center" justify="center" style={{ minHeight: '60vh' }}>
        <LoadingOverlay visible={true} />
        <Title order={3}>Verifying Payment...</Title>
        <Text size="sm" c="dimmed">
          Please wait while we confirm your payment
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" align="center" justify="center" style={{ minHeight: '60vh' }}>
      <Card withBorder padding="xl" style={{ maxWidth: 600, width: '100%' }}>
        {status === 'success' && data && (
          <Stack gap="lg" align="center">
            <CheckCircle size={64} color="green" />
            <Title order={2} ta="center">Payment Successful!</Title>
            <Text size="lg" ta="center" c="dimmed">
              Your SMS credits have been added to your account
            </Text>
            
            <Stack gap="xs" style={{ width: '100%' }}>
              <Group justify="space-between">
                <Text fw={500}>Credits Added:</Text>
                <Text fw={700} size="lg" c="green">
                  {data.credits.toLocaleString()}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text fw={500}>Amount Paid:</Text>
                <Text fw={700}>
                  {formatCurrency(data.amount)}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text fw={500}>Reference:</Text>
                <Text size="sm" c="dimmed">
                  {data.reference}
                </Text>
              </Group>
            </Stack>

            <Group mt="md">
              <Button
                leftSection={<ArrowLeft size={16} />}
                onClick={() => router.push('/dashboard/communications')}
              >
                Go to SMS Dashboard
              </Button>
            </Group>
          </Stack>
        )}

        {status === 'failed' && (
          <Stack gap="lg" align="center">
            <XCircle size={64} color="red" />
            <Title order={2} ta="center">Payment Failed</Title>
            <Text size="lg" ta="center" c="dimmed">
              {error || 'We could not verify your payment. Please contact support if you were charged.'}
            </Text>
            
            {reference && (
              <Text size="sm" c="dimmed" ta="center">
                Reference: {reference}
              </Text>
            )}

            <Group mt="md">
              <Button
                variant="light"
                leftSection={<RefreshCw size={16} />}
                onClick={verifyPayment}
              >
                Retry Verification
              </Button>
              <Button
                leftSection={<ArrowLeft size={16} />}
                onClick={() => router.push('/dashboard/communication/sms/credits')}
              >
                Try Again
              </Button>
            </Group>
          </Stack>
        )}
      </Card>

      {status !== 'success' && (
        <Alert color="blue" variant="light" style={{ maxWidth: 600, width: '100%' }}>
          <Text size="sm">
            <strong>Need Help?</strong><br />
            If you encounter any issues, please contact our support team with your payment reference.
          </Text>
        </Alert>
      )}
    </Stack>
  );
}
