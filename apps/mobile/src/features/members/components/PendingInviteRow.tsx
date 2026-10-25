import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import type { PendingInviteDTO } from '@/types/api/membersManage';
import { memberFullName } from '../labels';

/** Whether the link has already run out. */
function isExpired(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export type PendingInviteRowProps = {
  invite: PendingInviteDTO;
  onResend: (invite: PendingInviteDTO) => void;
  onRevoke: (invite: PendingInviteDTO) => void;
  busy?: boolean;
};

/** An invite that hasn't been used: who it went to, when it expires (or that it already has), with Resend and Revoke. */
export function PendingInviteRow({ invite, onResend, onRevoke, busy = false }: PendingInviteRowProps) {
  const expired = isExpired(invite.inviteTokenExpiresAt);

  return (
    <View className="gap-3 rounded-lg border border-border bg-surface p-4 dark:border-transparent" testID={`pending-invite-${invite.id}`}>
      <View>
        <Text variant="body-lg" numberOfLines={1}>
          {memberFullName(invite.member)}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {invite.email ?? invite.member.email ?? 'No email'}
        </Text>
        <Text variant="caption" tone={expired ? 'danger' : 'secondary'}>
          {expired ? `Expired ${formatDate(invite.inviteTokenExpiresAt, 'long')}` : `Expires ${formatDate(invite.inviteTokenExpiresAt, 'long')}`}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button variant="secondary" size="sm" fullWidth disabled={busy} onPress={() => onRevoke(invite)} testID={`revoke-${invite.id}`}>
            Revoke
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="soft" size="sm" fullWidth disabled={busy} onPress={() => onResend(invite)} testID={`resend-${invite.id}`}>
            {expired ? 'Send again' : 'Resend'}
          </Button>
        </View>
      </View>
    </View>
  );
}
