import { useRouter } from 'expo-router';
import { HandHeart, HeartHandshake, Inbox, PiggyBank, Plus } from 'lucide-react-native';
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
import { attentionCount, useAttention } from '@/features/dashboard/queries';
import { WELFARE_ADMIN_ACCESS, WELFARE_CONFIRM_ACCESS, WELFARE_MANAGE_ACCESS, WELFARE_MODULE, WELFARE_PAYOUT_ACCESS, useWelfareDashboard } from '@/features/welfareManage/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { formatMoney } from '@/lib/money';

/** project-overview.md §6.9 WF1 — welfare at a glance: money held, what came in and went out, and the contributions and requests waiting for you. */
export default function WelfareHubScreen() {
  const router = useRouter();
  const allowed = useModuleAccess(WELFARE_ADMIN_ACCESS, WELFARE_MODULE);
  const canManage = useCan(WELFARE_MANAGE_ACCESS);
  const canConfirm = useCan(WELFARE_CONFIRM_ACCESS);
  const canDecide = useCan(WELFARE_PAYOUT_ACCESS);
  const dashboard = useWelfareDashboard();
  const attention = useAttention().data;
  const waitingContributions = attentionCount(attention, 'welfareContributions');
  const waitingPayouts = attentionCount(attention, 'welfarePayouts');
  const back = () => router.back();
  const go = (path: string) => router.push(`/(app)/(tabs)/manage/welfare/${path}` as never);

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Welfare" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const data = dashboard.data;

  return (
    <Screen edges={['top']} refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()}>
      <ScreenHeader title="Welfare" onBack={back} docsKey="WF1" />

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
            icon={HeartHandshake}
            eyebrow="Held in welfare funds"
            stats={[
              { label: 'Contributed, all time', value: formatMoney(data.totalContributions) },
              { label: 'Paid out, all time', value: formatMoney(data.totalPayouts) },
              { label: 'Members contributing', value: `${data.memberParticipationRate}%` },
            ]}
            testID="welfare-hero"
          >
            <Money value={data.totalBalance} size="display" tone="onPassbook" />
          </SummaryHero>

          <Section title="Waiting for you">
            <ListGroup>
              {canConfirm ? (
                <ListItem
                  leading={<IconCircle icon={Inbox} tone={waitingContributions > 0 ? 'warning' : 'primary'} />}
                  title="Contributions"
                  meta="Confirm what members paid in"
                  trailing={waitingContributions > 0 ? <Badge tone="warning">{`${waitingContributions} to confirm`}</Badge> : undefined}
                  showChevron
                  onPress={() => go('contributions')}
                  testID="welfare-contributions"
                />
              ) : null}
              {canDecide ? (
                <ListItem
                  leading={<IconCircle icon={HandHeart} tone={waitingPayouts > 0 ? 'warning' : 'primary'} />}
                  title="Payout requests"
                  meta="Decide and pay out"
                  trailing={waitingPayouts > 0 ? <Badge tone="warning">{`${waitingPayouts} to decide`}</Badge> : undefined}
                  showChevron
                  onPress={() => go('payouts')}
                  testID="welfare-payouts"
                />
              ) : null}
            </ListGroup>
          </Section>

          {canManage ? (
            <Section title="Manage">
              <ListGroup>
                <ListItem
                  leading={<IconCircle icon={PiggyBank} tone="primary" />}
                  title="Funds"
                  meta={`${data.activeFunds} active of ${data.totalFunds} · rules and balances`}
                  showChevron
                  onPress={() => go('funds')}
                  testID="welfare-funds"
                />
                <ListItem
                  leading={<IconCircle icon={Plus} tone="info" />}
                  title="Record contributions"
                  meta="For one member, or many at once"
                  showChevron
                  onPress={() => go('contributions/record')}
                  testID="welfare-record"
                />
              </ListGroup>
            </Section>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
