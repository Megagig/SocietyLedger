import { useRouter } from 'expo-router';
import { FileText, HandCoins, Inbox, Landmark, PiggyBank, ScrollText, Wallet } from 'lucide-react-native';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { IconCircle } from '@/components/ui/IconCircle';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { SummaryHero } from '@/components/ui/SummaryHero';
import { COOP_ADMIN_ACCESS, COOP_LOANS_ACCESS, COOP_MODULE, COOP_SAVINGS_ACCESS, useCoopDashboard } from '@/features/coopManage/queries';
import { attentionCount, useAttention } from '@/features/dashboard/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';

/** project-overview.md §6.9 CP1 — the cooperative at a glance: savings, loans, what is waiting for a decision, and the ways in. */
export default function CooperativesHubScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(COOP_ADMIN_ACCESS, COOP_MODULE);
  const canSavings = useCan(COOP_SAVINGS_ACCESS);
  const canLoans = useCan(COOP_LOANS_ACCESS);
  const dashboard = useCoopDashboard();
  const attention = useAttention().data;
  const waitingDeposits = attentionCount(attention, 'savingsDeposits');
  const waitingRepayments = attentionCount(attention, 'loanRepayments');
  const waitingApplications = attentionCount(attention, 'loanApplications');
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/cooperatives/${path}` as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Cooperatives" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const data = dashboard.data;

  return (
    <Screen edges={['top']} refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()}>
      <ScreenHeader title="Cooperatives" onBack={back} docsKey="CP1" />

      {dashboard.isPending ? (
        <View className="gap-4 pb-6">
          <Skeleton width="100%" height={170} radius="lg" />
          <Skeleton width="100%" height={180} radius="md" />
        </View>
      ) : dashboard.isError || !data ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <View className="gap-6 pb-8">
          <SummaryHero
            icon={PiggyBank}
            eyebrow="Total savings"
            stats={[
              { label: 'Loans still owed', value: formatMoney(data.loansSummary.totalOutstanding) },
              { label: 'Repaid this month', value: formatMoney(data.loansSummary.totalCollectedThisMonth) },
              { label: 'Overdue loans', value: String(data.loansSummary.overdueLoans) },
            ]}
            testID="coop-hero"
          >
            <Money value={data.savingsSummary.totalBalance} size="display" tone="onPassbook" />
          </SummaryHero>

          <Section title="Waiting for you">
            <ListGroup>
              {canSavings ? (
                <ListItem
                  leading={<IconCircle icon={Inbox} tone={waitingDeposits > 0 ? 'warning' : 'primary'} />}
                  title="Deposit requests"
                  meta="Members' savings deposits to confirm"
                  trailing={waitingDeposits > 0 ? <Badge tone="warning">{`${waitingDeposits} waiting`}</Badge> : undefined}
                  showChevron
                  onPress={() => go('deposits')}
                  testID="coop-deposits"
                />
              ) : null}
              {canLoans ? (
                <ListItem
                  leading={<IconCircle icon={Wallet} tone={waitingRepayments > 0 ? 'warning' : 'primary'} />}
                  title="Repayment requests"
                  meta="Members' loan payments to confirm"
                  trailing={waitingRepayments > 0 ? <Badge tone="warning">{`${waitingRepayments} waiting`}</Badge> : undefined}
                  showChevron
                  onPress={() => go('repayments')}
                  testID="coop-repayments"
                />
              ) : null}
              {canLoans ? (
                <ListItem
                  leading={<IconCircle icon={FileText} tone={waitingApplications > 0 ? 'warning' : 'primary'} />}
                  title="Loan applications"
                  meta="Review, approve and pay out"
                  trailing={waitingApplications > 0 ? <Badge tone="warning">{`${waitingApplications} waiting`}</Badge> : undefined}
                  showChevron
                  onPress={() => go('applications')}
                  testID="coop-applications"
                />
              ) : null}
            </ListGroup>
          </Section>

          <Section title="Manage">
            <ListGroup>
              {canSavings ? (
                <ListItem
                  leading={<IconCircle icon={PiggyBank} tone="primary" />}
                  title="Savings accounts"
                  meta={`${data.savingsSummary.activeAccounts} active · open accounts, record deposits and withdrawals`}
                  showChevron
                  onPress={() => go('savings')}
                  testID="coop-savings"
                />
              ) : null}
              {canLoans ? (
                <ListItem
                  leading={<IconCircle icon={Landmark} tone="primary" />}
                  title="Loans"
                  meta={`${data.loansSummary.totalActiveLoans} active · schedules and repayments`}
                  showChevron
                  onPress={() => go('loans')}
                  testID="coop-loans"
                />
              ) : null}
              {canLoans ? (
                <ListItem leading={<IconCircle icon={ScrollText} tone="primary" />} title="Loan products" meta="Rates, tenure, limits and guarantors" showChevron onPress={() => go('products')} testID="coop-products" />
              ) : null}
              {canLoans && data.loansSummary.overdueLoans > 0 ? (
                <ListItem
                  leading={<IconCircle icon={HandCoins} tone="warning" />}
                  title="Overdue loans"
                  meta={`${data.loansSummary.overdueLoans} loans · ${formatMoney(data.loansSummary.overdueAmount)} overdue`}
                  showChevron
                  onPress={() => go('loans?status=OVERDUE')}
                  testID="coop-overdue"
                />
              ) : null}
            </ListGroup>
          </Section>
        </View>
      )}
    </Screen>
  );
}
