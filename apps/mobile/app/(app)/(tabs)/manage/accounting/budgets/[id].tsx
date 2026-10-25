import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { toast } from 'sonner-native';

import { ApiError } from '@/api/errors';
import { ConfirmSheet } from '@/components/feedback/ConfirmSheet';
import { ErrorState } from '@/components/feedback/ErrorState';
import { NoPermission } from '@/components/feedback/NoPermission';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Section } from '@/components/layout/Section';
import { StickyFooter } from '@/components/layout/StickyFooter';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { PlanBar } from '@/features/accounting/components/Rows';
import { ACCOUNTING_APPROVE_ACCESS, ACCOUNTING_EDIT_ACCESS, BUDGET_STATUS_LABELS, budgetStatusKey, ledgerHref, usedPercent, VARIANCE_LABELS } from '@/features/accounting/labels';
import { useActivateBudget, useApproveBudget } from '@/features/accounting/mutations';
import { useAccountingAccess, useBudget, useBudgetVariance } from '@/features/accounting/queries';
import { useCan } from '@/hooks/useCan';
import { formatDate } from '@/lib/dates';
import { toDecimal } from '@/lib/money';
import { useSessionStore } from '@/stores/session';
import type { BudgetVarianceItemDTO, VarianceSummaryDTO } from '@/types/api/accounting';

/** One account against its plan: a bar for how much is used, and whether it is over, under or on track. */
function VarianceLine({ item, note, onOpen }: { item: BudgetVarianceItemDTO; note?: string | null; onOpen?: () => void }) {
  return (
    <Pressable
      disabled={!onOpen}
      onPress={onOpen}
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={onOpen ? `${item.accountName}. Opens the entries.` : undefined}
      className="gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent"
      testID={`variance-${item.accountId}`}
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="body-lg" className="flex-1" numberOfLines={1}>
          {item.accountName}
        </Text>
        <StatusChip status={item.status === 'over' ? 'overdue' : item.status === 'under' ? 'upcoming' : 'active'} label={VARIANCE_LABELS[item.status]} />
      </View>
      {note ? (
        <Text variant="caption" tone="secondary" testID={`variance-note-${item.accountId}`}>
          {note}
        </Text>
      ) : null}
      <PlanBar label={item.accountName} actual={item.actualAmount} budget={item.budgetAmount} percent={usedPercent(item.actualAmount, item.budgetAmount)} over={toDecimal(item.actualAmount).gt(item.budgetAmount)} />
    </Pressable>
  );
}

function SummaryBar({ title, summary, onOpen }: { title: string; summary: VarianceSummaryDTO; onOpen?: () => void }) {
  return (
    <Pressable
      disabled={!onOpen}
      onPress={onOpen}
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={onOpen ? `${title}. Opens the entries.` : undefined}
      className="gap-2 rounded-lg border border-border bg-surface p-4 dark:border-transparent"
    >
      <Text variant="label" tone="secondary">
        {title}
      </Text>
      <PlanBar label={title} actual={summary.totalActual} budget={summary.totalBudget} percent={usedPercent(summary.totalActual, summary.totalBudget)} over={toDecimal(summary.totalActual).gt(summary.totalBudget)} />
    </Pressable>
  );
}

/** project-overview.md §6.9 AC6 — one budget: what was planned, what has happened so far, and the next step for the officer. */
export default function BudgetDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const budgetId = Number(id);
  const allowed = useAccountingAccess();
  const canEdit = useCan(ACCOUNTING_EDIT_ACCESS);
  const canApprove = useCan(ACCOUNTING_APPROVE_ACCESS);
  const me = useSessionStore((s) => s.user?.id);
  const valid = Number.isInteger(budgetId);
  const budgetQuery = useBudget(valid ? budgetId : undefined);
  const variance = useBudgetVariance(valid ? budgetId : undefined);
  const approve = useApproveBudget(budgetId);
  const activate = useActivateBudget(budgetId);
  const approveRef = useRef<BottomSheetModal>(null);
  const activateRef = useRef<BottomSheetModal>(null);
  const back = () => router.back();

  if (!allowed) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Budget" onBack={back} />
        <NoPermission />
      </Screen>
    );
  }
  if (budgetQuery.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Budget" onBack={back} docsKey="AC6" />
        <View className="gap-4">
          <Skeleton width="100%" height={90} radius="md" />
          <Skeleton width="100%" height={160} radius="md" />
        </View>
      </Screen>
    );
  }
  const budget = budgetQuery.data;
  if (budgetQuery.isError || !budget) {
    return (
      <Screen edges={['top']} scroll={false}>
        <ScreenHeader title="Budget" onBack={back} docsKey="AC6" />
        <ErrorState error={budgetQuery.error} title={budgetQuery.isError ? undefined : 'Budget not found'} onRetry={() => budgetQuery.refetch()} />
      </Screen>
    );
  }

  const isMine = me !== undefined && budget.createdBy === me;
  const fail = (fallback: string) => (error: unknown) => toast.error(error instanceof ApiError ? error.message : fallback);
  const showEdit = budget.status === 'DRAFT' && canEdit;
  const showApprove = (budget.status === 'DRAFT' || budget.status === 'PENDING_APPROVAL') && canApprove && !isMine;
  const showActivate = budget.status === 'APPROVED' && canApprove;
  const data = variance.data;
  const noteOf = (accountId: number) => budget.items.find((i) => i.accountId === accountId)?.notes ?? null;
  const income = data?.items.filter((i) => i.accountType === 'INCOME') ?? [];
  const spending = data?.items.filter((i) => i.accountType !== 'INCOME') ?? [];
  // The entries behind a figure are those posted inside the dates the plan is measured over
  const dates = data ? { from: data.period.startDate, to: data.period.endDate, datesLabel: 'The budget’s dates' } : {};
  const openAccount = (item: BudgetVarianceItemDTO) => () => router.push(ledgerHref({ accountId: item.accountId, title: item.accountName, ...dates }) as never);
  const openTogether = (title: string, items: BudgetVarianceItemDTO[]) => () => router.push(ledgerHref({ accountIds: items.map((i) => i.accountId), title, ...dates }) as never);

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={budget.name} onBack={back} docsKey="AC6" />

      <View className="gap-6 pb-8">
        <View className="gap-2">
          <StatusChip status={budgetStatusKey(budget.status)} label={BUDGET_STATUS_LABELS[budget.status]} testID="budget-status" />
          <Text variant="caption" tone="secondary">
            {budget.fiscalYear} · {formatDate(budget.startDate, 'long')} to {formatDate(budget.endDate, 'long')}
          </Text>
          {budget.description ? <Text variant="body">{budget.description}</Text> : null}
          {(budget.status === 'DRAFT' || budget.status === 'PENDING_APPROVAL') && isMine ? (
            <Text variant="caption" tone="secondary" testID="budget-own-note">
              You wrote this budget, so another officer has to approve it.
            </Text>
          ) : null}
        </View>

        {variance.isPending ? (
          <Skeleton width="100%" height={140} radius="md" />
        ) : variance.isError || !data ? (
          <ErrorState error={variance.error} onRetry={() => variance.refetch()} />
        ) : (
          <>
            <Section title="So far">
              <View className="gap-3">
                {spending.length > 0 ? <SummaryBar title="Spending against the plan" summary={data.expenseSummary} onOpen={openTogether('Spending', spending)} /> : null}
                {income.length > 0 ? <SummaryBar title="Income against the plan" summary={data.incomeSummary} onOpen={openTogether('Income', income)} /> : null}
              </View>
              <Text variant="caption" tone="secondary">
                Only entries that have been posted, from {formatDate(data.period.startDate, 'long')}.
              </Text>
            </Section>

            {spending.length > 0 ? (
              <Section title="Spending">
                <View className="gap-3">
                  {spending.map((item) => (
                    <VarianceLine key={item.accountId} item={item} note={noteOf(item.accountId)} onOpen={openAccount(item)} />
                  ))}
                </View>
              </Section>
            ) : null}
            {income.length > 0 ? (
              <Section title="Income">
                <View className="gap-3">
                  {income.map((item) => (
                    <VarianceLine key={item.accountId} item={item} note={noteOf(item.accountId)} onOpen={openAccount(item)} />
                  ))}
                </View>
              </Section>
            ) : null}
          </>
        )}
      </View>

      {showEdit || showApprove || showActivate ? (
        <StickyFooter>
          {showEdit ? (
            <View className="flex-1">
              <Button variant="secondary" fullWidth onPress={() => router.push({ pathname: '/(app)/(tabs)/manage/accounting/budgets/form', params: { id: String(budget.id) } } as never)} testID="budget-edit">
                Change
              </Button>
            </View>
          ) : null}
          {showApprove ? (
            <View className="flex-1">
              <Button variant="primary" fullWidth loading={approve.isPending} onPress={() => approveRef.current?.present()} testID="budget-approve">
                Approve
              </Button>
            </View>
          ) : null}
          {showActivate ? (
            <View className="flex-1">
              <Button variant="primary" fullWidth loading={activate.isPending} onPress={() => activateRef.current?.present()} testID="budget-activate">
                Put in force
              </Button>
            </View>
          ) : null}
        </StickyFooter>
      ) : null}

      <ConfirmSheet
        ref={approveRef}
        title="Approve this budget?"
        description="It can then be put in force. You cannot approve a budget you wrote."
        confirmLabel="Approve budget"
        destructive={false}
        onConfirm={() => {
          approveRef.current?.dismiss();
          approve.mutate(undefined, { onSuccess: () => toast.success('Budget approved'), onError: fail('Could not approve the budget. Try again.') });
        }}
      />
      <ConfirmSheet
        ref={activateRef}
        title="Put this budget in force?"
        description={`It becomes the budget for ${budget.fiscalYear}. Any other budget in force for the same year is closed.`}
        confirmLabel="Put in force"
        destructive={false}
        onConfirm={() => {
          activateRef.current?.dismiss();
          activate.mutate(undefined, { onSuccess: () => toast.success('Budget in force'), onError: fail('Could not put the budget in force. Try again.') });
        }}
      />
    </Screen>
  );
}
