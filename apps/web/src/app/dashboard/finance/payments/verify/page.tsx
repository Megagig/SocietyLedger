'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiGet } from '@/utils/api';
import {
  Container,
  Paper,
  Title,
  Text,
  Loader,
  Button,
  Stack,
  Group,
  Badge,
  Divider,
  Alert,
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconAlertCircle,
  IconReceipt,
  IconArrowLeft,
} from '@tabler/icons-react';

interface PaymentData {
  status: 'success' | 'failed';
  reference: string;
  amount: number;
  receiptNumber?: string;
  transactionId?: number;
  transactionStatus?: string;
  paidAt?: string;
  gatewayResponse?: string;
}

export default function PaymentVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reference = searchParams.get('reference');

  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [data, setData] = useState<PaymentData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      setError('Payment reference is missing');
      return;
    }

    verifyPayment();
  }, [reference]);

  const verifyPayment = async () => {
    try {
      // Try to detect provider from reference format
      // Paystack: PAY-timestamp-id
      // Nomba: NMB-timestamp-id
      const isNomba = reference?.startsWith('NMB-');
      const endpoint = isNomba 
        ? `/api/payments/nomba/verify/${reference}`
        : `/api/payments/paystack/verify/${reference}`;

      // Through the shared client so it carries THIS tab's token and association, not whichever group signed in last in the browser.
      const response = await apiGet(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`);

      const result = await response.json();

      if (response.ok && result.success) {
        setStatus('success');
        setData(result.data);
      } else {
        setStatus('failed');
        setError(result.message || 'Payment verification failed');
        setData(result.data);
      }
    } catch (error: any) {
      setStatus('failed');
      setError(error.message || 'Failed to verify payment');
    }
  };

  // Loading State
  if (status === 'loading') {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" withBorder className="glass">
          <Stack align="center" gap="md">
            <Loader size="lg" color="teal" />
            <Title order={3} className="gradient-text">
              Verifying Payment...
            </Title>
            <Text c="dimmed" ta="center">
              Please wait while we confirm your payment with Paystack
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Reference: {reference}
            </Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Success State
  if (status === 'success' && data) {
    return (
      <Container size="sm" py="xl">
        <Paper p="xl" withBorder className="glass">
          <Stack gap="lg">
            {/* Success Icon */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-green-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                }}
              >
                <IconCheck size={48} color="var(--mantine-color-green-6)" />
              </div>
            </div>

            {/* Success Message */}
            <Stack gap="xs" align="center">
              <Title order={2} className="gradient-text">
                Payment Successful!
              </Title>
              <Text c="dimmed" ta="center">
                Your payment has been processed successfully
              </Text>
            </Stack>

            <Divider />

            {/* Payment Details */}
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={500}>Amount Paid:</Text>
                <Text size="xl" fw={700} c="green">
                  ₦{data.amount?.toLocaleString()}
                </Text>
              </Group>

              {data.receiptNumber && (
                <Group justify="space-between">
                  <Text fw={500}>Receipt Number:</Text>
                  <Badge size="lg" color="teal" variant="light">
                    {data.receiptNumber}
                  </Badge>
                </Group>
              )}

              <Group justify="space-between">
                <Text fw={500}>Payment Reference:</Text>
                <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
                  {data.reference}
                </Text>
              </Group>

              {data.transactionStatus && (
                <Group justify="space-between">
                  <Text fw={500}>Transaction Status:</Text>
                  <Badge
                    color={data.transactionStatus === 'paid' ? 'green' : 'yellow'}
                    variant="filled"
                  >
                    {data.transactionStatus.toUpperCase()}
                  </Badge>
                </Group>
              )}

              {data.paidAt && (
                <Group justify="space-between">
                  <Text fw={500}>Payment Date:</Text>
                  <Text size="sm">
                    {new Date(data.paidAt).toLocaleString('en-NG', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Text>
                </Group>
              )}
            </Stack>

            <Divider />

            {/* Action Buttons */}
            <Group grow>
              <Button
                variant="light"
                color="teal"
                leftSection={<IconReceipt size={18} />}
                onClick={() => {
                  if (data.transactionId) {
                    router.push(`/dashboard/finance/transactions/${data.transactionId}`);
                  }
                }}
              >
                View Transaction
              </Button>
              <Button
                variant="outline"
                color="gray"
                leftSection={<IconArrowLeft size={18} />}
                onClick={() => router.push('/dashboard/finance/transactions')}
              >
                Back to Transactions
              </Button>
            </Group>

            {/* Success Alert */}
            <Alert
              icon={<IconCheck size={18} />}
              title="Payment Confirmed"
              color="green"
              variant="light"
            >
              A receipt has been generated and your transaction has been updated. You can
              download your receipt from the transaction details page.
            </Alert>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Failed State
  return (
    <Container size="sm" py="xl">
      <Paper p="xl" withBorder className="glass">
        <Stack gap="lg">
          {/* Error Icon */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'var(--mantine-color-red-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <IconX size={48} color="var(--mantine-color-red-6)" />
            </div>
          </div>

          {/* Error Message */}
          <Stack gap="xs" align="center">
            <Title order={2} c="red">
              Payment Failed
            </Title>
            <Text c="dimmed" ta="center">
              {error || 'Your payment could not be processed'}
            </Text>
          </Stack>

          {data?.gatewayResponse && (
            <Alert
              icon={<IconAlertCircle size={18} />}
              title="Gateway Response"
              color="red"
              variant="light"
            >
              {data.gatewayResponse}
            </Alert>
          )}

          {reference && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Payment Reference:
              </Text>
              <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
                {reference}
              </Text>
            </Stack>
          )}

          <Divider />

          {/* Action Buttons */}
          <Group grow>
            <Button
              color="red"
              variant="light"
              onClick={() => {
                if (data?.transactionId) {
                  router.push(`/dashboard/finance/transactions/${data.transactionId}`);
                } else {
                  router.push('/dashboard/finance/transactions');
                }
              }}
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              color="gray"
              leftSection={<IconArrowLeft size={18} />}
              onClick={() => router.push('/dashboard/finance/transactions')}
            >
              Back to Transactions
            </Button>
          </Group>

          {/* Help Alert */}
          <Alert
            icon={<IconAlertCircle size={18} />}
            title="Need Help?"
            color="blue"
            variant="light"
          >
            If you believe this is an error or if the amount was deducted from your account,
            please contact support with your payment reference.
          </Alert>
        </Stack>
      </Paper>
    </Container>
  );
}
