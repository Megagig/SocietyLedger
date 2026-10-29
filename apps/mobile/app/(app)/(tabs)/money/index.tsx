import { View } from 'react-native';
import { Bell, BookOpen, CreditCard, FileText, Gift, HandCoins, PiggyBank, ShieldAlert, TrendingDown, TrendingUp, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Passbook } from '@/components/ui/Passbook';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ListGroup, ListItem } from '@/components/layout/ListItem';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { EmptyState } from '@/components/feedback/EmptyState';
import { tokens } from '@/theme/tokens';
import { useThemeTokens } from '@/providers/ThemeProvider';
import { useMemberFinanceSummary } from '@/features/memberFinance/queries';
import { useMyLedgerSummary } from '@/features/memberLedger/queries';
import { useCan } from '@/hooks/useCan';
import { useModuleDisabled } from '@/hooks/useModuleAccess';
import { formatDate } from '@/lib/dates';
import { COOPERATIVE_GUARANTOR_ACCESS, COOPERATIVE_SAVINGS_VIEW_ACCESS } from '@/lib/permissions';
import { formatMoney, toDecimal } from '@/lib/money';
import { ThriftEntry } from '@/features/ajo/components/ThriftEntry';
import { ThriftHomeRedirect } from '@/features/ajo/components/ThriftHomeRedirect';

/** A charge adds to what the member owes (+), a payment takes it away (–): the same direction the running balance moves. */
function entrySign(entryType: string): '+' | '–' {
  return entryType === 'CREDIT' ? '–' : '+';
}

export default function MoneyScreen() {
  const router = useRouter();
  const { color } = useThemeTokens();

  const canViewSavings = useCan(COOPERATIVE_SAVINGS_VIEW_ACCESS);
  const canGuarantee = useCan(COOPERATIVE_GUARANTOR_ACCESS);
  const cooperativesLocked = useModuleDisabled('cooperatives');

  const summaryQuery = useMemberFinanceSummary();
  const ledgerQuery = useMyLedgerSummary();

  const refreshing = [summaryQuery, ledgerQuery].some((q) => q.isRefetching);
  function handleRefresh() {
    summaryQuery.refetch();
    ledgerQuery.refetch();
  }

  const summary = summaryQuery.data;
  const ledger = ledgerQuery.data;

  const overdueCount = summary?.overdueCount ?? 0;
  const stampLabel = overdueCount > 0 ? `${overdueCount} OVERDUE` : 'PAID UP';
  // If the member ledger has no posted transactions yet (totalDebits = 0), fall back to the
  // finance-summary's outstanding amount so the card is never misleadingly ₦0.00.
  const ledgerHasActivity = ledger && (ledger.totalDebits.greaterThan(0) || ledger.totalCredits.greaterThan(0));
  const balance = ledgerHasActivity ? ledger!.currentBalance : toDecimal(summary?.totalOutstanding ?? 0);
  const metaLine = summary
    ? `Outstanding: ₦${toDecimal(summary.totalOutstanding).toFixed(2)}`
    : undefined;

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={handleRefresh}>
      <ThriftHomeRedirect />
      <ScreenHeader
        large
        title="Money"
        docsKey="M1"
        rightActions={
          <IconButton
            icon={Bell}
            accessibilityLabel="Notifications"
            onPress={() => router.push('/(app)/notifications')}
          />
        }
      />

      <View className="gap-6" style={{ paddingBottom: tokens.layout.tabBarHeight + 24 }}>
        {/* Passbook — ledger running balance as the headline figure */}
        {summaryQuery.isPending ? (
          <Skeleton width="100%" height={160} radius="lg" />
        ) : (
          <Passbook
            label="Ledger balance"
            amount={balance}
            metaLine={metaLine}
            stampLabel={stampLabel}
            actionLabel="Pay now"
            onAction={() => router.push('/money/ledger')}
          />
        )}

        {/* Quick-links rail */}
        <Section title="Finances">
          <ListGroup>
            <ListItem
              leading={<BookOpen size={20} color={color.primary} strokeWidth={1.75} />}
              title="My Ledger"
              meta="Running balance & history"
              showChevron
              onPress={() => router.push('/money/ledger')}
            />
            <ListItem
              leading={<CreditCard size={20} color={color.primary} strokeWidth={1.75} />}
              title="Payment History"
              meta="All confirmed payments"
              showChevron
              onPress={() => router.push('/money/payments')}
            />
            <ListItem
              leading={<FileText size={20} color={color.primary} strokeWidth={1.75} />}
              title="Statement"
              meta="Download PDF for any period"
              showChevron
              onPress={() => router.push('/money/ledger/statement')}
            />
          </ListGroup>
        </Section>

        <ThriftEntry />

        {/* Cooperative savings — hidden for members without cooperatives access or once the plan's module is off */}
        {canViewSavings && !cooperativesLocked ? (
          <Section title="Cooperative">
            <ListGroup>
              <ListItem
                leading={<PiggyBank size={20} color={color.warning} strokeWidth={1.75} />}
                title="My Savings"
                meta="Balance, deposits & history"
                showChevron
                onPress={() => router.push('/money/savings' as never)}
              />
              <ListItem
                leading={<HandCoins size={20} color={color.primary} strokeWidth={1.75} />}
                title="My Loans"
                meta="Balances, payments & applications"
                showChevron
                onPress={() => router.push('/money/loans' as never)}
              />
              {canGuarantee ? (
                <ListItem
                  leading={<Users size={20} color={color.primary} strokeWidth={1.75} />}
                  title="Guarantor Requests"
                  meta="Answer requests & see loans you guarantee"
                  showChevron
                  onPress={() => router.push('/money/guarantor-requests' as never)}
                />
              ) : null}
            </ListGroup>
          </Section>
        ) : null}

        {/* Breakdown — dues, levies, penalties, donations */}
        <Section title="Breakdown">
          <ListGroup>
            <ListItem
              leading={<HandCoins size={20} color={color.primary} strokeWidth={1.75} />}
              title="My Dues"
              meta={summary ? `${summary.duesSummary.count} items · ₦${toDecimal(summary.duesSummary.outstanding).toFixed(2)} outstanding` : 'Membership dues'}
              showChevron
              onPress={() => router.push('/money/dues' as never)}
            />
            <ListItem
              leading={<TrendingUp size={20} color={color.primary} strokeWidth={1.75} />}
              title="My Levies"
              meta={summary ? `${summary.leviesSummary.count} assigned · ₦${toDecimal(summary.leviesSummary.outstanding).toFixed(2)} outstanding` : 'Campaign contributions'}
              showChevron
              onPress={() => router.push('/money/levies' as never)}
            />
            <ListItem
              leading={<ShieldAlert size={20} color={color.danger} strokeWidth={1.75} />}
              title="My Penalties"
              meta={summary ? `${summary.penaltiesSummary.count} items · ₦${toDecimal(summary.penaltiesSummary.outstanding).toFixed(2)} outstanding` : 'Fines & penalties'}
              showChevron
              onPress={() => router.push('/money/penalties' as never)}
            />
            <ListItem
              leading={<Gift size={20} color={color.success} strokeWidth={1.75} />}
              title="My Donations"
              meta={summary ? `${summary.donationsSummary.count} donations made` : 'Voluntary contributions'}
              showChevron
              onPress={() => router.push('/money/donations' as never)}
            />
          </ListGroup>
        </Section>

        {/* Recent ledger activity (3 entries) */}
        <Section
          title="Recent activity"
          onSeeAll={() => router.push('/money/ledger')}
        >
          {ledgerQuery.isPending ? (
            <View className="gap-2">
              <Skeleton width="100%" height={56} radius="md" />
              <Skeleton width="100%" height={56} radius="md" />
              <Skeleton width="100%" height={56} radius="md" />
            </View>
          ) : ledger && ledger.recentEntries.length > 0 ? (
            <ListGroup testID="money-recent-activity">
              {ledger.recentEntries.slice(0, 3).map((entry) => {
                const isCredit = entry.entryType === 'CREDIT';
                return (
                  <ListItem
                    key={entry.id}
                    title={entry.description}
                    meta={formatDate(entry.effectiveDate, 'short')}
                    trailing={
                      <View className="items-end gap-0.5">
                        <Text
                          variant="body-strong"
                          style={{ color: isCredit ? color.success : color.danger }}
                        >
                          {entrySign(entry.entryType)}{formatMoney(entry.amount)}
                        </Text>
                        <Money value={entry.runningBalance} size="caption" tone="secondary" />
                      </View>
                    }
                    onPress={() => router.push('/money/ledger')}
                  />
                );
              })}
            </ListGroup>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No activity yet"
              description="Your ledger entries will appear here once transactions are recorded."
            />
          )}
        </Section>

        {/* Finance summary chips */}
        {summary ? (
          <Section title="Summary">
            <ListGroup>
              <ListItem
                leading={<TrendingDown size={20} color={color.danger} strokeWidth={1.75} />}
                title="Total charged"
                trailing={<Money value={summary.totalDue} />}
              />
              <ListItem
                leading={<TrendingUp size={20} color={color.success} strokeWidth={1.75} />}
                title="Total paid"
                trailing={<Money value={summary.totalPaid} />}
              />
            </ListGroup>
          </Section>
        ) : null}
      </View>
    </Screen>
  );
}
