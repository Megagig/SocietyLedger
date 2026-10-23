import { memo } from 'react';
import { View } from 'react-native';

import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { CampaignListItemDTO } from '@/types/api/financeSetup';
import { CAMPAIGN_STATUS_LABELS, campaignStatusKey, deadlineLabel } from '../labels';
import { GroupedRow, type RowPosition } from './GroupedRow';

export type CampaignRowProps = {
  campaign: CampaignListItemDTO;
  position: RowPosition;
  onPress: (campaign: CampaignListItemDTO) => void;
};

/** One levy campaign: its name and status, collected over target on a bar, and the deadline. */
function CampaignRowBase({ campaign, position, onPress }: CampaignRowProps) {
  const { progress } = campaign;
  const stillOpen = campaign.status === 'ACTIVE' || campaign.status === 'DRAFT';
  return (
    <GroupedRow
      position={position}
      onPress={() => onPress(campaign)}
      accessibilityLabel={`${campaign.name}, ${CAMPAIGN_STATUS_LABELS[campaign.status]}, ${Math.round(progress.progressPercentage)} percent collected`}
      testID={`campaign-row-${campaign.id}`}
      minHeight={96}
    >
      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="body-lg" numberOfLines={1} className="flex-1">
            {campaign.name}
          </Text>
          <StatusChip status={campaignStatusKey(campaign.status)} label={CAMPAIGN_STATUS_LABELS[campaign.status]} />
        </View>
        <ProgressBar percent={progress.progressPercentage} tone={campaign.status === 'COMPLETED' ? 'success' : 'primary'} label="Collected so far" />
        <View className="flex-row flex-wrap items-center gap-x-1">
          <Money value={progress.totalCollected} size="caption" />
          <Text variant="caption" tone="secondary">
            {' of '}
          </Text>
          <Money value={campaign.targetAmount} size="caption" tone="secondary" />
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {`${campaign.category.name} · ${progress.paidCount}/${progress.assignedMembers} paid · ${stillOpen ? deadlineLabel(campaign.deadline) : `Deadline ${formatDate(campaign.deadline, 'long')}`}`}
        </Text>
      </View>
    </GroupedRow>
  );
}

export const CampaignRow = memo(CampaignRowBase);
