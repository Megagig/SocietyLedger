'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Alert, Anchor, Badge, Card, Group, Loader, Stack, Text } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import api from '@/lib/axios';
import { entryHref, formatNaira } from '@/lib/accounting-drill';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface PaymentDetail {
  id: number;
  transactionId: number;
  amountPaid: string | number;
  paymentDate: string;
  paymentMethod: string | null;
  receiptNumber: string | null;
  confirmedAt: string | null;
  accountingSynced?: boolean;
  accountingEntryId?: number | null;
  transaction: {
    id: number;
    memberId: number;
    referenceNumber: string | null;
    member: { id: number; memberId: string; firstName: string; lastName: string };
    category: { id: number; name: string; type: string };
  } | null;
  confirmer: { id: number; email: string } | null;
}

const date = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" ta="right">
        {children}
      </Text>
    </Group>
  );
}

/** One payment: how much, when, how, who paid, the charge it paid, and the entry it made in the books. */
export default function PaymentDetailPage() {
  const params = useParams();
  const paymentId = Number(params.id);
  const { data, isLoading, error } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => (await api.get(`${API_URL}/api/finance/payments/${paymentId}`)).data,
    enabled: Number.isInteger(paymentId) && paymentId > 0,
    retry: false,
  });
  const payment: PaymentDetail | undefined = data?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }
  if (error || !payment) {
    return (
      <Alert color="red" title="Unable to load this payment">
        The payment could not be found.
      </Alert>
    );
  }

  const member = payment.transaction?.member;
  return (
    <div>
      <Anchor component={Link} href="/dashboard/finance/transactions" size="sm" c="dimmed" className="inline-flex items-center gap-1 mb-3">
        <IconArrowLeft size={14} /> Charges
      </Anchor>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Payment {payment.receiptNumber ?? `#${payment.id}`}
        </h1>
        <Group gap="xs">
          <Text size="xl" fw={700}>
            {formatNaira(payment.amountPaid)}
          </Text>
          <Badge color={payment.confirmedAt ? 'green' : 'yellow'}>{payment.confirmedAt ? 'Confirmed' : 'Recorded'}</Badge>
        </Group>
      </div>

      <Card withBorder padding="md" maw={640}>
        <Stack gap="sm">
          <Row label="Paid on">{date(payment.paymentDate)}</Row>
          <Row label="How">{payment.paymentMethod ?? 'Not recorded'}</Row>
          {payment.receiptNumber ? <Row label="Receipt">{payment.receiptNumber}</Row> : null}
          {member ? (
            <Row label="Paid by">
              <Anchor component={Link} href={`/dashboard/finance/member-ledger/${member.id}`}>
                {member.firstName} {member.lastName} ({member.memberId})
              </Anchor>
            </Row>
          ) : null}
          {payment.transaction ? (
            <Row label="For">
              <Anchor component={Link} href={`/dashboard/finance/transactions/${payment.transaction.id}`} data-testid="payment-charge">
                {payment.transaction.category.name}
                {payment.transaction.referenceNumber ? ` · ${payment.transaction.referenceNumber}` : ''}
              </Anchor>
            </Row>
          ) : null}
          {payment.confirmer ? <Row label="Confirmed by">{payment.confirmer.email}</Row> : null}
          <Row label="In the books">
            {payment.accountingEntryId ? (
              <Anchor component={Link} href={entryHref(payment.accountingEntryId)} data-testid="payment-entry">
                See the journal entry
              </Anchor>
            ) : (
              'Not entered yet'
            )}
          </Row>
        </Stack>
      </Card>
    </div>
  );
}
