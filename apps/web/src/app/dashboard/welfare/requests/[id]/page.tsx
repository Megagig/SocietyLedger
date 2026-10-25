'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Alert, Anchor, Badge, Card, Group, Loader, Stack, Text } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { getPayoutRequest, WelfarePayoutRequest } from '@/lib/api/welfare';
import { entryHref, formatNaira } from '@/lib/accounting-drill';

const STATUS_COLORS: Record<string, string> = { PENDING: 'yellow', UNDER_REVIEW: 'blue', APPROVED: 'teal', REJECTED: 'red', DISBURSED: 'green', CANCELLED: 'gray' };

const date = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
const words = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

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

/** One welfare payout request: who asked, how much, why, who handled it, and the entry it made in the books. */
export default function PayoutRequestDetailPage() {
  const params = useParams();
  const requestId = Number(params.id);
  const { data, isLoading, error } = useQuery({
    queryKey: ['welfare-payout', requestId],
    queryFn: () => getPayoutRequest(requestId),
    enabled: Number.isInteger(requestId) && requestId > 0,
    retry: false,
  });
  const request: (WelfarePayoutRequest & { accountingEntryId?: number | null; disbursedAt?: string | null }) | undefined = data?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }
  if (error || !request) {
    return (
      <Alert color="red" title="Unable to load this payout">
        The payout request could not be found.
      </Alert>
    );
  }

  return (
    <div>
      <Anchor component={Link} href="/dashboard/welfare/requests" size="sm" c="dimmed" className="inline-flex items-center gap-1 mb-3">
        <IconArrowLeft size={14} /> Payout requests
      </Anchor>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          {request.requestNumber}
        </h1>
        <Group gap="xs">
          <Text size="xl" fw={700}>
            {formatNaira(request.approvedAmount ?? request.amount)}
          </Text>
          <Badge color={STATUS_COLORS[request.status] ?? 'gray'}>{words(request.status)}</Badge>
        </Group>
      </div>

      <Card withBorder padding="md" maw={640}>
        <Stack gap="sm">
          <Row label="Member">
            <Anchor component={Link} href={`/dashboard/finance/member-ledger/${request.member.id}`}>
              {request.member.firstName} {request.member.lastName} ({request.member.memberId})
            </Anchor>
          </Row>
          <Row label="Fund">{request.fund.name}</Row>
          <Row label="Kind">{words(request.payoutType)}</Row>
          <Row label="Asked for">{formatNaira(request.amount)}</Row>
          {request.approvedAmount ? <Row label="Approved">{formatNaira(request.approvedAmount)}</Row> : null}
          <Row label="Asked on">{date(request.requestedAt)}</Row>
          <Row label="Reason">{request.reason}</Row>
          {request.reviewer ? <Row label="Reviewed by">{request.reviewer.email}</Row> : null}
          {request.reviewComments ? <Row label="Review comments">{request.reviewComments}</Row> : null}
          {request.rejectionReason ? <Row label="Why it was turned down">{request.rejectionReason}</Row> : null}
          {request.approver ? <Row label="Approved by">{request.approver.email}</Row> : null}
          {request.disburser ? <Row label="Paid out by">{request.disburser.email}</Row> : null}
          {request.disbursementMethod ? <Row label="Paid by">{request.disbursementMethod}</Row> : null}
          {request.disbursementReference ? <Row label="Payment reference">{request.disbursementReference}</Row> : null}
          <Row label="In the books">
            {request.accountingEntryId ? (
              <Anchor component={Link} href={entryHref(request.accountingEntryId)} data-testid="payout-entry">
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
