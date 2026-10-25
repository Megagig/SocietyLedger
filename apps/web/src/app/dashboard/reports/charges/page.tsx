'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, Group, Loader, Pagination, Stack, Table, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { reportsApi } from '@/lib/api/reports';
import { chargeHref } from '@/lib/reports-drill';
import { ErrorDisplay } from '@/components/ErrorDisplay';

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: 'green' },
  partial: { label: 'Part paid', color: 'yellow' },
  pending: { label: 'Not paid yet', color: 'gray' },
  overdue: { label: 'Overdue', color: 'red' },
  waived: { label: 'Waived', color: 'blue' },
  voided: { label: 'Voided', color: 'gray' },
};

const money = (value: unknown) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value) || 0);

const day = (value: string | null) => (value ? new Date(value).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

/**
 * The charges behind a figure on a report. The totals at the top are over the whole list and equal the figure that was clicked;
 * each row opens that charge.
 */
function ChargesDrill() {
  const search = useSearchParams();
  const [page, setPage] = useState(1);
  const title = search.get('title') || 'Charges';

  const params = useMemo(() => {
    const get = (k: string) => search.get(k) || undefined;
    const num = (k: string) => (search.get(k) ? Number(search.get(k)) : undefined);
    return {
      scope: (get('scope') as 'raised' | 'owing' | 'overdue' | 'aging') ?? 'owing',
      startDate: get('startDate'),
      endDate: get('endDate'),
      categoryId: num('categoryId'),
      categoryType: get('categoryType'),
      memberId: num('memberId'),
      bucket: get('bucket'),
      asOfDate: get('asOfDate'),
      status: get('status'),
      owingOnly: search.get('owingOnly') === 'true' ? true : undefined,
    };
  }, [search]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['report-charges', params, page],
    queryFn: () => reportsApi.listCharges({ ...params, page, limit: PAGE_SIZE }),
    retry: false,
    keepPreviousData: true,
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
        <ErrorDisplay error={error} title="Failed to load the charges" onRetry={() => refetch()} />
      ) : result ? (
        <Stack gap="md">
          <Card withBorder padding="md">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Text size="xs" c="dimmed">
                  {result.totals.count.toLocaleString('en-NG')} {result.totals.count === 1 ? 'charge' : 'charges'}
                </Text>
                <Text size="sm" c="dimmed">
                  Charged
                </Text>
                <Text fw={700}>{money(result.totals.amount)}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Paid
                </Text>
                <Text fw={700} c="green">
                  {money(result.totals.paid)}
                </Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">
                  Still owed
                </Text>
                <Text fw={700} c={Number(result.totals.balance) > 0 ? 'orange' : undefined}>
                  {money(result.totals.balance)}
                </Text>
              </div>
            </Group>
          </Card>

          <Card withBorder padding="md" className="overflow-x-auto">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Member</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Due</Table.Th>
                  <Table.Th ta="right">Charged</Table.Th>
                  <Table.Th ta="right">Paid</Table.Th>
                  <Table.Th ta="right">Owed</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.charges.map((c: any) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <Link href={chargeHref(c.id)} className="underline decoration-dotted underline-offset-4">
                        {c.memberName}
                      </Link>
                      <Text size="xs" c="dimmed">
                        {c.memberNumber}
                      </Text>
                    </Table.Td>
                    <Table.Td>{c.categoryName}</Table.Td>
                    <Table.Td>{day(c.dueDate)}</Table.Td>
                    <Table.Td ta="right">{money(c.amount)}</Table.Td>
                    <Table.Td ta="right">{money(c.paid)}</Table.Td>
                    <Table.Td ta="right" fw={600}>
                      {money(c.balance)}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={STATUS_LABELS[c.status]?.color ?? 'gray'}>
                        {STATUS_LABELS[c.status]?.label ?? c.status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {result.charges.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text c="dimmed" ta="center" py="md">
                        No charges match this figure.
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

export default function ChargesDrillPage() {
  return (
    <Suspense fallback={null}>
      <ChargesDrill />
    </Suspense>
  );
}
