'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Badge, Button, Card, Group, Loader, Pagination, Stack, Table, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { reportsApi } from '@/lib/api/reports';
import { chargeHref } from '@/lib/reports-drill';
import { ErrorDisplay } from '@/components/ErrorDisplay';

const PAGE_SIZE = 25;

const money = (value: unknown) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value) || 0);

const day = (value: string) => new Date(value).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

/** The payments that make up money received. The total at the top is over the whole list; each row opens the charge it paid. */
function PaymentsDrill() {
  const search = useSearchParams();
  const [page, setPage] = useState(1);
  const title = search.get('title') || 'Payments';

  const params = useMemo(() => {
    const get = (k: string) => search.get(k) || undefined;
    const num = (k: string) => (search.get(k) ? Number(search.get(k)) : undefined);
    return {
      startDate: get('startDate'),
      endDate: get('endDate'),
      categoryId: num('categoryId'),
      categoryType: get('categoryType'),
      memberId: num('memberId'),
      paymentMethod: get('paymentMethod'),
    };
  }, [search]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['report-payments', params, page],
    queryFn: () => reportsApi.listPayments({ ...params, page, limit: PAGE_SIZE }),
    retry: false,
    placeholderData: keepPreviousData,
  });
  const result = data?.data;

  return (
    <div>
      <Button component={Link} href="/dashboard/reports" variant="subtle" leftSection={<IconArrowLeft size={16} />} mb="md">
        Back to Reports
      </Button>
      <Title order={2} mb="md">
        {title}
      </Title>

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <Loader size="lg" />
        </div>
      ) : error ? (
        <ErrorDisplay error={error} title="Failed to load the payments" onRetry={() => refetch()} />
      ) : result ? (
        <Stack gap="md">
          <Card withBorder padding="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed">
                  {result.totals.count.toLocaleString('en-NG')} {result.totals.count === 1 ? 'payment' : 'payments'}
                </Text>
                <Text size="sm" c="dimmed">
                  Money received
                </Text>
              </div>
              <Text size="xl" fw={700} c="green">
                {money(result.totals.amount)}
              </Text>
            </Group>
          </Card>

          <Card withBorder padding="md" className="overflow-x-auto">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Receipt</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.payments.map((p: any) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>{day(p.paymentDate)}</Table.Td>
                    <Table.Td>
                      <Link href={chargeHref(p.chargeId)} className="underline decoration-dotted underline-offset-4">
                        {p.memberName}
                      </Link>
                      <Text size="xs" c="dimmed">
                        {p.memberNumber}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {p.categoryName}
                      {p.chargeVoided && (
                        <Badge size="xs" variant="light" color="gray" ml="xs">
                          charge cancelled
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{p.paymentMethod ?? '—'}</Table.Td>
                    <Table.Td>{p.receiptNumber ?? '—'}</Table.Td>
                    <Table.Td ta="right" fw={600}>
                      {money(p.amountPaid)}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {result.payments.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" ta="center" py="md">
                        No payments match this figure.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>

          {result.pagination.totalPages > 1 && (
            <Group justify="center">
              <Pagination total={result.pagination.totalPages} value={page} onChange={setPage} />
            </Group>
          )}
        </Stack>
      ) : null}
    </div>
  );
}

export default function PaymentsDrillPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsDrill />
    </Suspense>
  );
}
