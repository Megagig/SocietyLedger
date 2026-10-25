import { ArrowDown, Check } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { ReconciliationDTO, StatementEntryDTO, StatementImportDTO, SuggestionDTO } from '@/types/api/reconciliation';
import { confidenceLabel, matchStatusKey, STATUS_LABELS } from '../labels';

const when = (iso: string) => formatDate(iso, 'long');

/**
 * One suggestion: the bank line on top, the charge it probably paid underneath, how sure that is and why. Tick it to include it;
 * only the confident ones are ticked when the screen opens.
 */
function SuggestionCardBase({ item, selected, onToggle }: { item: SuggestionDTO; selected: boolean; onToggle: (item: SuggestionDTO) => void }) {
  const { color } = useThemeTokens();
  return (
    <Pressable
      onPress={() => onToggle(item)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${item.line.amount} naira to ${item.charge.memberName}, ${confidenceLabel(item.confidence)}`}
      testID={`suggestion-${item.statementEntryId ?? `t${item.bankTransferId}`}-${item.transactionId}`}
    >
      <Card className={cn(selected ? 'border-primary' : '')}>
        <View className="gap-3">
          <View className="flex-row items-start gap-3">
            <View className={cn('mt-0.5 h-5 w-5 items-center justify-center rounded-xs border', selected ? 'border-primary bg-primary' : 'border-border-strong bg-surface')}>
              {selected ? <Check size={14} color={color.textInverse} strokeWidth={2.5} /> : null}
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center justify-between gap-2">
                <Money value={item.line.amount} size="body-strong" tone="success" />
                <Badge tone={item.confidence >= 90 ? 'success' : item.confidence >= 60 ? 'info' : 'neutral'}>{`${confidenceLabel(item.confidence)} · ${item.confidence}%`}</Badge>
              </View>
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {item.line.description}
              </Text>
              <Text variant="caption" tone="tertiary">{`${when(item.line.date)}${item.line.reference ? ` · ${item.line.reference}` : ''}${item.source === 'transfer' ? ' · declared transfer' : ''}`}</Text>
            </View>
          </View>

          <View className="ml-8 gap-1 rounded-md bg-surface-sunken p-3">
            <View className="flex-row items-center gap-1.5">
              <ArrowDown size={14} color={color.textTertiary} strokeWidth={2} />
              <Text variant="caption" tone="secondary">
                Would pay
              </Text>
            </View>
            <Text variant="body-lg" numberOfLines={1}>
              {item.charge.memberName}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${item.charge.categoryName}${item.charge.referenceNumber ? ` · ${item.charge.referenceNumber}` : ''} · ${item.charge.memberNumber}`}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Text variant="caption" tone="secondary">
                Still owes
              </Text>
              <Money value={item.charge.available} size="caption" tone="warning" />
            </View>
          </View>

          <Text variant="caption" tone="tertiary" className="ml-8">
            {item.reasons.join(' · ')}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
export const SuggestionCard = memo(SuggestionCardBase);

/** One proposed or decided match, with what its actions will do. A match you proposed can't be confirmed by you, only turned down. */
function MatchCardBase({
  item,
  mine,
  busy,
  onConfirm,
  onDispute,
}: {
  item: ReconciliationDTO;
  mine: boolean;
  busy: boolean;
  onConfirm: (item: ReconciliationDTO) => void;
  onDispute: (item: ReconciliationDTO) => void;
}) {
  const name = `${item.transaction.member.firstName} ${item.transaction.member.lastName}`.trim();
  const line = item.statementEntry;
  const waiting = item.status === 'PENDING';
  return (
    <Card testID={`match-${item.id}`}>
      <View className="gap-3">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${item.transaction.category.name}${item.transaction.referenceNumber ? ` · ${item.transaction.referenceNumber}` : ''}`}
            </Text>
          </View>
          <View className="items-end gap-1">
            <Money value={item.matchedAmount} size="body-strong" tone="success" />
            <StatusChip status={matchStatusKey(item.status)} label={STATUS_LABELS[item.status]} />
          </View>
        </View>

        <View className="gap-0.5 rounded-md bg-surface-sunken p-3">
          <Text variant="caption" tone="secondary">
            The bank line
          </Text>
          <Text variant="body" numberOfLines={2}>
            {line ? line.description : item.bankTransfers[0] ? `Transfer ${item.bankTransfers[0].reference} from ${item.bankTransfers[0].senderBankName}` : 'A declared transfer'}
          </Text>
          <Text variant="caption" tone="tertiary">
            {line ? `${when(line.transactionDate)}${line.reference ? ` · ${line.reference}` : ''}` : when(item.createdAt)}
          </Text>
        </View>

        {waiting ? (
          <View className="gap-2">
            {mine ? (
              <Text variant="caption" tone="secondary">
                You proposed this match, so another officer has to confirm it. You can turn it down.
              </Text>
            ) : null}
            <View className="flex-row gap-3">
              <Button variant="secondary" fullWidth disabled={busy} onPress={() => onDispute(item)} testID={`match-${item.id}-dispute`}>
                Turn down
              </Button>
              {mine ? null : (
                <Button variant="primary" fullWidth disabled={busy} onPress={() => onConfirm(item)} testID={`match-${item.id}-confirm`}>
                  Confirm
                </Button>
              )}
            </View>
          </View>
        ) : item.notes ? (
          <Text variant="caption" tone="secondary">
            {item.notes}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
export const MatchCard = memo(MatchCardBase);

/** A money-in line still waiting for a charge. Opens the screen to pick which charge it paid. */
function LineRowBase({ item, position, onPress }: { item: StatementEntryDTO; position: RowPosition; onPress?: (item: StatementEntryDTO) => void }) {
  return (
    <GroupedRow position={position} onPress={onPress ? () => onPress(item) : undefined} accessibilityLabel={`${item.creditAmount} naira, ${item.description}`} testID={`line-${item.id}`} minHeight={76}>
      <View className="gap-1">
        <View className="flex-row items-start gap-3">
          <Text variant="body" numberOfLines={2} className="flex-1">
            {item.description}
          </Text>
          <Money value={item.creditAmount ?? 0} size="body-strong" tone="success" />
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {`${when(item.transactionDate)}${item.reference ? ` · ${item.reference}` : ''} · ${item.import.bankAccount.bankName}`}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const LineRow = memo(LineRowBase);

/** One imported statement: its file, dates, and how many of its money-in lines are matched. */
function ImportRowBase({ item, position }: { item: StatementImportDTO; position: RowPosition }) {
  const credits = item.matchedEntries + item.unmatchedEntries;
  return (
    <GroupedRow position={position} accessibilityLabel={item.filename} testID={`import-${item.id}`} minHeight={80}>
      <View className="gap-1">
        <View className="flex-row items-start gap-3">
          <Text variant="body-lg" numberOfLines={1} className="flex-1">
            {item.filename}
          </Text>
          {item.unmatchedEntries > 0 ? <Badge tone="warning">{`${item.unmatchedEntries} to match`}</Badge> : <Badge tone="success">All matched</Badge>}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {`${item.bankAccount.bankName} · ${item.bankAccount.accountNumber}`}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={2}>
          {`${when(item.importDate)} · ${credits} money-in lines, ${item.matchedEntries} matched${item.skippedEntries > 0 ? ` · ${item.skippedEntries} already imported before` : ''}`}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const ImportRow = memo(ImportRowBase);
