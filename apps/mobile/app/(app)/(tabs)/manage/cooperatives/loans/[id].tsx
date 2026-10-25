import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { INTEREST_TYPE_LABELS, LOAN_STATUS_LABELS, loanCanTakeRepayment, loanPercentRepaid, loanStatusKey } from '@/features/coopManage/labels';
import { COOP_LOANS_ACCESS, COOP_MODULE, useLoan, useLoanRepayments } from '@/features/coopManage/queries';
import { FactRow } from '@/features/members/components/FactRow';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

/** project-overview.md §6.9 CP5 — one loan: what is owed, the repayment schedule, the payments recorded, and Record repayment. */
export default function LoanDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const allowed = useModuleAccess(COOP_LOANS_ACCESS, COOP_MODULE);
  const query = useLoan(id);
  const payments = useLoanRepayments(id);
  const loan = query.data;
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Loan" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const percent = loan ? loanPercentRepaid(loan.totalPaid, loan.totalRepayment) : 0;

  return (
    <Screen edges={['top', 'bottom']} refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); void payments.refetch(); }}>
      <ScreenHeader title="Loan" onBack={back} docsKey="CP5" />

      {query.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={120} radius="lg" />
          <Skeleton width="100%" height={220} radius="md" />
        </View>
      ) : query.isError || !loan ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <View className="items-center gap-2 pt-1">
            <Text variant="body" tone="secondary">
              {`${loan.memberName} · ${loan.loanNumber}`}
            </Text>
            <Money value={loan.outstandingBalance} size="h1" />
            <StatusChip status={loanStatusKey(loan.status)} label={LOAN_STATUS_LABELS[loan.status]} />
            <View className="w-full pt-1">
              <ProgressBar percent={percent} tone={loan.status === 'PAID_OFF' ? 'success' : 'primary'} label="Repaid so far" />
              <Text variant="caption" tone="secondary" align="center">
                {`${percent}% repaid · still owed`}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            <StatTile label="Paid so far" value={formatMoney(loan.totalPaid)} tone="success" />
            <StatTile label="Next payment" value={loan.nextPaymentAmount ? formatMoney(loan.nextPaymentAmount) : '—'} tone="info" />
          </View>

          <Section title="The loan">
            <ListGroup>
              <FactRow label="Product" value={loan.loanProductName} />
              <FactRow label="Borrowed" amount={loan.principalAmount} />
              <FactRow label="Interest" value={`${Number(loan.interestRate)}% ${INTEREST_TYPE_LABELS[loan.interestType].toLowerCase()}`} />
              <FactRow label="Total to repay" amount={loan.totalRepayment} />
              <FactRow label="Monthly repayment" amount={loan.monthlyRepayment} />
              <FactRow label="Paid out" value={formatDate(loan.disbursedAt, 'long')} />
              <FactRow label="Ends" value={formatDate(loan.maturityDate, 'long')} />
              <FactRow label="Next payment due" value={loan.nextPaymentDate ? formatDate(loan.nextPaymentDate, 'long') : null} />
            </ListGroup>
          </Section>

          <Section title="Repayment schedule">
            <ListGroup>
              {loan.repaymentSchedule.map((item) => (
                <ListItem
                  key={item.id}
                  title={`Payment ${item.installmentNumber} · ${formatDate(item.dueDate, 'long')}`}
                  meta={`${formatMoney(item.totalDue)} due · ${formatMoney(item.totalPaid)} paid`}
                  trailing={<StatusChip status={item.status.toLowerCase()} label={item.status.charAt(0) + item.status.slice(1).toLowerCase()} />}
                />
              ))}
            </ListGroup>
          </Section>

          <Section title="Payments recorded">
            {payments.isPending ? (
              <Skeleton width="100%" height={100} radius="md" />
            ) : (payments.data?.repayments.length ?? 0) === 0 ? (
              <Text variant="body" tone="secondary">
                No payments have been recorded on this loan yet.
              </Text>
            ) : (
              <ListGroup>
                {payments.data!.repayments.map((p) => (
                  <ListItem
                    key={p.id}
                    title={formatDate(p.paidAt, 'long')}
                    meta={`${p.paymentMethod.replace(/_/g, ' ')}${p.reference ? ` · ${p.reference}` : ''}`}
                    trailing={<Money value={p.amount} size="body-strong" />}
                  />
                ))}
              </ListGroup>
            )}
          </Section>
        </View>
      )}

      {loan && loanCanTakeRepayment(loan.status) ? (
        <StickyFooter>
          <View className="flex-1">
            <Button variant="primary" fullWidth onPress={() => router.push(`/(app)/(tabs)/manage/cooperatives/loans/repay?id=${id}` as never)} testID="loan-repay">
              Record a repayment
            </Button>
          </View>
        </StickyFooter>
      ) : null}
    </Screen>
  );
}
