import { View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { ApprovalDTO } from '@/types/api/membersManage';

export function approvalDisplayName(approval: ApprovalDTO): string {
  const member = approval.user.member;
  return member ? `${member.firstName} ${member.lastName}`.trim() : approval.user.email;
}

export type ApprovalRowProps = {
  approval: ApprovalDTO;
  /** Only passed for a pending registration — decided ones are read-only. */
  onApprove?: (approval: ApprovalDTO) => void;
  onReject?: (approval: ApprovalDTO) => void;
  busy?: boolean;
};

/** One self-registration: who, when, whether their email is verified, and — while pending — Approve / Reject. A rejected one shows its reason. */
export function ApprovalRow({ approval, onApprove, onReject, busy = false }: ApprovalRowProps) {
  const name = approvalDisplayName(approval);
  const member = approval.user.member;
  const pending = approval.approvalStatus === 'pending';

  return (
    <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID={`approval-${approval.userId}`}>
      <View className="flex-row items-center gap-3">
        <Avatar name={name} colorSeed={approval.userId} />
        <View className="flex-1">
          <Text variant="body-lg" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {approval.user.email}
          </Text>
          {member?.phone ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {member.phone}
            </Text>
          ) : null}
        </View>
        <StatusChip status={approval.approvalStatus} />
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <Text variant="caption" tone="secondary">
          {`Registered ${formatDate(approval.createdAt, 'long')}`}
        </Text>
        {pending ? <Badge tone={approval.user.emailVerified ? 'success' : 'warning'}>{approval.user.emailVerified ? 'Email verified' : 'Email not verified'}</Badge> : null}
      </View>

      {!pending && approval.approvalDate ? (
        <Text variant="caption" tone="secondary">
          {`${approval.approvalStatus === 'approved' ? 'Approved' : 'Rejected'} ${formatDate(approval.approvalDate, 'long')}${approval.approvedBy ? ` by ${approval.approvedBy.email}` : ''}`}
        </Text>
      ) : null}
      {approval.approvalStatus === 'rejected' && approval.rejectionReason ? (
        <Text variant="body" tone="secondary">
          {`Reason: ${approval.rejectionReason}`}
        </Text>
      ) : null}

      {pending && onApprove && onReject ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button variant="secondary" size="sm" fullWidth disabled={busy} onPress={() => onReject(approval)} testID={`reject-${approval.userId}`}>
              Reject
            </Button>
          </View>
          <View className="flex-1">
            <Button variant="primary" size="sm" fullWidth disabled={busy} onPress={() => onApprove(approval)} testID={`approve-${approval.userId}`}>
              Approve
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
