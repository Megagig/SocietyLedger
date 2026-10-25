'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Alert, Anchor, Badge, Card, Group, Loader, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { getLoan, getLoanRepayments } from '@/lib/api/cooperatives';
import { formatNaira } from '@/lib/accounting-drill';

type Money = string | number;

interface LoanDetail {
  id: number;
  loanNumber: string;
  memberName: string;
  member: { id: number; firstName: string; lastName: string; membershipId: string } | null;
  loanProductName: string;
  principalAmount: Money;
  interestRate: Money;
  tenureMonths: number;
  monthlyRepayment: Money;
  totalRepayment: Money;
  totalInterest: Money;
  processingFee: Money;
  amountDisbursed: Money;
  totalPaid: Money;
  outstandingBalance: Money;
  nextPaymentDate: string | null;
  nextPaymentAmount: Money | null;
  status: string;
  disbursedAt: string;
  maturityDate: string;
  repaymentSchedule: { id: number; installmentNumber: number; dueDate: string; totalDue: Money; totalPaid: Money; status: string }[];
}

interface RepaymentRow {
  id: number;
  amount: Money;
  principalPortion: Money;
  interestPortion: Money;
  lateFee: Money;
  paymentMethod: string;
  reference: string | null;
  processedByName: string;
  paidAt: string;
}

const STATUS_COLORS: Record<string, string> = { ACTIVE: 'green', OVERDUE: 'orange', DEFAULTED: 'red', PAID_OFF: 'teal', WRITTEN_OFF: 'gray', PAID: 'green', PARTIAL: 'yellow', PENDING: 'gray', WAIVED: 'gray' };

const date = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
const words = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** One loan: what was lent, what has been repaid and what is left, the schedule, and every repayment made. */
export default function LoanDetailPage() {
  const params = useParams();
  const loanId = Number(params.id);
  const valid = Number.isInteger(loanId) && loanId > 0;

  const loanQuery = useQuery({ queryKey: ['coop-loan', loanId], queryFn: () => getLoan(loanId), enabled: valid, retry: false });
  const repaymentsQuery = useQuery({ queryKey: ['coop-loan-repayments', loanId], queryFn: () => getLoanRepayments({ loanId, limit: 100 }), enabled: valid, retry: false });
  const loan: LoanDetail | undefined = loanQuery.data?.data;
  const repayments: RepaymentRow[] = repaymentsQuery.data?.data?.repayments ?? [];

  if (loanQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }
  if (loanQuery.error || !loan) {
    return (
      <Alert color="red" title="Unable to load this loan">
        The loan could not be found.
      </Alert>
    );
  }

  return (
    <div>
      <Anchor component={Link} href="/dashboard/cooperatives/loans" size="sm" c="dimmed" className="inline-flex items-center gap-1 mb-3">
        <IconArrowLeft size={14} /> Loans
      </Anchor>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-green-600 dark:from-teal-400 dark:to-green-400 bg-clip-text text-transparent mb-2">
          Loan {loan.loanNumber}
        </h1>
        <Group gap="xs">
          <Text c="dimmed">
            {loan.member ? (
              <Anchor component={Link} href={`/dashboard/finance/member-ledger/${loan.member.id}`}>
                {loan.memberName} ({loan.member.membershipId})
              </Anchor>
            ) : (
              loan.memberName
            )}
            {' · '}
            {loan.loanProductName}
          </Text>
          <Badge color={STATUS_COLORS[loan.status] ?? 'gray'}>{words(loan.status)}</Badge>
        </Group>
      </div>

      <SimpleGrid cols={{ base: 2, md: 4 }} mb="lg">
        {[
          ['Lent', loan.principalAmount],
          ['Repaid so far', loan.totalPaid],
          ['Still owed', loan.outstandingBalance],
          ['Each month', loan.monthlyRepayment],
        ].map(([label, value]) => (
          <Card key={String(label)} withBorder padding="md">
            <Text size="xs" c="dimmed">
              {String(label)}
            </Text>
            <Text size="xl" fw={700}>
              {formatNaira(value as Money)}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder padding="md" mb="lg" maw={640}>
        <Stack gap="xs">
          {[
            ['Interest', `${loan.interestRate}% over ${loan.tenureMonths} months`],
            ['Total to repay', formatNaira(loan.totalRepayment)],
            ['Interest in all', formatNaira(loan.totalInterest)],
            ['Processing fee', formatNaira(loan.processingFee)],
            ['Paid out', `${formatNaira(loan.amountDisbursed)} on ${date(loan.disbursedAt)}`],
            ['Due to finish', date(loan.maturityDate)],
            ...(loan.nextPaymentDate ? [['Next payment', `${loan.nextPaymentAmount !== null ? formatNaira(loan.nextPaymentAmount) : ''} on ${date(loan.nextPaymentDate)}`]] : []),
          ].map(([label, value]) => (
            <Group key={label} justify="space-between" wrap="nowrap" align="flex-start">
              <Text size="sm" c="dimmed">
                {label}
              </Text>
              <Text size="sm" ta="right">
                {value}
              </Text>
            </Group>
          ))}
        </Stack>
      </Card>

      <Card withBorder padding="md" mb="lg">
        <Text fw={600} mb="sm">
          Repayments made
        </Text>
        <Table.ScrollContainer minWidth={560}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
                <Table.Th ta="right">Principal</Table.Th>
                <Table.Th ta="right">Interest</Table.Th>
                <Table.Th>How</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {repayments.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" ta="center">
                      No repayment yet
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                repayments.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>{date(r.paidAt)}</Table.Td>
                    <Table.Td ta="right">{formatNaira(r.amount)}</Table.Td>
                    <Table.Td ta="right">{formatNaira(r.principalPortion)}</Table.Td>
                    <Table.Td ta="right">{formatNaira(r.interestPortion)}</Table.Td>
                    <Table.Td>{r.paymentMethod}</Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      <Card withBorder padding="md">
        <Text fw={600} mb="sm">
          Repayment schedule
        </Text>
        <Table.ScrollContainer minWidth={480}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Due</Table.Th>
                <Table.Th ta="right">Due</Table.Th>
                <Table.Th ta="right">Paid</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loan.repaymentSchedule.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>{item.installmentNumber}</Table.Td>
                  <Table.Td>{date(item.dueDate)}</Table.Td>
                  <Table.Td ta="right">{formatNaira(item.totalDue)}</Table.Td>
                  <Table.Td ta="right">{formatNaira(item.totalPaid)}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLORS[item.status] ?? 'gray'} variant="light">
                      {words(item.status)}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </div>
  );
}
