import { memo } from 'react';
import { View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { formatDate } from '@/lib/dates';
import type { AccountingPeriodDTO, BudgetDTO, ChartAccountDTO, JournalEntryDTO, SyncErrorDTO } from '@/types/api/accounting';
import { BUDGET_STATUS_LABELS, budgetStatusKey, isAutomatic, JOURNAL_STATUS_LABELS, journalStatusKey, PERIOD_STATUS_LABELS, periodStatusKey } from '../labels';

/** One journal entry: its number and date, what it was for, the amount, and where it stands. */
function EntryRowBase({ item, position, onPress }: { item: JournalEntryDTO; position: RowPosition; onPress?: (item: JournalEntryDTO) => void }) {
  return (
    <GroupedRow position={position} accessibilityLabel={`${item.entryNumber}, ${item.description}`} testID={`entry-row-${item.id}`} onPress={onPress ? () => onPress(item) : undefined} minHeight={84}>
      <View className="gap-1">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text variant="body-lg" numberOfLines={2}>
              {item.description}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {item.entryNumber} · {formatDate(item.entryDate, 'long')}
            </Text>
          </View>
          <Money value={item.totalDebit} size="body-strong" />
        </View>
        <View className="flex-row items-center gap-2">
          <StatusChip status={journalStatusKey(item.status)} label={JOURNAL_STATUS_LABELS[item.status]} />
          {isAutomatic(item) ? <Badge tone="neutral">Automatic</Badge> : null}
        </View>
      </View>
    </GroupedRow>
  );
}
export const EntryRow = memo(EntryRowBase);

/** One account of the chart: its code and name, what kind it is and (when asked for) what it holds. */
function AccountRowBase({ item, position, onPress, indent = 0 }: { item: ChartAccountDTO; position: RowPosition; onPress?: (item: ChartAccountDTO) => void; indent?: number }) {
  return (
    <GroupedRow position={position} accessibilityLabel={`${item.code} ${item.name}`} testID={`account-row-${item.id}`} onPress={onPress ? () => onPress(item) : undefined} minHeight={60}>
      <View className="flex-row items-center justify-between gap-3" style={{ paddingLeft: indent }}>
        <View className="flex-1">
          <Text variant="body-lg" numberOfLines={1} tone={item.isActive ? 'default' : 'secondary'}>
            {item.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {item.code}
            {item.isSystemAccount ? ' · Built in' : ''}
            {item.isActive ? '' : ' · Switched off'}
          </Text>
        </View>
        {item.balance !== undefined ? <Money value={item.balance} size="body-strong" /> : null}
      </View>
    </GroupedRow>
  );
}
export const AccountRow = memo(AccountRowBase);

/** One budget: its name and year, what it plans, and whether it is in force. */
function BudgetRowBase({ item, position, onPress }: { item: BudgetDTO; position: RowPosition; onPress?: (item: BudgetDTO) => void }) {
  return (
    <GroupedRow position={position} accessibilityLabel={item.name} testID={`budget-row-${item.id}`} onPress={onPress ? () => onPress(item) : undefined} minHeight={72}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text variant="body-lg" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="caption" tone="secondary">
            {item.fiscalYear} · {item.items.length} {item.items.length === 1 ? 'line' : 'lines'}
          </Text>
          <StatusChip status={budgetStatusKey(item.status)} label={BUDGET_STATUS_LABELS[item.status]} />
        </View>
        <Money value={item.totalBudget} size="body-strong" />
      </View>
    </GroupedRow>
  );
}
export const BudgetRow = memo(BudgetRowBase);

/** One accounting period and whether it is open for new entries. */
function PeriodRowBase({ item, position, onPress }: { item: AccountingPeriodDTO; position: RowPosition; onPress?: (item: AccountingPeriodDTO) => void }) {
  return (
    <GroupedRow position={position} accessibilityLabel={`${item.name}, ${PERIOD_STATUS_LABELS[item.status]}`} testID={`period-row-${item.id}`} onPress={onPress ? () => onPress(item) : undefined} minHeight={68}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text variant="body-lg" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="caption" tone="secondary">
            {formatDate(item.startDate, 'long')} to {formatDate(item.endDate, 'long')}
          </Text>
        </View>
        <StatusChip status={periodStatusKey(item.status)} label={PERIOD_STATUS_LABELS[item.status]} />
      </View>
    </GroupedRow>
  );
}
export const PeriodRow = memo(PeriodRowBase);

/** One thing that could not be entered in the books, with the plain reason. */
function SyncErrorRowBase({ item, position }: { item: SyncErrorDTO; position: RowPosition }) {
  return (
    <GroupedRow position={position} accessibilityLabel={item.message} testID={`sync-error-${item.id}`} minHeight={64}>
      <View className="gap-0.5">
        <Text variant="body" numberOfLines={3}>
          {item.message}
        </Text>
        <Text variant="caption" tone="secondary">
          {item.tableName ?? 'Record'}
          {item.recordId ? ` ${item.recordId}` : ''} · {formatDate(item.createdAt, 'long')}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const SyncErrorRow = memo(SyncErrorRowBase);

/** A figure against its plan: a bar for how much is used, and the numbers beneath. */
export function PlanBar({ label, actual, budget, percent, over }: { label: string; actual: string | number; budget: string | number; percent: number; over: boolean }) {
  return (
    <View className="gap-1.5">
      <ProgressBar percent={percent} tone={over ? 'primary' : 'success'} label={label} />
      <View className="flex-row justify-between gap-3">
        <Money value={actual} size="caption" tone={over ? 'danger' : 'default'} />
        <Text variant="caption" tone="secondary">
          of
        </Text>
        <Money value={budget} size="caption" tone="secondary" />
      </View>
    </View>
  );
}
