import { memo } from 'react';
import { View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Money } from '@/components/ui/Money';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { PAYOUT_TYPE_LABELS } from '@/features/welfare/labels';
import { GroupedRow, type RowPosition } from '@/features/financeSetup/components/GroupedRow';
import { formatDate } from '@/lib/dates';
import type { OfficerContributionDTO, OfficerFundDTO, OfficerPayoutDTO } from '@/types/api/welfareManage';
import {
  CONFIRM_GUARD_MESSAGES,
  CONTRIBUTION_STATUS_LABELS,
  contributionStatusKey,
  FUND_KIND_LABELS,
  fundProgress,
  fundRulesLine,
  FUND_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  payoutStatusKey,
  type ConfirmGuard,
} from '../labels';

const memberName = (m: { firstName: string; lastName: string }) => `${m.firstName} ${m.lastName}`.trim();

/** One fund: name and kind, its balance (over its target on a bar if it has one), its payout rules and whether it is open. */
function FundRowBase({ item, position, onPress }: { item: OfficerFundDTO; position: RowPosition; onPress?: (item: OfficerFundDTO) => void }) {
  const progress = fundProgress(item);
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${item.name}, ${FUND_KIND_LABELS[item.fundType]}, ${FUND_STATUS_LABELS[item.status]}`}
      testID={`fund-row-${item.id}`}
      minHeight={92}
    >
      <View className={item.status === 'ACTIVE' ? 'gap-1.5' : 'gap-1.5 opacity-70'}>
        <View className="flex-row items-center gap-2">
          <Text variant="body-lg" numberOfLines={1} className="flex-shrink">
            {item.name}
          </Text>
          <Badge tone="primary">{FUND_KIND_LABELS[item.fundType]}</Badge>
          {item.status === 'ACTIVE' ? null : <Badge tone="neutral">{FUND_STATUS_LABELS[item.status]}</Badge>}
        </View>
        {progress !== null ? <ProgressBar percent={progress} label="Held so far" /> : null}
        <View className="flex-row flex-wrap items-center gap-x-1">
          <Money value={item.currentBalance} size="body-strong" />
          {item.targetBalance !== null ? (
            <>
              <Text variant="caption" tone="secondary">
                {' of '}
              </Text>
              <Money value={item.targetBalance} size="caption" tone="secondary" />
            </>
          ) : null}
        </View>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {fundRulesLine(item)}
        </Text>
      </View>
    </GroupedRow>
  );
}
export const FundRow = memo(FundRowBase);

/** One payout request: who asked, for what kind, from which fund, the amount asked over where it stands. */
function PayoutRowBase({ item, position, onPress }: { item: OfficerPayoutDTO; position: RowPosition; onPress?: (item: OfficerPayoutDTO) => void }) {
  return (
    <GroupedRow
      position={position}
      onPress={onPress ? () => onPress(item) : undefined}
      accessibilityLabel={`${memberName(item.member)}, ${PAYOUT_TYPE_LABELS[item.payoutType] ?? item.payoutType}, ${PAYOUT_STATUS_LABELS[item.status]}`}
      testID={`payout-row-${item.id}`}
      minHeight={84}
    >
      <View className="flex-row items-center">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {memberName(item.member)}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${PAYOUT_TYPE_LABELS[item.payoutType] ?? item.payoutType} · ${item.fund.name}`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${item.requestNumber} · ${formatDate(item.requestedAt, 'long')}`}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={item.status === 'APPROVED' || item.status === 'DISBURSED' ? (item.approvedAmount ?? item.amount) : item.amount} size="body-strong" />
          <StatusChip status={payoutStatusKey(item.status)} label={PAYOUT_STATUS_LABELS[item.status]} />
        </View>
      </View>
    </GroupedRow>
  );
}
export const PayoutRow = memo(PayoutRowBase);

/**
 * One contribution: who paid how much into which fund and how, with Confirm / Reject while it is waiting and this officer may decide it.
 * One made in the officer's own name, or recorded by them, shows a note instead: another officer has to confirm it.
 */
export function ContributionCard({
  contribution,
  guard,
  busy,
  onConfirm,
  onReject,
}: {
  contribution: OfficerContributionDTO;
  guard: ConfirmGuard;
  busy?: boolean;
  onConfirm: (contribution: OfficerContributionDTO) => void;
  onReject: (contribution: OfficerContributionDTO) => void;
}) {
  return (
    <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID={`contribution-${contribution.id}`}>
      <View className="flex-row items-start">
        <View className="flex-1 gap-0.5">
          <Text variant="body-lg" numberOfLines={1}>
            {memberName(contribution.member)}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${contribution.member.memberId ?? ''} · ${contribution.fund.name}`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {`${formatDate(contribution.contributionDate, 'long')}${contribution.paymentMethod ? ` · ${contribution.paymentMethod.replace(/_/g, ' ')}` : ''}${contribution.reference ? ` · Ref ${contribution.reference}` : ''}`}
          </Text>
        </View>
        <View className="ml-3 items-end gap-1.5">
          <Money value={contribution.amount} size="body-strong" />
          <StatusChip status={contributionStatusKey(contribution.status)} label={CONTRIBUTION_STATUS_LABELS[contribution.status]} />
        </View>
      </View>

      {contribution.notes ? (
        <Text variant="caption" tone="secondary">
          {`Note: ${contribution.notes}`}
        </Text>
      ) : null}

      {guard === 'ok' ? (
        <View className="flex-row gap-3">
          <Button variant="secondary" fullWidth disabled={busy} onPress={() => onReject(contribution)} testID={`contribution-reject-${contribution.id}`}>
            Reject
          </Button>
          <Button variant="primary" fullWidth loading={busy} onPress={() => onConfirm(contribution)} testID={`contribution-confirm-${contribution.id}`}>
            Confirm
          </Button>
        </View>
      ) : guard === 'own' || guard === 'recorder' ? (
        <Text variant="caption" tone="secondary" testID={`contribution-guard-${contribution.id}`}>
          {CONFIRM_GUARD_MESSAGES[guard]}
        </Text>
      ) : null}
    </View>
  );
}
