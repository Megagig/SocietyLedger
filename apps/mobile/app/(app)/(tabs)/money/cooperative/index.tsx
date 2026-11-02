import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Coins, Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { IconCircle } from '@/components/ui/IconCircle';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ContributionTable } from '@/features/coopEnhanced/components/ContributionTable';
import { CoopTile, type CoopTileTone } from '@/features/coopEnhanced/components/CoopTile';
import { MonthlyBars } from '@/features/coopEnhanced/components/MonthlyBars';
import { OwnPage } from '@/features/coopEnhanced/components/OwnPage';
import { useCoopDashboardV2, useMyPendingPayments } from '@/features/coopEnhanced/queries';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { COOPERATIVE_OWN_PAGES_ACCESS } from '@/lib/permissions';
import type { CoopAccountClass, CoopLastEntryDTO } from '@/types/api/coopEnhanced';

const SAVINGS_TONE: Record<CoopAccountClass, CoopTileTone> = { CONTRIBUTION: 'success', SHARES: 'info', SPECIAL: 'warning' };

function greeting(now = new Date()): string {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** "+₦5,000.00 as at 4 Mar 2026": the last thing that moved on the tile. */
function lastEntryHint(entry: CoopLastEntryDTO | null, masked: boolean): string {
  if (!entry) return 'Nothing recorded yet';
  const sign = entry.type === 'WITHDRAWAL' ? '−' : '+';
  return `${sign}${masked ? '₦ ••••••' : formatMoney(entry.amount)} as at ${formatDate(entry.date, 'short')}`;
}

/** Two tiles to a row, so a phone shows a pair at a time and a lone last tile keeps its width. */
function inPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

/**
 * The Cooperative Dashboard: a tile for every savings type and loan category the cooperative offers, what was paid for each month against
 * what was expected, and the year's activity. Nothing is fixed in the app: a type an officer creates shows up here on its own.
 */
export default function CooperativeDashboardScreen() {
  const router = useRouter();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [masked, setMasked] = useState(false);
  const dashboard = useCoopDashboardV2(year);
  const waiting = useMyPendingPayments({ status: 'PENDING' });
  const data = dashboard.data;
  const waitingCount = waiting.data?.pendingCount ?? 0;

  const refresh = () => {
    void dashboard.refetch();
    void waiting.refetch();
  };

  const tiles = data
    ? [
        ...data.savingsTiles.map((t) => ({
          key: `s${t.accountTypeId}`,
          label: t.name,
          value: t.balance,
          tone: SAVINGS_TONE[t.accountClass],
          hint: lastEntryHint(t.lastEntry, masked),
        })),
        ...data.loanTiles.map((t) => ({
          key: `l${t.loanCategoryId}`,
          label: t.name,
          value: t.outstanding,
          tone: (Number(t.outstanding) > 0 ? 'danger' : 'neutral') as CoopTileTone,
          hint: `${t.isGoods ? 'Goods loans owed' : 'Loans owed'}${t.activeLoans > 0 ? ` · ${t.activeLoans} active` : ''}`,
        })),
      ]
    : [];

  return (
    <OwnPage
      title="Cooperative"
      subject="cooperative"
      access={COOPERATIVE_OWN_PAGES_ACCESS}
      refreshing={dashboard.isRefetching}
      onRefresh={refresh}
      rightActions={
        <IconButton icon={masked ? Eye : EyeOff} accessibilityLabel={masked ? 'Show amounts' : 'Hide amounts'} onPress={() => setMasked((m) => !m)} testID="coop-hide" />
      }
    >
      {dashboard.isPending ? (
        <View className="gap-4">
          <Skeleton width="100%" height={80} radius="lg" />
          <Skeleton width="100%" height={110} radius="lg" />
          <Skeleton width="100%" height={180} radius="lg" />
        </View>
      ) : dashboard.isError || !data ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <View className="gap-5 pb-8">
          <View>
            <Text variant="h2">{`${greeting()}${data.memberName ? `, ${data.memberName.split(' ')[0]}` : ''}!`}</Text>
            <Text variant="body" tone="secondary">
              Track your cooperative contributions, loans, and financial progress.
            </Text>
          </View>

          <Card>
            <View className="flex-row items-center gap-3">
              <IconCircle icon={Coins} tone="success" />
              <View className="flex-1">
                <Text variant="caption" tone="secondary">
                  Monthly contribution
                </Text>
                {masked ? <Text variant="h2">₦ ••••••</Text> : <Money value={data.monthlyContribution} size="h2" />}
              </View>
            </View>
            <View className="mt-3 flex-row">
              <Button variant="secondary" size="sm" onPress={() => router.push('/money/cooperative/bank-accounts' as never)} testID="coop-where-to-pay">
                Where to pay
              </Button>
            </View>
          </Card>

          {waitingCount > 0 ? (
            <Card>
              <Text variant="body" tone="warning">
                {`${waitingCount} payment${waitingCount === 1 ? ' is' : 's are'} waiting for an officer to confirm the money arrived.`}
              </Text>
              <View className="mt-2 flex-row">
                <Button variant="ghost" size="sm" onPress={() => router.push('/money/cooperative/pending-payments' as never)}>
                  See pending payments
                </Button>
              </View>
            </Card>
          ) : null}

          <View className="gap-3" accessibilityLabel="Your balances">
            {inPairs(tiles).map((row) => (
              <View key={row.map((t) => t.key).join('-')} className="flex-row gap-3">
                {row.map((t) => (
                  <CoopTile key={t.key} label={t.label} value={t.value} tone={t.tone} hint={t.hint} masked={masked} />
                ))}
                {row.length === 1 ? <View className="flex-1" /> : null}
              </View>
            ))}
          </View>

          <Card>
            <View className="mb-3 flex-row items-center justify-between">
              <Text variant="h3">Contribution table</Text>
              <View className="flex-row items-center gap-1">
                <IconButton icon={ChevronLeft} accessibilityLabel="Previous year" onPress={() => setYear((y) => y - 1)} />
                <Text variant="body-strong">{String(year)}</Text>
                <IconButton icon={ChevronRight} accessibilityLabel="Next year" disabled={year >= thisYear} onPress={() => setYear((y) => Math.min(y + 1, thisYear))} />
              </View>
            </View>
            <ContributionTable table={data.contributionTable} />
          </Card>

          <MonthlyBars title="My contributions" subtitle={`Monthly contribution activity, ${year}`} data={data.charts.savingsByMonth.CONTRIBUTION} />
          <MonthlyBars title="Loan repayments" subtitle={`What you paid towards loans, ${year}`} data={data.charts.loansByMonth.repaid} tone="info" />
          <MonthlyBars title="Special savings" subtitle={`Special contribution activity, ${year}`} data={data.charts.savingsByMonth.SPECIAL} />
          <MonthlyBars title="Loans collected" subtitle={`Loans paid out to you, ${year}`} data={data.charts.loansByMonth.disbursed} tone="info" />
        </View>
      )}
    </OwnPage>
  );
}
