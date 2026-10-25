import type { UseQueryResult } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FileDown, Share2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Share, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { DateField } from '@/components/forms/DateField';
import { OptionDropdown } from '@/components/forms/OptionDropdown';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { IconButton } from '@/components/ui/IconButton';
import { Money } from '@/components/ui/Money';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { StatementSection } from '@/features/accounting/components/StatementSection';
import {
  AS_AT_OPTIONS,
  asAtMoment,
  balanceSheetText,
  cashFlowText,
  changeText,
  changeTone,
  COMPARE_OPTIONS,
  dayOf,
  endOfLagosDay,
  entryHref,
  incomeStatementText,
  ledgerHref,
  type LedgerTarget,
  type AsAt,
  type CompareChoice,
} from '@/features/accounting/labels';
import { useShareStatementPdf } from '@/features/accounting/mutations';
import { useAccountingAccess, useBalanceSheet, useCashFlow, useIncomeStatement } from '@/features/accounting/queries';
import { PeriodPicker } from '@/features/reports/components/PeriodPicker';
import { defaultPeriod, EXPORT_FINANCIAL_ACCESS, rangeParams, type PeriodState } from '@/features/reports/labels';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { toDecimal } from '@/lib/money';
import { useTenantStore } from '@/stores/tenant';
import type { BalanceSheetDTO, CashFlowDTO, CashFlowGroupDTO, ChangeDTO, IncomeStatementDTO } from '@/types/api/accounting';

type View3 = 'income' | 'balance' | 'cash';

/** Opens a ledger from a line or total on a statement, for the same dates the statement was drawn for. */
function useOpenLedger() {
  const router = useRouter();
  return (target: LedgerTarget) => router.push(ledgerHref(target) as never);
}

/** Waits for a statement: a skeleton while it is worked out, a retry if it fails, then the statement. */
function Loaded<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) {
    return (
      <View className="gap-3">
        <Skeleton width="100%" height={120} radius="md" />
        <Skeleton width="100%" height={160} radius="md" />
      </View>
    );
  }
  if (query.isError || query.data === undefined) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}

/** project-overview.md §6.9 AC5 — the income statement, balance sheet and cash flow, as on the website. Each shares as text, and as a PDF for someone who may export. */
export default function StatementsScreen() {
  const router = useRouter();
  const allowed = useAccountingAccess();
  const association = useTenantStore((s) => s.current?.name) ?? 'Association';
  // The dashboard can open a statement on a view and a stretch: this year's surplus, or one month of the trend
  const opened = useLocalSearchParams<{ view?: string; period?: string; startDate?: string; endDate?: string }>();
  const [view, setView] = useState<View3>(() => (opened.view === 'balance' || opened.view === 'cash' ? opened.view : 'income'));
  const [period, setPeriod] = useState<PeriodState>(() =>
    opened.period === 'custom' && opened.startDate && opened.endDate
      ? { period: 'custom', startDate: opened.startDate, endDate: opened.endDate }
      : defaultPeriod(opened.period === 'this_year' ? 'this_year' : 'this_month'),
  );
  const [compare, setCompare] = useState<CompareChoice>('none');
  const [asAt, setAsAt] = useState<AsAt>('today');
  // A date picked for "As at" is worked out when it is chosen, so the sheet does not change under the officer's eyes
  const [pickedMoment, setAsAtDate] = useState(() => asAtMoment('today'));
  const { control } = useForm<{ day: string }>({ defaultValues: { day: new Date().toISOString() } });
  const chosenDay = useWatch({ control, name: 'day' });
  // "Choose a date" draws the sheet to the end of that day in Lagos; the other choices were worked out when they were picked
  const asAtDate = asAt === 'choose' && chosenDay ? endOfLagosDay(dayOf(chosenDay)) : pickedMoment;
  const params = rangeParams(period);
  const canPdf = useCan(EXPORT_FINANCIAL_ACCESS);
  const pdf = useShareStatementPdf();
  const income = useIncomeStatement(view === 'income' ? params : null, compare === 'previous');
  const cash = useCashFlow(view === 'cash' ? params : null);
  // The balance sheet is worked out only while it is the one on show
  const balance = useBalanceSheet(view === 'balance' ? asAtDate : null);
  const back = () => router.back();

  // The words for the share sheet, worked out from the statement on screen once it has loaded
  const shareText =
    view === 'income' && income.data
      ? incomeStatementText(income.data, association)
      : view === 'balance' && balance.data
        ? balanceSheetText(balance.data, association, formatDate(asAtDate, 'long'))
        : view === 'cash' && cash.data
          ? cashFlowText(cash.data, association)
          : null;

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Financial statements" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }

  const share = () => {
    if (shareText) void Share.share({ message: shareText });
  };

  // The same statement as a PDF made on the server, so it carries the association's name and looks the same for everyone
  const sharePdf = () => {
    if (view !== 'balance' && !params) return;
    const payload = view === 'balance' ? { statement: view, asOfDate: asAtDate } : { statement: view === 'income' ? ('income' as const) : ('cash' as const), ...params };
    pdf.mutate(payload as Parameters<typeof pdf.mutate>[0], { onError: (error) => toast.error(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Could not make the PDF. Try again.') });
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Financial statements"
        onBack={back}
        docsKey="AC5"
        rightActions={
          shareText ? (
            <View className="flex-row">
              <IconButton icon={Share2} accessibilityLabel="Share this statement as text" onPress={share} testID="statement-share" />
              {canPdf ? <IconButton icon={FileDown} accessibilityLabel="Share this statement as a PDF" onPress={sharePdf} testID="statement-pdf" /> : null}
            </View>
          ) : undefined
        }
      />

      <View className="gap-5 pb-8">
        <SegmentedControl
          options={[
            { label: 'Income', value: 'income' },
            { label: 'Balance sheet', value: 'balance' },
            { label: 'Cash flow', value: 'cash' },
          ]}
          value={view}
          onChange={(next) => {
            setView(next);
            // "Today" is worked out again when the balance sheet is opened, so it never shows yesterday's books
            if (next === 'balance' && asAt === 'today') setAsAtDate(asAtMoment('today'));
          }}
          testID="statement-view"
        />

        {view === 'balance' ? (
          <View className="gap-3">
            <OptionDropdown
              label="As at"
              value={asAt}
              options={[...AS_AT_OPTIONS]}
              onChange={(next) => {
                setAsAt(next);
                if (next !== 'choose') setAsAtDate(asAtMoment(next));
              }}
              testID="statement-as-at"
            />
            {asAt === 'choose' ? <DateField control={control} name="day" label="Date" mode="date" testID="statement-as-at-date" /> : null}
          </View>
        ) : (
          <View className="gap-3">
            <PeriodPicker value={period} onChange={setPeriod} />
            {view === 'income' ? <OptionDropdown label="Compare with" value={compare} options={[...COMPARE_OPTIONS]} onChange={setCompare} testID="statement-compare" /> : null}
          </View>
        )}

        {view === 'income' ? (
          <Loaded query={income}>{(r) => <IncomeView report={r} />}</Loaded>
        ) : view === 'balance' ? (
          <Loaded query={balance}>{(r) => <BalanceView report={r} />}</Loaded>
        ) : (
          <Loaded query={cash}>{(r) => <CashView report={r} />}</Loaded>
        )}
      </View>
    </Screen>
  );
}

/** One line of a comparison: what it was before, and how much it has changed. */
function CompareLine({ label, before, change, kind, testID }: { label: string; before: string | number; change: ChangeDTO; kind: 'good-when-up' | 'good-when-down'; testID: string }) {
  return (
    <View className="min-h-[48px] flex-row items-center justify-between gap-3 px-4 py-3" testID={testID}>
      <View className="flex-1">
        <Text variant="body">{label}</Text>
        <Text variant="caption" tone={changeTone(change, kind)}>
          {changeText(change)}
        </Text>
      </View>
      <View className="items-end">
        <Money value={before} size="body" />
        <Text variant="caption" tone="secondary">
          before
        </Text>
      </View>
    </View>
  );
}

function IncomeView({ report }: { report: IncomeStatementDTO }) {
  const open = useOpenLedger();
  const loss = toDecimal(report.netIncome).isNegative();
  const c = report.comparison;
  const dates = { from: report.period.startDate, to: report.period.endDate, datesLabel: report.period.label };
  const lines = (accounts: IncomeStatementDTO['revenue']['accounts']) => accounts.map((a) => ({ ...a, onPress: () => open({ accountId: a.accountId, title: a.accountName, ...dates }) }));
  return (
    <View className="gap-5" testID="income-statement">
      <StatementSection title="Income" rows={lines(report.revenue.accounts)} totalLabel="Total income" total={report.revenue.total} onOpenTotal={() => open({ scope: 'INCOME', title: 'Income', ...dates })} emptyText="No income posted in this period" />
      <StatementSection title="Expenses" rows={lines(report.expenses.accounts)} totalLabel="Total expenses" total={report.expenses.total} onOpenTotal={() => open({ scope: 'EXPENSE', title: 'Expenses', ...dates })} emptyText="No spending posted in this period" />
      <Section title={loss ? 'Net loss' : 'Net surplus'}>
        <Money value={report.netIncome} size="h1" tone={loss ? 'danger' : 'default'} testID="net-income" />
        <Text variant="caption" tone="secondary">
          {report.period.label}. Only entries that have been posted are counted.
        </Text>
      </Section>
      {c ? (
        <Section title="Compared with the period before">
          <View className="overflow-hidden rounded-md border border-border bg-surface dark:border-transparent" testID="income-comparison">
            <CompareLine label="Income" before={c.previousPeriod.revenue} change={c.changes.revenue} kind="good-when-up" testID="compare-income" />
            <CompareLine label="Expenses" before={c.previousPeriod.expenses} change={c.changes.expenses} kind="good-when-down" testID="compare-expenses" />
            <CompareLine label={loss ? 'Net loss' : 'Net surplus'} before={c.previousPeriod.netIncome} change={c.changes.netIncome} kind="good-when-up" testID="compare-net" />
          </View>
        </Section>
      ) : null}
    </View>
  );
}

function BalanceView({ report }: { report: BalanceSheetDTO }) {
  const open = useOpenLedger();
  const a = report.assets;
  const l = report.liabilities;
  // Everything posted up to the date the sheet is drawn for
  const dates = { to: report.asOfDate, datesLabel: `Up to ${formatDate(report.asOfDate, 'long')}` };
  const lines = (accounts: BalanceSheetDTO['assets']['current']) => accounts.map((x) => ({ ...x, onPress: () => open({ accountId: x.accountId, title: x.accountName, ...dates }) }));
  const together = (title: string, accounts: BalanceSheetDTO['assets']['current']) => () => open({ accountIds: accounts.map((x) => x.accountId), title, ...dates });
  return (
    <View className="gap-5" testID="balance-sheet">
      <StatementSection title="Current assets" rows={lines(a.current)} totalLabel="Total current assets" total={a.totalCurrent} onOpenTotal={together('Current assets', a.current)} emptyText="None" />
      <StatementSection title="Fixed assets" rows={lines(a.fixed)} totalLabel="Total fixed assets" total={a.totalFixed} onOpenTotal={together('Fixed assets', a.fixed)} emptyText="None" />
      {a.other.length > 0 ? <StatementSection title="Other assets" rows={lines(a.other)} totalLabel="Total other assets" total={a.totalOther} onOpenTotal={together('Other assets', a.other)} /> : null}
      <StatementSection title="Total assets" rows={[]} totalLabel="Total assets" total={a.total} onOpenTotal={() => open({ scope: 'ASSET', title: 'All assets', ...dates })} emptyText="Everything the association owns" />
      <StatementSection title="Current liabilities" rows={lines(l.current)} totalLabel="Total current liabilities" total={l.totalCurrent} onOpenTotal={together('Current liabilities', l.current)} emptyText="Nothing owed" />
      <StatementSection title="Long-term liabilities" rows={lines(l.longTerm)} totalLabel="Total long-term liabilities" total={l.totalLongTerm} onOpenTotal={together('Long-term liabilities', l.longTerm)} emptyText="Nothing owed" />
      {(l.other ?? []).length > 0 ? <StatementSection title="Other liabilities" rows={lines(l.other ?? [])} totalLabel="Total other liabilities" total={l.totalOther ?? 0} onOpenTotal={together('Other liabilities', l.other ?? [])} /> : null}
      <StatementSection title="Total liabilities" rows={[]} totalLabel="Total liabilities" total={l.total} onOpenTotal={() => open({ scope: 'LIABILITY', title: 'All liabilities', ...dates })} emptyText="Everything the association owes" />
      <StatementSection
        title="Equity"
        rows={[...lines(report.equity.accounts), { accountName: 'Earnings so far', balance: report.equity.retainedEarnings }]}
        totalLabel="Total equity"
        total={report.equity.total}
      />
      {report.isBalanced ? (
        <Text variant="caption" tone="success" testID="balance-note">
          Balanced: assets equal liabilities and equity.
        </Text>
      ) : (
        <View className="rounded-lg bg-warning-soft p-4" testID="balance-warning">
          <Text variant="body-strong" tone="warning">
            This sheet does not balance
          </Text>
          <Text variant="caption">Assets are {toDecimal(report.assets.total).toFixed(2)} but liabilities and equity are {toDecimal(report.totalLiabilitiesAndEquity).toFixed(2)}. Check the entries around the dates it changed.</Text>
        </View>
      )}
    </View>
  );
}

/** One kind of cash movement, itemised: each thing that came in or went out, and the net. Empty kinds are left out. */
function CashActivity({ title, group, testID }: { title: string; group: CashFlowGroupDTO; testID: string }) {
  const router = useRouter();
  if (group.inflows.length === 0 && group.outflows.length === 0) return null;
  // Each movement opens the journal entry it came from
  const line = (prefix: string, item: CashFlowGroupDTO['inflows'][number]) => ({
    accountName: `${prefix}: ${item.description}`,
    balance: item.amount,
    onPress: item.entryId ? () => router.push(entryHref(item.entryId as number) as never) : undefined,
  });
  const rows = [...group.inflows.map((i) => line('In', i)), ...group.outflows.map((o) => line('Out', o))];
  return <StatementSection title={title} rows={rows} totalLabel="Net cash" total={group.netCash} testID={testID} />;
}

function CashView({ report }: { report: CashFlowDTO }) {
  const open = useOpenLedger();
  const before = new Date(new Date(report.period.startDate).getTime() - 1).toISOString();
  const rows = [
    { accountName: 'From running the association', balance: report.operating.netCash },
    { accountName: 'From buying or selling assets', balance: report.investing.netCash },
    { accountName: 'From loans and equity', balance: report.financing.netCash },
  ];
  const start = toDecimal(report.beginningCash);
  const change = start.isZero() ? null : toDecimal(report.netCashChange).dividedBy(start).times(100).toFixed(1);
  return (
    <View className="gap-5" testID="cash-flow">
      <StatementSection title="Cash at the start" rows={[]} totalLabel="Cash at the start" total={report.beginningCash} onOpenTotal={() => open({ scope: 'cash', title: 'Cash and bank', to: before, datesLabel: 'Up to the start' })} emptyText={report.period.label} />
      <StatementSection title="Where cash moved" rows={rows} totalLabel="Change in cash" total={report.netCashChange} />
      {change !== null ? (
        <Text variant="caption" tone="secondary" testID="cash-change-percent">
          That is a change of {change}% on the cash at the start.
        </Text>
      ) : null}
      <CashActivity title="Running the association" group={report.operating} testID="cash-operating" />
      <CashActivity title="Buying or selling assets" group={report.investing} testID="cash-investing" />
      <CashActivity title="Loans and equity" group={report.financing} testID="cash-financing" />
      <StatementSection title="Cash at the end" rows={[]} totalLabel="Cash at the end" total={report.endingCash} onOpenTotal={() => open({ scope: 'cash', title: 'Cash and bank', to: report.period.endDate, datesLabel: 'Up to the end' })} emptyText="Bank and cash accounts together" />
      {report.reconciles === false ? (
        <View className="rounded-lg bg-warning-soft p-4" testID="cash-warning">
          <Text variant="body-strong" tone="warning">
            The movements do not add up to the change
          </Text>
          <Text variant="caption">Some cash moved without being recorded against a bank or cash account.</Text>
        </View>
      ) : null}
    </View>
  );
}
