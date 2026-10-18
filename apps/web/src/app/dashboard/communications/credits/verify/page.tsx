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
import { IconCheck, IconX, IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { smsApi } from '@/lib/api/sms';

// R3.1/G38: ported from the orphaned /dashboard/communication/sms/credits/verify
// (deleted at R3.1) — the Paystack callback_url (sms.controller.ts) now
// points here instead of the deleted orphaned path.
export default function VerifyCreditsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference');

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'failed' | 'pending'>('pending');
  const [data, setData] = useState<{ credits: number; amount: number; reference: string } | null>(null);
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
      const result = await smsApi.verifyPurchase(reference!);
      setStatus(result.status === 'success' ? 'success' : 'failed');
      setData(result);
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to verify payment');
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <Stack gap="lg" align="center" justify="center" style={{ minHeight: '60vh' }}>
        <LoadingOverlay visible={true} />
        <Title order={3}>Verifying Payment...</Title>
        <Text size="sm" c="dimmed">Please wait while we confirm your payment</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" align="center" justify="center" style={{ minHeight: '60vh' }}>
      <Card withBorder padding="xl" style={{ maxWidth: 600, width: '100%' }}>
        {status === 'success' && data && (
          <Stack gap="lg" align="center">
            <IconCheck size={64} color="green" />
            <Title order={2} ta="center">Payment Successful!</Title>
            <Text size="lg" ta="center" c="dimmed">
              Your SMS credits have been added to your account
            </Text>
            <Stack gap="xs" style={{ width: '100%' }}>
              <Group justify="space-between">
                <Text fw={500}>Credits Added:</Text>
                <Text fw={700} size="lg" c="green">{data.credits.toLocaleString()}</Text>
              </Group>
              <Group justify="space-between">
                <Text fw={500}>Amount Paid:</Text>
                <Text fw={700}>{formatCurrency(data.amount)}</Text>
              </Group>
              <Group justify="space-between">
                <Text fw={500}>Reference:</Text>
                <Text size="sm" c="dimmed">{data.reference}</Text>
              </Group>
            </Stack>
            <Group mt="md">
              <Button
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => router.push('/dashboard/communications/reports')}
              >
                Go to SMS Reports
              </Button>
            </Group>
          </Stack>
        )}

        {status === 'failed' && (
          <Stack gap="lg" align="center">
            <IconX size={64} color="red" />
            <Title order={2} ta="center">Payment Failed</Title>
            <Text size="lg" ta="center" c="dimmed">
              {error || 'We could not verify your payment. Please contact support if you were charged.'}
            </Text>
            {reference && (
              <Text size="sm" c="dimmed" ta="center">Reference: {reference}</Text>
            )}
            <Group mt="md">
              <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={verifyPayment}>
                Retry Verification
              </Button>
              <Button
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => router.push('/dashboard/communications/credits')}
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
