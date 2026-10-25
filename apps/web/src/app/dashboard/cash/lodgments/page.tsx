'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Group, LoadingOverlay, Pagination, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core';
import { Plus } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { Can } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { cashApi, cashErrorMessage, formatNaira, LODGMENT_STATUS_COLOR, LODGMENT_STATUS_LABEL, type CashLodgment, type CashLodgmentStatus } from '@/lib/api/cash';
import { CashNav } from '@/components/cash/CashNav';
import { HelpLink } from '@/components/docs/HelpLink';

/** CA7 — lodgments by status, newest first: waiting for a check, verified against the statement, or rejected. */
export default function LodgmentsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CashLodgmentStatus>('PENDING');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<CashLodgment[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cashApi.listLodgments({ status, page, limit: 20 });
      setRows(result.items);
      setTotalPages(result.totalPages);
    } catch (error) {
      notifications.show({ title: 'Could not load lodgments', message: cashErrorMessage(error, 'Try again.'), color: 'red' });
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Can anyPermissions={[PERMISSIONS.CASH_COLLECT, PERMISSIONS.CASH_LODGE, PERMISSIONS.CASH_VERIFY, PERMISSIONS.CASH_VIEW]}>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Lodgments</Title>
            <Text size="sm" c="dimmed">
              Cash paid into the bank, and checked against the bank statement by a different officer
            </Text>
          </div>
          <Group>
            <HelpLink />
            <Can permission={PERMISSIONS.CASH_LODGE}>
              <Button leftSection={<Plus size={16} />} onClick={() => router.push('/dashboard/cash/lodge')}>
                Lodge cash
              </Button>
            </Can>
          </Group>
        </Group>

        <CashNav />

        <SegmentedControl
          value={status}
          onChange={(value) => {
            setStatus(value as CashLodgmentStatus);
            setPage(1);
          }}
          data={[
            { value: 'PENDING', label: 'Waiting' },
            { value: 'VERIFIED', label: 'Verified' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
          w={300}
        />

        <Card withBorder padding="lg">
          <LoadingOverlay visible={loading} />
          {rows.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {status === 'PENDING' ? 'Nothing waiting. Cash that has been paid into the bank shows up here until another officer checks it.' : `No ${LODGMENT_STATUS_LABEL[status].toLowerCase()} lodgments.`}
            </Text>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Paid in</Table.Th>
                  <Table.Th>Bank</Table.Th>
                  <Table.Th>Lodged by</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((l) => (
                  <Table.Tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/dashboard/cash/lodgments/${l.id}`)}>
                    <Table.Td>{new Date(l.depositDate).toLocaleDateString()}</Table.Td>
                    <Table.Td fw={500}>{l.bankAccount.bankName}</Table.Td>
                    <Table.Td>{l.lodgedBy.name}</Table.Td>
                    <Table.Td>
                      <Text fw={600}>{formatNaira(l.amount)}</Text>
                      {l.shortfall > 0 ? (
                        <Text size="xs" c="red">
                          Lodged short
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={LODGMENT_STATUS_COLOR[l.status]} variant="light">
                        {LODGMENT_STATUS_LABEL[l.status]}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {totalPages > 1 ? (
            <Group justify="center" mt="md">
              <Pagination value={page} onChange={setPage} total={totalPages} />
            </Group>
          ) : null}
        </Card>
      </Stack>
    </Can>
  );
}
