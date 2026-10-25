import { memo } from 'react';
import { View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { formatDate } from '@/lib/dates';
import type { AllocationDTO, DonationListItemDTO, PenaltyRuleDTO, WaiverDTO } from '@/types/api/donationsPenalties';
import { ALLOCATION_KIND_LABELS, donationStatusKey, donationStatusLabel, ruleFeeLabel, ruleScheduleLabel, ruleScopeLabel } from '../labels';

type RowProps<T> = { item: T; position: RowPosition; onPress?: (item: T) => void };

/** One fund: its name and kind, what it has received over its target, and how many donations. A switched-off fund is dimmed. */
function AllocationRowBase({ item, position, onPress }: RowProps<AllocationDTO>) {
  const { stats } = item;
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.name}, ${ALLOCATION_KIND_LABELS[item.type]}${item.isActive ? '' : ', inactive'}`}
      testID={`allocation-row-${item.id}`}
      minHeight={88}
    >
      <View className={item.isActive ? 'gap-1.5' : 'gap-1.5 opacity-60'}>
        <View className="flex-row items-center gap-2">
          <Text variant="body-lg" numberOfLines={1} className="flex-shrink">
            {item.name}
          </Text>
          <Badge tone="primary">{ALLOCATION_KIND_LABELS[item.type]}</Badge>
          {item.isActive ? null : <Badge tone="neutral">Inactive</Badge>}
        </View>
        {item.targetAmount !== null && stats.progressPercentage !== null ? <ProgressBar percent={stats.progressPercentage} label="Received so far" /> : null}
        <View className="flex-row flex-wrap items-center gap-x-1">
          <Money value={stats.totalDonated} size="caption" />
          {item.targetAmount !== null ? (
            <>
              <Text variant="caption" tone="secondary">
                {' of '}
              </Text>
              <Money value={item.targetAmount} size="caption" tone="secondary" />
            </>
          ) : null}
          <Text variant="caption" tone="secondary">
            {` · ${stats.donationCount} ${stats.donationCount === 1 ? 'donation' : 'donations'}`}
          </Text>
        </View>
      </View>
    </GroupedRow>
  );
}
export const AllocationRow = memo(AllocationRowBase);

/** One donation: who gave to which cause (and fund), the amount over its status. A pledge shows what is promised; a donor can be anonymous. */
function DonationRowBase({ item, position, onPress }: RowProps<DonationListItemDTO>) {
  const label = donationStatusLabel(item);
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.donor.name}, ${item.category}, ${label}`}
      testID={`donation-row-${item.id}`}
    >
      <View className="flex-row items-center">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1} className={item.isVoided ? 'opacity-60' : undefined}>
            {item.donor.name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {item.allocation ? `${item.category} · ${item.allocation.name}` : item.category}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {item.isPledge && item.dueDate ? `Pledged for ${formatDate(item.dueDate, 'long')}` : formatDate(item.createdAt, 'long')}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={item.amount} size="body-strong" tone={item.isVoided ? 'secondary' : 'default'} />
          <StatusChip status={donationStatusKey(item)} label={label} />
        </View>
      </View>
    </GroupedRow>
  );
}
export const DonationRow = memo(DonationRowBase);

/** One late-fee rule: its name and whether it is on, what it charges, when, and which charges it covers. */
function RuleRowBase({ item, position, onPress }: RowProps<PenaltyRuleDTO>) {
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.name}, ${item.isActive ? 'on' : 'off'}`}
      testID={`rule-row-${item.id}`}
      minHeight={88}
    >
      <View className={item.isActive ? 'gap-0.5' : 'gap-0.5 opacity-60'}>
        <View className="flex-row items-center gap-2">
          <Text variant="body-lg" numberOfLines={1} className="flex-shrink">
            {item.name}
          </Text>
          <Badge tone={item.isActive ? 'success' : 'neutral'}>{item.isActive ? 'On' : 'Off'}</Badge>
        </View>
        <Text variant="caption" numberOfLines={1}>
          {ruleFeeLabel(item)}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {`${ruleScheduleLabel(item)} · ${ruleScopeLabel(item)}`}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const RuleRow = memo(RuleRowBase);

/** One waiver: who was forgiven how much, the penalty it was on, the reason and the date. */
function WaiverRowBase({ item, position }: Omit<RowProps<WaiverDTO>, 'onPress'>) {
  const name = `${item.transaction.member.firstName} ${item.transaction.member.lastName}`.trim();
  return (
    <GroupedRow position={position} accessibilityLabel={`${name}, waived`} testID={`waiver-row-${item.id}`}>
      <View className="flex-row items-center">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${item.transaction.category.name} · ${formatDate(item.waivedAt, 'long')}`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {item.reason}
          </Text>
        </View>
        <Money value={item.waivedAmount} size="body-strong" />
      </View>
    </GroupedRow>
  );
}
export const WaiverRow = memo(WaiverRowBase);
