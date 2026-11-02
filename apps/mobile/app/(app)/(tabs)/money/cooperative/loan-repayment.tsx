import { useRouter } from 'expo-router';
import { HandCoins } from 'lucide-react-native';
import { View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useMyLoans } from '@/features/cooperatives/loanQueries';
import { OwnPage } from '@/features/coopEnhanced/components/OwnPage';
import { formatDate } from '@/lib/dates';
import { toDecimal } from '@/lib/money';
import { COOPERATIVE_LOAN_REPAY_ACCESS } from '@/lib/permissions';

/**
 * Loan Repayment: choose the loan you are paying, then pay what is due ("Optimal") or everything still owed ("Max"). The payment itself is
 * declared with its bank receipt on the next screen and recorded once an officer confirms the money arrived.
 */
export default function LoanRepaymentScreen() {
  const router = useRouter();
  const loans = useMyLoans();
  const open = (loans.data?.loans ?? []).filter((l) => l.status === 'ACTIVE' || l.status === 'OVERDUE');

  const pay = (loanId: number, amount?: string) =>
    router.push({ pathname: '/money/loans/pay', params: { loanId: String(loanId), ...(amount ? { amount } : {}) } } as never);

  return (
    <OwnPage
      title="Loan repayment"
      subject="loans"
      access={COOPERATIVE_LOAN_REPAY_ACCESS}
      refreshing={loans.isRefetching}
      onRefresh={() => void loans.refetch()}
    >
      <View className="gap-4 pb-8">
        <Text variant="body" tone="secondary">
          Manage and settle your outstanding loan obligations.
        </Text>
        {loans.isPending ? (
          <Skeleton width="100%" height={140} radius="lg" />
        ) : loans.isError ? (
          <ErrorState error={loans.error} onRetry={() => loans.refetch()} />
        ) : open.length === 0 ? (
          <EmptyState icon={HandCoins} title="Select a loan portfolio" description="You have no loans open for repayment. Choose a loan from My Loans once you have one." />
        ) : (
          open.map((loan) => {
            const owed = toDecimal(loan.outstandingBalance);
            const due = loan.nextPaymentAmount ? toDecimal(loan.nextPaymentAmount) : null;
            // The instalment due, but never more than is owed.
            const optimal = due ? (due.lessThan(owed) ? due : owed) : null;
            return (
              <Card key={loan.id}>
                <Text variant="body-strong">{loan.loanProductName}</Text>
                <Text variant="caption" tone="secondary">{`${loan.loanNumber}${loan.nextPaymentDate ? ` · next payment ${formatDate(loan.nextPaymentDate, 'short')}` : ''}`}</Text>
                <View className="mt-3 flex-row items-center justify-between">
                  <Text variant="caption" tone="secondary">Still owed</Text>
                  <Money value={owed.toString()} />
                </View>
                {optimal ? (
                  <View className="flex-row items-center justify-between">
                    <Text variant="caption" tone="secondary">Instalment due</Text>
                    <Money value={optimal.toString()} />
                  </View>
                ) : null}
                <View className="mt-3 flex-row gap-3">
                  {optimal ? (
                    <Button variant="soft" fullWidth onPress={() => pay(loan.id, optimal.toFixed(2))} testID={`repay-optimal-${loan.id}`}>
                      Pay instalment
                    </Button>
                  ) : null}
                  <Button variant="primary" fullWidth onPress={() => pay(loan.id, owed.toFixed(2))} testID={`repay-max-${loan.id}`}>
                    Pay in full
                  </Button>
                </View>
                <View className="mt-2 flex-row">
                  <Button variant="ghost" size="sm" onPress={() => pay(loan.id)}>
                    Pay another amount
                  </Button>
                </View>
              </Card>
            );
          })
        )}
      </View>
    </OwnPage>
  );
}
