'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Group, LoadingOverlay, Pagination, SegmentedControl, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CheckCircle, FileText, Paperclip } from 'lucide-react';
import { nigerianPaymentsApi, type PaymentProof } from '@/lib/api/nigerian-payments';
import { ProofReviewModal } from './ProofReviewModal';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';

const PAGE_SIZE = 20;
const STATUS_LABEL: Record<Status, string> = { PENDING: 'Waiting', APPROVED: 'Verified', REJECTED: 'Rejected' };
const STATUS_COLOR: Record<Status, string> = { PENDING: 'yellow', APPROVED: 'green', REJECTED: 'red' };
const EMPTY: Record<Status, string> = {
  PENDING: 'No payment proofs are waiting.',
  APPROVED: 'No verified proofs yet.',
  REJECTED: 'No rejected proofs.',
};

interface ProofQueuePanelProps {
  /** Called with the number of proofs waiting, whenever the Waiting count is known — lets a page show it elsewhere. */
  onWaitingCount?: (count: number) => void;
}

/** The payment proofs queue: Waiting / Verified / Rejected, newest first, with a Review button that opens the full proof. */
export function ProofQueuePanel({ onWaitingCount }: ProofQueuePanelProps) {
  const [status, setStatus] = useState<Status>('PENDING');
  const [page, setPage] = useState(1);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviewId, setReviewId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await nigerianPaymentsApi.getPaymentProofs({ status, page, limit: PAGE_SIZE });
      setProofs(result.proofs || []);
      setTotal(result.pagination?.totalCount || 0);
      if (status === 'PENDING') onWaitingCount?.(result.pagination?.totalCount || 0);
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.response?.data?.message || 'Failed to load payment proofs', color: 'red' });
      setProofs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, page, onWaitingCount]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Stack gap="md">
      <SegmentedControl
        value={status}
        onChange={(value) => {
          setStatus(value as Status);
          setPage(1);
        }}
        data={(['PENDING', 'APPROVED', 'REJECTED'] as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        w="fit-content"
      />

      <Card withBorder padding="lg">
        <LoadingOverlay visible={loading} />
        {proofs.length === 0 && !loading ? (
          <Stack align="center" py="xl">
            <CheckCircle size={48} color="green" />
            <Text size="sm" c="dimmed" ta="center">
              {EMPTY[status]}
            </Text>
          </Stack>
        ) : (
          <>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Submitted</Table.Th>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Charges</Table.Th>
                  <Table.Th>Evidence</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {proofs.map((proof) => {
                  const charges = proof.transactionIds?.length > 0 ? proof.transactionIds.length : proof.transactionId ? 1 : 0;
                  return (
                    <Table.Tr key={proof.id}>
                      <Table.Td>{new Date(proof.uploadedAt).toLocaleDateString()}</Table.Td>
                      <Table.Td>
                        {proof.member ? (
                          <Text size="sm" fw={500}>
                            {proof.member.firstName} {proof.member.lastName} ({proof.member.memberId})
                          </Text>
                        ) : (
                          'N/A'
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" className="capitalize">
                          {proof.paymentMethod?.replace(/_/g, ' ') || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>{charges}</Table.Td>
                      <Table.Td>
                        {proof.hasFile ? (
                          <Group gap={4}>
                            <Paperclip size={14} />
                            <Text size="sm">{proof.filename ?? 'Receipt'}</Text>
                          </Group>
                        ) : (
                          <Group gap={4} wrap="nowrap">
                            <FileText size={14} />
                            <Text size="sm" c="dimmed" lineClamp={2} maw={220}>
                              {proof.declarationNote || 'No evidence provided'}
                            </Text>
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={STATUS_COLOR[proof.status]} size="sm">
                          {STATUS_LABEL[proof.status]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button size="xs" variant={proof.status === 'PENDING' ? 'filled' : 'light'} onClick={() => setReviewId(proof.id)}>
                          {proof.status === 'PENDING' ? 'Review' : 'View'}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            {totalPages > 1 && (
              <Group justify="center" mt="lg">
                <Pagination value={page} onChange={setPage} total={totalPages} />
              </Group>
            )}
          </>
        )}
      </Card>

      <ProofReviewModal proofId={reviewId} onClose={() => setReviewId(null)} onDecided={load} />
    </Stack>
  );
}
