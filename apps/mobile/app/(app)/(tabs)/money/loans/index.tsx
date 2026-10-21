import { useRouter } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { InlineEmpty } from '@/components/feedback/InlineEmpty';
import { ModuleLockedScreen } from '@/components/feedback/ModuleLockedScreen';
import { NoMemberProfile } from '@/components/feedback/NoMemberProfile';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { SectionCard } from '@/components/layout/SectionCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { LoanProgressBar, repaidPercent } from '@/features/cooperatives/components/LoanProgressBar';
import { useLoanRepaymentRequests, useMyLoanApplications, useMyLoans } from '@/features/cooperatives/loanQueries';
import { useCan } from '@/hooks/useCan';
import { useMemberId } from '@/hooks/useMemberId';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { COOPERATIVE_LOANS_APPLY_ACCESS, COOPERATIVE_LOANS_VIEW_ACCESS } from '@/lib/permissions';
import type { LoanApplicationDTO, LoanDTO } from '@/types/api/loans';

function LoanCard({ loan, pendingPayments, onPress }: { loan: LoanDTO; pendingPayments: number; onPress: () => void }) {
  const percent = repaidPercent(loan.totalPaid, loan.totalRepayment);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="gap-2 px-4 py-3" testID={`loan-card-${loan.id}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text variant="body-lg" numberOfLines={1}>
            {loan.loanProductName}
          </Text>
          <Text variant="caption" tone="secondary">{loan.loanNumber}</Text>
        </View>
        <StatusChip status={loan.status.toLowerCase()} />
      </View>
      <View className="flex-row items-end justify-between">
        <View>
          <Text variant="caption" tone="secondary">Outstanding</Text>
          <Money value={loan.outstandingBalance} size="h3" />
        </View>
        {loan.nextPaymentDate && loan.nextPaymentAmount ? (
          <View className="items-end">
            <Text variant="caption" tone="secondary">{`Next · ${formatDate(loan.nextPaymentDate, 'short')}`}</Text>
            <Money value={loan.nextPaymentAmount} />
          </View>
        ) : null}
      </View>
      <LoanProgressBar percent={percent} />
      <View className="flex-row items-center justify-between">
        <Text variant="caption" tone="secondary">{`${Math.round(percent)}% repaid`}</Text>
        {pendingPayments > 0 ? <Badge tone="warning">{`${pendingPayments} payment${pendingPayments === 1 ? '' : 's'} awaiting confirmation`}</Badge> : null}
      </View>
    </Pressable>
  );
}

function ApplicationRow({ application }: { application: LoanApplicationDTO }) {
  return (
    <View className="gap-1 px-4 py-3" testID={`loan-application-${application.id}`}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text variant="body-lg" numberOfLines={1}>
            {application.loanProductName}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${application.applicationNumber} · Applied ${formatDate(application.appliedAt, 'long')}`}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1">
          <Money value={application.amount} />
          <StatusChip status={application.status.toLowerCase()} />
        </View>
      </View>
      {application.guarantors.length > 0 ? (
        <Text variant="caption" tone="secondary">
          {`Guarantors: ${application.guarantors.map((g) => `${g.guarantorName} (${g.status.toLowerCase()})`).join(', ')}`}
        </Text>
      ) : null}
      {application.status === 'REJECTED' && application.rejectionReason ? (
        <Text variant="caption" tone="danger">{`Reason: ${application.rejectionReason}`}</Text>
      ) : null}
    </View>
  );
}

/** project-overview.md §6.4 M17 — My Loans: loans with outstanding / next payment / progress, my applications, Apply. */
export default function MyLoansScreen() {
  const router = useRouter();
  const canView = useCan(COOPERATIVE_LOANS_VIEW_ACCESS);
  const canApply = useCan(COOPERATIVE_LOANS_APPLY_ACCESS);
  const locked = useModuleDisabled('cooperatives');
  const memberId = useMemberId();

  const loansQuery = useMyLoans();
  const applicationsQuery = useMyLoanApplications();
  const requestsQuery = useLoanRepaymentRequests();

  if (locked) return <ModuleLockedScreen title="My Loans" moduleName="Cooperatives" onBack={() => router.back()} />;

  if (!memberId) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="My Loans" onBack={() => router.back()} />
        <NoMemberProfile subject="loans" />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="My Loans" onBack={() => router.back()} />
        <EmptyState icon={HandCoins} title="No access" description="You don't have access to cooperative loans." />
      </Screen>
    );
  }

  const loans = loansQuery.data?.loans ?? [];
  const applications = applicationsQuery.data?.applications ?? [];
  const pendingByLoan = new Map<number, number>();
  for (const request of requestsQuery.data?.repaymentRequests ?? []) {
    if (request.status === 'PENDING') pendingByLoan.set(request.loanId, (pendingByLoan.get(request.loanId) ?? 0) + 1);
  }

  const refresh = () => {
    loansQuery.refetch();
    applicationsQuery.refetch();
    requestsQuery.refetch();
  };

  return (
    <Screen edges={['top']} refreshing={loansQuery.isRefetching || applicationsQuery.isRefetching} onRefresh={refresh}>
      <ScreenHeader title="My Loans" onBack={() => router.back()} />

      <View className="gap-4 pb-6">
        {canApply ? (
          <Button variant="primary" onPress={() => router.push('/money/loans/apply' as never)}>
            Apply for a loan
          </Button>
        ) : null}

        <SectionCard title="Loans" trailing={<Badge tone="primary">{String(loans.length)}</Badge>}>
          {loansQuery.isPending ? (
            <View className="gap-2 px-4 py-3">
              <Skeleton width="100%" height={96} radius="md" />
            </View>
          ) : loansQuery.isError ? (
            <ErrorState error={loansQuery.error} onRetry={() => loansQuery.refetch()} />
          ) : loans.length === 0 ? (
            <InlineEmpty icon={HandCoins} message="No loans yet. Once an application is approved and paid out, your loan appears here." />
          ) : (
            loans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} pendingPayments={pendingByLoan.get(loan.id) ?? 0} onPress={() => router.push(`/money/loans/${loan.id}` as never)} />
            ))
          )}
        </SectionCard>

        <SectionCard title="Applications" trailing={<Badge tone="primary">{String(applications.length)}</Badge>}>
          {applicationsQuery.isPending ? (
            <View className="gap-2 px-4 py-3">
              <Skeleton width="100%" height={56} radius="md" />
            </View>
          ) : applicationsQuery.isError ? (
            <ErrorState error={applicationsQuery.error} onRetry={() => applicationsQuery.refetch()} />
          ) : applications.length === 0 ? (
            <InlineEmpty icon={HandCoins} message="You haven't applied for a loan yet." />
          ) : (
            applications.map((application) => <ApplicationRow key={application.id} application={application} />)
          )}
        </SectionCard>
      </View>
    </Screen>
  );
}
