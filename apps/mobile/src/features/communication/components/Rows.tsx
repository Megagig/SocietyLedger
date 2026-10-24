import { memo } from 'react';
import { View } from 'react-native';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { formatDate } from '@/lib/dates';
import type {
  SentAnnouncementDTO,
  SmsCampaignDTO,
  SmsCreditTransactionDTO,
  SmsMessageDTO,
  SmsTemplateDTO,
} from '@/types/api/communication';
import {
  AUDIENCE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  campaignProgress,
  campaignStatusKey,
  CREDIT_TYPE_LABELS,
  creditsLabel,
  MESSAGE_STATUS_LABELS,
  messageStatusKey,
  RECIPIENT_TYPE_LABELS,
  TEMPLATE_CATEGORY_LABELS,
} from '../labels';

const when = (iso: string) => `${formatDate(iso, 'long')}, ${formatDate(iso, 'time')}`;

/** One announcement that was sent: what it said, who it went to, and where its texts stand. */
function AnnouncementRowBase({ item, position }: { item: SentAnnouncementDTO; position: RowPosition }) {
  const sending = item.status === 'SENDING';
  const parts = [`${item.memberCount.toLocaleString('en-NG')} members`, `${item.inAppCount.toLocaleString('en-NG')} in the app`];
  if (item.sendEmail) parts.push(`${item.emailCount.toLocaleString('en-NG')} emails`);
  if (item.sendSms) {
    parts.push(`${item.smsSent.toLocaleString('en-NG')} of ${item.smsRequested.toLocaleString('en-NG')} texts sent`);
    if (item.smsFailed > 0) parts.push(`${item.smsFailed.toLocaleString('en-NG')} failed`);
    if (item.noPhoneCount > 0) parts.push(`${item.noPhoneCount.toLocaleString('en-NG')} no number`);
    if (item.optedOutCount > 0) parts.push(`${item.optedOutCount.toLocaleString('en-NG')} opted out`);
    if (item.creditsUsed > 0) parts.push(creditsLabel(item.creditsUsed));
  }
  return (
    <GroupedRow position={position} accessibilityLabel={item.title} testID={`announcement-row-${item.id}`} minHeight={88}>
      <View className="gap-1">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={2}>
              {item.title}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${item.sentBy} · ${when(item.createdAt)} · ${AUDIENCE_LABELS[item.audience]}`}
            </Text>
          </View>
          {item.status === 'COMPLETED' ? null : <StatusChip status={sending ? 'in_progress' : 'pending'} label={sending ? 'Texts sending' : 'Interrupted'} />}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {item.message}
        </Text>
        <Text variant="caption" tone="tertiary">
          {parts.join(' · ')}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const AnnouncementRow = memo(AnnouncementRowBase);

/** One campaign: its name, who it goes to, where it stands, and its progress while it sends. */
function CampaignRowBase({ item, position, onPress }: { item: SmsCampaignDTO; position: RowPosition; onPress?: (item: SmsCampaignDTO) => void }) {
  const sending = item.status === 'IN_PROGRESS';
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.name}, ${CAMPAIGN_STATUS_LABELS[item.status]}`}
      testID={`campaign-row-${item.id}`}
      minHeight={80}
    >
      <View className="gap-1.5">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={2}>
              {item.name}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${RECIPIENT_TYPE_LABELS[item.recipientType]} · ${item.totalRecipients.toLocaleString('en-NG')} people`}
            </Text>
          </View>
          <StatusChip status={campaignStatusKey(item.status)} label={CAMPAIGN_STATUS_LABELS[item.status]} />
        </View>
        {sending ? <ProgressBar percent={campaignProgress(item.sentCount, item.failedCount, item.totalRecipients)} label="Texts sent" /> : null}
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {item.scheduledAt && item.status === 'SCHEDULED' ? `Goes out ${when(item.scheduledAt)}` : `${item.sentCount.toLocaleString('en-NG')} sent · ${item.failedCount.toLocaleString('en-NG')} failed · ${when(item.createdAt)}`}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const CampaignRow = memo(CampaignRowBase);

/** One text: who it went to, what it said, and whether it got there. */
function MessageRowBase({ item, position }: { item: SmsMessageDTO; position: RowPosition }) {
  return (
    <GroupedRow position={position} accessibilityLabel={`Text to ${item.recipientName ?? item.recipientPhone}`} testID={`message-row-${item.id}`} minHeight={72}>
      <View className="gap-1">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={1}>
              {item.recipientName ?? item.recipientPhone}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${item.recipientName ? `${item.recipientPhone} · ` : ''}${when(item.createdAt)}${item.campaign ? ` · ${item.campaign.name}` : ''}`}
            </Text>
          </View>
          <StatusChip status={messageStatusKey(item.status)} label={MESSAGE_STATUS_LABELS[item.status]} />
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {item.message}
        </Text>
        {item.errorMessage ? (
          <Text variant="caption" tone="danger" numberOfLines={2}>
            {item.errorMessage}
          </Text>
        ) : null}
      </View>
    </GroupedRow>
  );
}
export const MessageRow = memo(MessageRowBase);

/** One change to the credit balance. */
function CreditRowBase({ item, position }: { item: SmsCreditTransactionDTO; position: RowPosition }) {
  const gain = item.amount > 0;
  return (
    <GroupedRow position={position} accessibilityLabel={`${CREDIT_TYPE_LABELS[item.type]} ${creditsLabel(Math.abs(item.amount))}`} testID={`credit-row-${item.id}`} minHeight={64}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {CREDIT_TYPE_LABELS[item.type]}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {`${item.description ?? ''}${item.description ? ' · ' : ''}${when(item.createdAt)}`}
          </Text>
        </View>
        <Text variant="body-strong" tone={gain ? 'success' : 'default'}>
          {`${gain ? '+' : '−'}${Math.abs(item.amount).toLocaleString('en-NG')}`}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const CreditRow = memo(CreditRowBase);

/** One saved message wording. */
function TemplateRowBase({ item, position, onPress }: { item: SmsTemplateDTO; position: RowPosition; onPress?: (item: SmsTemplateDTO) => void }) {
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={item.name}
      testID={`template-row-${item.id}`}
      minHeight={72}
    >
      <View className="gap-1">
        <View className="flex-row items-start gap-3">
          <View className="flex-1 gap-0.5">
            <Text variant="body-lg" numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`${TEMPLATE_CATEGORY_LABELS[item.category]} · used ${item.usageCount.toLocaleString('en-NG')} ${item.usageCount === 1 ? 'time' : 'times'}`}
            </Text>
          </View>
          {item.isActive ? null : <StatusChip status="inactive" label="Off" />}
        </View>
        <Text variant="caption" tone="tertiary" numberOfLines={2}>
          {item.content}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const TemplateRow = memo(TemplateRowBase);
