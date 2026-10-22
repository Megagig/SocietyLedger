import { useLocalSearchParams, useRouter } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Passbook } from '@/components/ui/Passbook';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { LoanProgressBar, repaidPercent } from '@/features/cooperatives/components/LoanProgressBar';
import { RepaymentRequestRow } from '@/features/cooperatives/components/RepaymentRequestRow';
import { useLoan, useLoanRepaymentRequests, useLoanRepayments } from '@/features/cooperatives/loanQueries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { COOPERATIVE_LOAN_REPAY_ACCESS, COOPERATIVE_LOANS_VIEW_ACCESS } from '@/lib/permissions';

const TERMS = { FLAT: 'Flat rate', REDUCING_BALANCE: 'Reducing balance', COMPOUND: 'Compound' } as const;

/** project-overview.md §6.4 M18 — Loan detail: outstanding, terms, my payments (awaiting confirmation + recorded), repayment schedule. */
export default function LoanDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);

  const canView = useCan(COOPERATIVE_LOANS_VIEW_ACCESS);
  const canRepay = useCan(COOPERATIVE_LOAN_REPAY_ACCESS);
  const locked = useModuleDisabled('cooperatives');
  const memberId = useMemberId();

  const loanQuery = useLoan(loanId);
  const repaymentsQuery = useLoanRepayments(loanId);
  const requestsQuery = useLoanRepaymentRequests(loanId);

  const back = () => router.back();

  if (locked) return <ModuleLockedScreen title="Loan" moduleName="Cooperatives" onBack={back} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Loan" onBack={back} />
        <NoMemberProfile subject="loans" />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Loan" onBack={back} />
        <EmptyState icon={HandCoins} title="No access" description="You don't have access to cooperative loans." />
      </Screen>
    );
  }

  if (loanQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Loan" onBack={back} />
        <Skeleton width="100%" height={160} radius="lg" />
      </Screen>
    );
  }

  // The API 404s a loan that isn't the caller's, which lands here too.
  if (loanQuery.isError) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Loan" onBack={back} />
        <ErrorState error={loanQuery.error} onRetry={() => loanQuery.refetch()} />
      </Screen>
    );
  }

  const loan = loanQuery.data;
  const percent = repaidPercent(loan.totalPaid, loan.totalRepayment);
  const repayable = loan.status === 'ACTIVE' || loan.status === 'OVERDUE';
  const awaiting = (requestsQuery.data?.repaymentRequests ?? []).filter((r) => r.status !== 'APPROVED');
  const repayments = repaymentsQuery.data?.repayments ?? [];

  const refresh = () => {
    loanQuery.refetch();
    repaymentsQuery.refetch();
    requestsQuery.refetch();
  };

  return (
    <Screen edges={['top']} refreshing={loanQuery.isRefetching || repaymentsQuery.isRefetching || requestsQuery.isRefetching} onRefresh={refresh}>
      <ScreenHeader title={loan.loanProductName} onBack={back} docsKey="M18" />

      <View className="gap-6 pb-6">
        <Passbook
          label="Outstanding balance"
          amount={loan.outstandingBalance}
          metaLine={`${loan.loanNumber} · ${Math.round(percent)}% repaid`}
          stampLabel={loan.status.replace(/_/g, ' ')}
        />

        <LoanProgressBar percent={percent} />

        {repayable && canRepay ? (
          <Button variant="primary" onPress={() => router.push(`/money/loans/pay?loanId=${loan.id}` as never)}>
            Pay this loan
          </Button>
        ) : null}

        <SectionCard title="Terms">
          <ListItem title="Amount borrowed" trailing={<Money value={loan.principalAmount} />} />
          <ListItem title="Interest" meta={TERMS[loan.interestType]} trailing={<Text variant="body">{`${Number(loan.interestRate)}% a year`}</Text>} />
          <ListItem title="Tenure" trailing={<Text variant="body">{`${loan.tenureMonths} months`}</Text>} />
          <ListItem title="Monthly repayment" trailing={<Money value={loan.monthlyRepayment} />} />
          <ListItem title="Total to repay" trailing={<Money value={loan.totalRepayment} />} />
          <ListItem title="Paid so far" trailing={<Money value={loan.totalPaid} />} />
          <ListItem title="Paid out" trailing={<Text variant="body">{formatDate(loan.disbursedAt, 'long')}</Text>} />
          <ListItem title="Final payment due" trailing={<Text variant="body">{formatDate(loan.maturityDate, 'long')}</Text>} />
        </SectionCard>

        {awaiting.length > 0 ? (
          <SectionCard title="Payments awaiting your attention">
            {awaiting.map((request) => (
              <RepaymentRequestRow key={request.id} request={request} />
            ))}
          </SectionCard>
        ) : null}

        <SectionCard title="Payments recorded">
          {repaymentsQuery.isPending ? (
            <View className="gap-2 px-4 py-3">
              <Skeleton width="100%" height={40} radius="md" />
            </View>
          ) : repaymentsQuery.isError ? (
            <ErrorState error={repaymentsQuery.error} onRetry={() => repaymentsQuery.refetch()} />
          ) : repayments.length === 0 ? (
            <InlineEmpty icon={HandCoins} message="No payments recorded yet. A payment appears here once an officer confirms it." />
          ) : (
            repayments.map((repayment) => (
              <ListItem
                key={repayment.id}
                title={formatDate(repayment.paidAt, 'long')}
                meta={repayment.reference ? `Ref ${repayment.reference}` : undefined}
                trailing={<Money value={repayment.amount} />}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title="Repayment schedule">
          {loan.repaymentSchedule.length === 0 ? (
            <InlineEmpty icon={HandCoins} message="No schedule to show." />
          ) : (
            loan.repaymentSchedule.map((item) => (
              <ListItem
                key={item.id}
                title={`${item.installmentNumber}. ${formatDate(item.dueDate, 'long')}`}
                meta={`Principal ${Number(item.principalDue).toLocaleString('en-NG')} · Interest ${Number(item.interestDue).toLocaleString('en-NG')}`}
                trailing={
                  <View className="items-end gap-1">
                    <Money value={item.totalDue} />
                    <StatusChip status={item.status.toLowerCase()} />
                  </View>
                }
              />
            ))
          )}
        </SectionCard>
      </View>
    </Screen>
  );
}
