import { Pressable, View } from 'react-native';
import { Paperclip } from 'lucide-react-native';

import { StatusChip } from '@/components/ui/StatusChip';
import { Text } from '@/components/ui/Text';
import { formatDate } from '@/lib/dates';
import { useThemeTokens } from '@/providers/ThemeProvider';
import type { TicketDTO } from '@/types/api/support';
import { CATEGORY_LABELS, STAFF_STATUS_LABELS, STATUS_LABELS } from '../labels';

export type TicketRowProps = {
  ticket: TicketDTO;
  onPress: () => void;
  /** Staff working someone else's ticket: shows who opened it, uses the staff's status wording, and flags tickets that need a reply. */
  staffView?: boolean;
};

function openerName(ticket: TicketDTO): string {
  const member = ticket.user?.member;
  return member ? `${member.firstName} ${member.lastName}` : ticket.user?.email ?? 'Unknown';
}

/** One ticket in a list: number, subject, category and last activity, with the status chip. A dot marks whose turn it is. */
export function TicketRow({ ticket, onPress, staffView = false }: TicketRowProps) {
  const { color } = useThemeTokens();
  const attachmentCount = ticket._count?.attachments ?? 0;
  // Member: waiting on you. Staff: waiting on us — the member replied and needs an answer.
  const needsYou = staffView ? ticket.status === 'WAITING_ON_STAFF' || ticket.status === 'OPEN' : ticket.status === 'WAITING_ON_USER';
  const statusLabel = staffView ? STAFF_STATUS_LABELS[ticket.status] : STATUS_LABELS[ticket.status];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${ticket.ticketNumber}, ${ticket.subject}, ${statusLabel}`}
      className="gap-1.5 px-4 py-3"
      testID={`ticket-row-${ticket.id}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            {needsYou ? <View className="h-2 w-2 rounded-full bg-warning" /> : null}
            <Text variant="caption" tone="secondary">
              {ticket.ticketNumber}
            </Text>
          </View>
          <Text variant="body-lg" numberOfLines={2}>
            {ticket.subject}
          </Text>
        </View>
        <StatusChip status={ticket.status.toLowerCase()} label={statusLabel} />
      </View>
      <View className="flex-row items-center gap-3">
        {staffView ? (
          <Text variant="caption" tone="secondary" numberOfLines={1} className="max-w-[120px]">
            {openerName(ticket)}
          </Text>
        ) : null}
        <Text variant="caption" tone="secondary">
          {CATEGORY_LABELS[ticket.category]}
        </Text>
        <Text variant="caption" tone="secondary">
          {`Updated ${formatDate(ticket.updatedAt, 'relative')}`}
        </Text>
        {attachmentCount > 0 ? <Paperclip size={14} color={color.textTertiary} strokeWidth={1.75} /> : null}
      </View>
    </Pressable>
  );
}
